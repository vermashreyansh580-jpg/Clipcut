import { NextResponse } from 'next/server';
import { GROQ_API_BASE, getGroqApiKey } from '@/lib/groq';
import { safeParseResponseJson } from '@/lib/utils';

export async function GET() {
  try {
    const apiKey = getGroqApiKey();
    const res = await fetch(`${GROQ_API_BASE}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    });

    const data = await safeParseResponseJson<{
      error?: string | { message?: string };
      data?: Array<{
        id: string;
        owned_by?: string;
        active?: boolean;
        context_window?: number;
      }>;
    }>(res);

    if (!res.ok || data.error) {
      const errMsg =
        typeof data.error === 'string'
          ? data.error
          : data.error?.message || `HTTP ${res.status}`;
      return NextResponse.json(
        { error: `Groq models check failed: ${errMsg}` },
        { status: res.ok ? 500 : res.status }
      );
    }

    const rawList = Array.isArray(data.data) ? data.data : [];

    const activeModels = rawList
      .filter((m) => m.active !== false)
      .map((m) => ({
        id: m.id,
        ownedBy: m.owned_by || 'Groq',
        active: m.active ?? true,
        category: m.id.includes('whisper')
          ? 'stt'
          : m.id.includes('orpheus')
            ? 'tts'
            : m.id.includes('guard')
              ? 'safety'
              : 'llm',
      }));

    return NextResponse.json({
      models: activeModels,
      defaultSttModel: 'whisper-large-v3-turbo',
      defaultLlmModel: 'openai/gpt-oss-120b',
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Could not fetch live Groq models.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

