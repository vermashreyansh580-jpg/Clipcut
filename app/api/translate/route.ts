import { NextRequest, NextResponse } from 'next/server';
import { GROQ_API_BASE, getGroqApiKey } from '@/lib/groq';
import {
  CaptionCue,
  applyProofreadOrTranslatedCues,
} from '@/lib/subtitles';
import { safeParseResponseJson } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const apiKey = getGroqApiKey();
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim().startsWith('<')) {
      return NextResponse.json(
        { error: 'Invalid JSON request body sent to translation endpoint.' },
        { status: 400 }
      );
    }
    const body = JSON.parse(rawBody);
    const {
      cues,
      targetLanguage,
      llmModel = 'openai/gpt-oss-120b',
    } = body as {
      cues: CaptionCue[];
      targetLanguage: string;
      llmModel?: string;
    };

    if (!Array.isArray(cues) || cues.length === 0) {
      return NextResponse.json(
        { error: 'Please provide at least one subtitle cue to translate.' },
        { status: 400 }
      );
    }

    if (!targetLanguage) {
      return NextResponse.json(
        { error: 'Please specify a target language.' },
        { status: 400 }
      );
    }

    const isHinglish = targetLanguage.toLowerCase().includes('hinglish');

    const systemPrompt = isHinglish
      ? 'You are an expert Indian Hinglish subtitle proofreader and phonetic romanizer. CRITICAL RULES: 1) Convert any Devanagari Hindi words into natural, accurately spelled Roman Hinglish (e.g. "आज हम बात करेंगे" -> "Aaj hum baat karenge", "चलते चलते" -> "chalte chalte", "स्पेलिंग मिस्टेक्स" -> "spelling mistakes"). 2) NEVER translate Hindi sentences into English sentences! Keep the exact spoken Hindi/Hinglish vocabulary and grammar. 3) Fix all phonetic spelling mistakes and spell English loanwords with correct standard English spelling. 4) Never skip or merge any cue index. Respond ONLY with valid JSON {"cues":[{"index":0,"text":"..."}]}.'
      : `You are a professional subtitle translator and proofreader. Translate every cue into ${targetLanguage} with 100% accurate spelling while preserving natural spoken pacing and exact cue indices. Respond ONLY with a valid JSON object matching {"cues":[{"index":0,"text":"translated line"}]}.`;

    const inputPayload = cues.map((c, idx) => ({
      index: idx,
      text: c.text,
    }));

    const groqRes = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: llmModel || 'openai/gpt-oss-120b',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: JSON.stringify({ cues: inputPayload }),
          },
        ],
      }),
    });

    const data = await safeParseResponseJson<{
      error?: string | { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    }>(groqRes);

    if (!groqRes.ok || data.error) {
      const errMsg =
        typeof data.error === 'string'
          ? data.error
          : data.error?.message || `HTTP ${groqRes.status}`;
      return NextResponse.json(
        { error: `Groq translation (${llmModel}) error: ${errMsg}` },
        { status: groqRes.ok ? 500 : groqRes.status }
      );
    }

    const rawContent = data.choices?.[0]?.message?.content || '{"cues":[]}';
    let parsed:
      | { cues?: Array<{ index: number; text: string }> }
      | Array<{ index: number; text: string }> = { cues: [] };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = { cues: [] };
    }
    const translatedList: Array<{ index: number; text: string }> = Array.isArray(
      (parsed as { cues?: Array<{ index: number; text: string }> }).cues
    )
      ? (parsed as { cues: Array<{ index: number; text: string }> }).cues
      : Array.isArray(parsed)
        ? parsed
        : [];

    const updatedCues = applyProofreadOrTranslatedCues(
      cues,
      translatedList,
      isHinglish
    );

    return NextResponse.json({
      cues: updatedCues,
      modelUsed: llmModel,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Groq subtitle translation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
