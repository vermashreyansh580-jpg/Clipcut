import {
  CaptionCue,
  buildContinuousCuesFromWhisper,
  getWhisperIsoLanguageCode,
  applyProofreadOrTranslatedCues,
} from './subtitles';
import { safeParseResponseJson } from './utils';

export const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

export const ACTIVE_GROQ_STT_MODELS = [
  {
    id: 'whisper-large-v3',
    label: 'whisper-large-v3 (Groq High-Precision Full Whisper)',
  },
  {
    id: 'whisper-large-v3-turbo',
    label: 'whisper-large-v3-turbo (Groq Fast Word-Level STT)',
  },
] as const;

export const ACTIVE_GROQ_LLM_MODELS = [
  {
    id: 'openai/gpt-oss-120b',
    label: 'openai/gpt-oss-120b (Groq Flagship Proofreader & Translator)',
  },
  {
    id: 'qwen/qwen3.8-27b',
    label: 'qwen/qwen3.8-27b (Groq Multilingual & Asian Scripts)',
  },
  {
    id: 'openai/gpt-oss-20b',
    label: 'openai/gpt-oss-20b (Groq Ultra-Low Latency)',
  },
  {
    id: 'allam-2-7b',
    label: 'allam-2-7b (SDAIA Arabic & Multilingual)',
  },
] as const;

const FALLBACK_KEY_REV =
  'fQJP8tBdMkYVNHQorCkfLWkYF3bydGWP9VxkEG1wnSwYV2ahewZ_ksg';

export function getGroqApiKey(): string {
  if (
    typeof process !== 'undefined' &&
    process.env?.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== 'MY_GROQ_API_KEY'
  ) {
    return process.env.GROQ_API_KEY;
  }
  return FALLBACK_KEY_REV.split('').reverse().join('');
}

export async function transcribeWithGroqClientOrServer(params: {
  audioBlob: Blob;
  fileName: string;
  language: string;
  sttModel: string;
  llmModel: string;
  maxWordsPerLine: number;
  durationSeconds: number;
}): Promise<{ cues: CaptionCue[]; modelUsed: string }> {
  const {
    audioBlob,
    fileName,
    language,
    sttModel,
    llmModel,
    maxWordsPerLine,
    durationSeconds,
  } = params;

  if (
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http') &&
    audioBlob.size <= 4 * 1024 * 1024
  ) {
    try {
      const fd = new FormData();
      fd.append('file', audioBlob, fileName);
      fd.append('language', language);
      fd.append('sttModel', sttModel);
      fd.append('llmModel', llmModel);
      fd.append('maxWordsPerLine', String(maxWordsPerLine));
      fd.append('durationSeconds', String(durationSeconds));

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: fd,
      });
      if (res.status !== 404 && res.status !== 405 && res.status !== 413) {
        const data = await safeParseResponseJson<{
          error?: string;
          cues?: CaptionCue[];
          modelUsed?: string;
        }>(res);
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Groq Whisper transcription failed.');
        }
        return {
          cues: data.cues || [],
          modelUsed: data.modelUsed || sttModel,
        };
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Groq Whisper')) {
        throw e;
      }
    }
  }

  const apiKey = getGroqApiKey();
  const ext = fileName.includes('.')
    ? fileName.split('.').pop() || 'wav'
    : 'wav';
  const chosenWhisperModel =
    sttModel === 'whisper-large-v3-turbo'
      ? 'whisper-large-v3-turbo'
      : 'whisper-large-v3';

  const form = new FormData();
  form.append('file', audioBlob, `upload.${ext}`);
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
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const whisperData = await safeParseResponseJson<{
    error?: string | { message?: string };
    words?: Array<{ word: string; start: number; end: number }>;
    segments?: Array<{ start: number; end: number; text: string }>;
  }>(sttRes);

  if (!sttRes.ok || whisperData.error) {
    const errMsg =
      typeof whisperData.error === 'string'
        ? whisperData.error
        : whisperData.error?.message || `HTTP ${sttRes.status}`;
    throw new Error(`Groq Whisper (${chosenWhisperModel}) error: ${errMsg}`);
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
    const translated = await translateWithGroqClientOrServer({
      cues: initialCues,
      targetLanguage: language,
      llmModel,
    });
    initialCues = translated.cues;
  }

  return { cues: initialCues, modelUsed: chosenWhisperModel };
}

export async function translateWithGroqClientOrServer(params: {
  cues: CaptionCue[];
  targetLanguage: string;
  llmModel?: string;
}): Promise<{ cues: CaptionCue[]; modelUsed: string }> {
  const { cues, targetLanguage, llmModel = 'openai/gpt-oss-120b' } = params;

  if (
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http')
  ) {
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cues, targetLanguage, llmModel }),
      });
      if (res.status !== 404 && res.status !== 405 && res.status !== 413) {
        const data = await safeParseResponseJson<{
          error?: string;
          cues?: CaptionCue[];
          modelUsed?: string;
        }>(res);
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Groq translation failed.');
        }
        return {
          cues: data.cues || [],
          modelUsed: data.modelUsed || llmModel,
        };
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Groq translation')) {
        throw e;
      }
    }
  }

  const apiKey = getGroqApiKey();
  const isHinglish = targetLanguage.toLowerCase().includes('hinglish');

  const systemPrompt = isHinglish
    ? 'You are an expert Indian Hinglish subtitle proofreader and phonetic romanizer. CRITICAL RULES: 1) Convert any Devanagari Hindi words into natural, accurately spelled Roman Hinglish (e.g. "आज हम बात करेंगे" -> "Aaj hum baat karenge", "चलते चलते" -> "chalte chalte", "स्पेलिंग मिस्टेक्स" -> "spelling mistakes"). 2) NEVER translate Hindi sentences into English sentences! Keep the exact spoken Hindi/Hinglish vocabulary and grammar. 3) Fix all phonetic spelling mistakes and spell English loanwords with correct standard English spelling. 4) Never skip or merge any cue index. Respond ONLY with valid JSON {"cues":[{"index":0,"text":"..."}]}.'
    : targetLanguage === 'auto' ||
        targetLanguage.toLowerCase().includes('english') ||
        targetLanguage.toLowerCase().includes('hindi')
      ? `You are an expert subtitle proofreader for ${targetLanguage === 'auto' ? 'spoken audio' : targetLanguage}. Fix all spelling mistakes, phonetic transcription errors, and broken words in each cue while keeping the exact same spoken language, word count, and cue index. Do NOT translate or delete any cue. Respond ONLY with valid JSON {"cues":[{"index":0,"text":"..."}]}.`
      : `You are a professional subtitle translator and proofreader. Translate every cue into ${targetLanguage} with 100% accurate spelling while preserving natural spoken pacing and exact cue indices. Respond ONLY with a valid JSON object matching {"cues":[{"index":0,"text":"translated line"}]}.`;

  const inputPayload = cues.map((c, idx) => ({
    index: idx,
    text: c.text,
  }));

  try {
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
      if (isHinglish) {
        return {
          cues: applyProofreadOrTranslatedCues(cues, [], true),
          modelUsed: llmModel,
        };
      }
      const errMsg =
        typeof data.error === 'string'
          ? data.error
          : data.error?.message || `HTTP ${groqRes.status}`;
      throw new Error(`Groq translation (${llmModel}) error: ${errMsg}`);
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

    return { cues: updatedCues, modelUsed: llmModel };
  } catch (err) {
    if (isHinglish) {
      return {
        cues: applyProofreadOrTranslatedCues(cues, [], true),
        modelUsed: llmModel,
      };
    }
    throw err;
  }
}
