import { NextRequest, NextResponse } from 'next/server';
import { GROQ_API_BASE, getGroqApiKey } from '@/lib/groq';
import {
  CaptionCue,
  buildContinuousCuesFromWhisper,
  getWhisperIsoLanguageCode,
  applyProofreadOrTranslatedCues,
} from '@/lib/subtitles';
import { safeParseResponseJson } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const apiKey = getGroqApiKey();
    const contentType = req.headers.get('content-type') || '';

    let fileBlob: Blob | null = null;
    let fileName = 'audio.wav';
    let mimeType = 'audio/wav';
    let language = 'hinglish';
    let sttModel = 'whisper-large-v3';
    let llmModel = 'openai/gpt-oss-120b';
    let maxWordsPerLine = 4;

    if (contentType.includes('multipart/form-data')) {
      const incomingForm = await req.formData();
      const uploaded = incomingForm.get('file');
      if (uploaded && uploaded instanceof Blob) {
        fileBlob = uploaded;
        mimeType = uploaded.type || 'audio/wav';
        if ('name' in uploaded && typeof uploaded.name === 'string') {
          fileName = uploaded.name;
        }
      }
      language = String(incomingForm.get('language') || 'hinglish');
      sttModel = String(incomingForm.get('sttModel') || 'whisper-large-v3');
      llmModel = String(incomingForm.get('llmModel') || 'openai/gpt-oss-120b');
      maxWordsPerLine = Number(incomingForm.get('maxWordsPerLine') || 4);
    } else {
      const rawBody = await req.text();
      if (!rawBody || rawBody.trim().startsWith('<')) {
        return NextResponse.json(
          { error: 'Invalid request body sent to transcription endpoint.' },
          { status: 400 }
        );
      }
      const body = JSON.parse(rawBody);
      const audioBase64 = body.audioBase64;
      mimeType = body.mimeType || 'audio/wav';
      fileName = body.fileName || 'audio.wav';
      language = body.language || 'hinglish';
      sttModel = body.sttModel || 'whisper-large-v3';
      llmModel = body.llmModel || 'openai/gpt-oss-120b';
      maxWordsPerLine = Number(body.maxWordsPerLine || 4);

      if (audioBase64 && typeof audioBase64 === 'string') {
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        fileBlob = new Blob([audioBuffer], { type: mimeType });
      }
    }

    if (!fileBlob) {
      return NextResponse.json(
        { error: 'Missing audio or video data for Groq Whisper transcription.' },
        { status: 400 }
      );
    }

    const ext = fileName.includes('.')
      ? fileName.split('.').pop() || 'wav'
      : mimeType.includes('mp4')
        ? 'mp4'
        : mimeType.includes('mpeg') || mimeType.includes('mp3')
          ? 'mp3'
          : mimeType.includes('webm')
            ? 'webm'
            : 'wav';

    const chosenWhisperModel =
      sttModel === 'whisper-large-v3-turbo'
        ? 'whisper-large-v3-turbo'
        : 'whisper-large-v3';

    const form = new FormData();
    form.append('file', fileBlob, `upload.${ext}`);
    form.append('model', chosenWhisperModel);
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');
    form.append('timestamp_granularities[]', 'word');
    form.append('timestamp_granularities[]', 'segment');

    const isoCode = getWhisperIsoLanguageCode(language);
    if (isoCode) {
      form.append('language', isoCode);
    }

    const isHinglish = language.toLowerCase().includes('hinglish');
    if (isHinglish || isoCode === 'hi') {
      form.append(
        'prompt',
        'नमस्ते दोस्तों, आज हम बात करेंगे वीडियो कैप्शन, टाइमिंग और एडिटिंग के बारे में। Aaj hum baat karenge video captions aur sahi spelling ke baare mein.'
      );
    }

    const sttRes = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    const whisperData = await safeParseResponseJson<{
      error?: string | { message?: string };
      language?: string;
      words?: Array<{ word: string; start: number; end: number }>;
      segments?: Array<{ start: number; end: number; text: string }>;
    }>(sttRes);

    if (!sttRes.ok || whisperData.error) {
      const errMsg =
        typeof whisperData.error === 'string'
          ? whisperData.error
          : whisperData.error?.message || `HTTP ${sttRes.status}`;
      return NextResponse.json(
        { error: `Groq Whisper (${chosenWhisperModel}) error: ${errMsg}` },
        { status: sttRes.ok ? 500 : sttRes.status }
      );
    }

    const rawWords = Array.isArray(whisperData.words) ? whisperData.words : [];
    const rawSegments = Array.isArray(whisperData.segments)
      ? whisperData.segments
      : [];

    let initialCues: CaptionCue[] = buildContinuousCuesFromWhisper(
      rawWords,
      rawSegments,
      Math.max(1, maxWordsPerLine || 4)
    );

    if (initialCues.length > 0) {
      const systemRule = isHinglish
        ? 'You are an expert Indian Hinglish subtitle proofreader and phonetic romanizer. CRITICAL RULES: 1) Convert any Devanagari Hindi words into natural, accurately spelled Roman Hinglish (e.g. "आज हम बात करेंगे" -> "Aaj hum baat karenge", "चलते चलते" -> "chalte chalte", "स्पेलिंग मिस्टेक्स" -> "spelling mistakes"). 2) NEVER translate Hindi sentences into English sentences! Keep the exact spoken Hindi/Hinglish words. 3) Fix all phonetic spelling mistakes and spell English loanwords with correct standard English spelling (e.g. video, caption, export, render, timing, phone, website, button). 4) Never skip, merge, or delete any cue index. Return strictly valid JSON {"cues":[{"index":0,"text":"..."}]}.'
        : language === 'auto' ||
            language.toLowerCase().includes('english') ||
            language.toLowerCase().includes('hindi')
          ? `You are an expert subtitle proofreader for ${language === 'auto' ? 'spoken audio' : language}. Fix all spelling mistakes, phonetic transcription errors, and broken words in each cue while keeping the exact same spoken language, word count, and cue index. Do NOT translate or delete any cue. Return strictly valid JSON {"cues":[{"index":0,"text":"..."}]}.`
          : `You are a precision subtitle translator and proofreader. Translate each cue into ${language} with 100% accurate spelling while preserving exact index numbers. Return strictly valid JSON {"cues":[{"index":0,"text":"..."}]}.`;

      try {
        const llmRes = await fetch(`${GROQ_API_BASE}/chat/completions`, {
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
                content: systemRule,
              },
              {
                role: 'user',
                content: JSON.stringify({
                  cues: initialCues.map((c, idx) => ({
                    index: idx,
                    text: c.text,
                  })),
                }),
              },
            ],
          }),
        });

        if (llmRes.ok) {
          const llmJson = await safeParseResponseJson<{
            choices?: Array<{ message?: { content?: string } }>;
          }>(llmRes);
          const contentStr = llmJson.choices?.[0]?.message?.content || '{}';
          const parsedObj = JSON.parse(contentStr);
          const list = Array.isArray(parsedObj.cues) ? parsedObj.cues : [];
          initialCues = applyProofreadOrTranslatedCues(
            initialCues,
            list,
            isHinglish
          );
        } else if (isHinglish) {
          initialCues = applyProofreadOrTranslatedCues(initialCues, [], true);
        }
      } catch {
        if (isHinglish) {
          initialCues = applyProofreadOrTranslatedCues(initialCues, [], true);
        }
      }
    }

    return NextResponse.json({
      cues: initialCues,
      detectedLanguage: whisperData.language || language,
      modelUsed: chosenWhisperModel,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Groq transcription request failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
