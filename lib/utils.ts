import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function safeParseResponseJson<T = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const rawText = await res.text()
  const trimmed = rawText.trim()
  if (!trimmed) {
    return { error: `Empty response from server (HTTP ${res.status}).` } as unknown as T
  }
  if (trimmed.startsWith("<")) {
    return {
      error:
        res.status === 413
          ? "Uploaded media file is too large for a single request. Please use a shorter clip or compressed audio."
          : `Server returned an unexpected HTML status page (HTTP ${res.status}). Please retry in a moment.`,
    } as unknown as T
  }
  try {
    return JSON.parse(trimmed) as T
  } catch {
    return {
      error: `Invalid JSON response (HTTP ${res.status}): ${trimmed.slice(0, 140)}`,
    } as unknown as T
  }
}
