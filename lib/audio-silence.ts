export interface SilentRegion {
  start: number;
  end: number;
  duration: number;
}

export interface SilenceAnalysisResult {
  totalDuration: number;
  silentRegions: SilentRegion[];
  keptRegions: SilentRegion[];
  totalSilenceRemovedSeconds: number;
  percentageSaved: number;
  waveformPeaks: number[];
}

export function detectSilencesFromSamples(
  samples: Float32Array,
  sampleRate: number,
  thresholdDb = -35,
  minSilenceDuration = 0.35,
  paddingSeconds = 0.06
): SilenceAnalysisResult {
  const totalDuration = sampleRate > 0 ? samples.length / sampleRate : 0;
  if (samples.length === 0 || sampleRate <= 0) {
    return {
      totalDuration: 0,
      silentRegions: [],
      keptRegions: [],
      totalSilenceRemovedSeconds: 0,
      percentageSaved: 0,
      waveformPeaks: [],
    };
  }

  const thresholdAmplitude = Math.pow(10, thresholdDb / 20);
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.02)); // 20ms windows
  const numWindows = Math.ceil(samples.length / windowSize);

  const isWindowSilent: boolean[] = new Array(numWindows).fill(false);
  const rmsValues: number[] = new Array(numWindows).fill(0);

  for (let w = 0; w < numWindows; w++) {
    const startIdx = w * windowSize;
    const endIdx = Math.min(samples.length, startIdx + windowSize);
    let sumSq = 0;
    for (let i = startIdx; i < endIdx; i++) {
      const val = samples[i];
      sumSq += val * val;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, endIdx - startIdx));
    rmsValues[w] = rms;
    isWindowSilent[w] = rms < thresholdAmplitude;
  }

  // Downsample rmsValues to 64 peaks for real-time waveform visualization
  const peakBuckets = 64;
  const waveformPeaks: number[] = [];
  const windowsPerBucket = Math.max(1, Math.floor(numWindows / peakBuckets));
  for (let b = 0; b < peakBuckets; b++) {
    const wStart = b * windowsPerBucket;
    const wEnd = Math.min(numWindows, wStart + windowsPerBucket);
    let maxVal = 0;
    for (let w = wStart; w < wEnd; w++) {
      if (rmsValues[w] > maxVal) maxVal = rmsValues[w];
    }
    waveformPeaks.push(Number(Math.min(1, maxVal * 3.5).toFixed(3)));
  }

  const silentRegions: SilentRegion[] = [];
  let silenceStartWindow = -1;

  for (let w = 0; w < numWindows; w++) {
    if (isWindowSilent[w]) {
      if (silenceStartWindow === -1) silenceStartWindow = w;
    } else if (silenceStartWindow !== -1) {
      const rawStart = (silenceStartWindow * windowSize) / sampleRate;
      const rawEnd = (w * windowSize) / sampleRate;
      const paddedStart = Math.min(rawEnd, rawStart + paddingSeconds);
      const paddedEnd = Math.max(paddedStart, rawEnd - paddingSeconds);
      if (paddedEnd - paddedStart >= minSilenceDuration) {
        silentRegions.push({
          start: Number(paddedStart.toFixed(3)),
          end: Number(paddedEnd.toFixed(3)),
          duration: Number((paddedEnd - paddedStart).toFixed(3)),
        });
      }
      silenceStartWindow = -1;
    }
  }

  if (silenceStartWindow !== -1) {
    const rawStart = (silenceStartWindow * windowSize) / sampleRate;
    const rawEnd = totalDuration;
    const paddedStart = Math.min(rawEnd, rawStart + paddingSeconds);
    const paddedEnd = Math.max(paddedStart, rawEnd - paddingSeconds);
    if (paddedEnd - paddedStart >= minSilenceDuration) {
      silentRegions.push({
        start: Number(paddedStart.toFixed(3)),
        end: Number(paddedEnd.toFixed(3)),
        duration: Number((paddedEnd - paddedStart).toFixed(3)),
      });
    }
  }

  const keptRegions: SilentRegion[] = [];
  let cursor = 0;
  for (const sil of silentRegions) {
    if (sil.start > cursor + 0.02) {
      keptRegions.push({
        start: Number(cursor.toFixed(3)),
        end: Number(sil.start.toFixed(3)),
        duration: Number((sil.start - cursor).toFixed(3)),
      });
    }
    cursor = sil.end;
  }
  if (cursor < totalDuration - 0.02) {
    keptRegions.push({
      start: Number(cursor.toFixed(3)),
      end: Number(totalDuration.toFixed(3)),
      duration: Number((totalDuration - cursor).toFixed(3)),
    });
  }

  const totalSilenceRemovedSeconds = Number(
    silentRegions.reduce((acc, r) => acc + r.duration, 0).toFixed(2)
  );
  const percentageSaved =
    totalDuration > 0
      ? Number(((totalSilenceRemovedSeconds / totalDuration) * 100).toFixed(1))
      : 0;

  return {
    totalDuration: Number(totalDuration.toFixed(2)),
    silentRegions,
    keptRegions,
    totalSilenceRemovedSeconds,
    percentageSaved,
    waveformPeaks,
  };
}

export function encodeTrimmedWav(
  samples: Float32Array,
  sampleRate: number,
  keptRegions: SilentRegion[]
): Uint8Array {
  const regions =
    keptRegions.length > 0
      ? keptRegions
      : [{ start: 0, end: samples.length / sampleRate, duration: samples.length / sampleRate }];

  let totalSamples = 0;
  const slices: Array<{ startIdx: number; endIdx: number }> = [];
  for (const reg of regions) {
    const startIdx = Math.max(0, Math.floor(reg.start * sampleRate));
    const endIdx = Math.min(samples.length, Math.floor(reg.end * sampleRate));
    if (endIdx > startIdx) {
      slices.push({ startIdx, endIdx });
      totalSamples += endIdx - startIdx;
    }
  }

  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  let offset = 44;
  for (const slice of slices) {
    for (let i = slice.startIdx; i < slice.endIdx; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(
        offset,
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}

export function exportKeptRegionsToEdl(
  keptRegions: SilentRegion[],
  clipName = 'SOURCE_CLIP',
  fps = 30
): string {
  const toSmpte = (sec: number) => {
    const totalFrames = Math.round(Math.max(0, sec) * fps);
    const f = totalFrames % fps;
    const totalSec = Math.floor(totalFrames / fps);
    const s = totalSec % 60;
    const m = Math.floor(totalSec / 60) % 60;
    const h = Math.floor(totalSec / 3600);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
  };

  const lines = [
    `TITLE: CaptionX Silence Cut List`,
    `FCM: NON-DROP FRAME`,
    ``,
  ];

  let recordCursor = 0;
  keptRegions.forEach((reg, idx) => {
    const eventNum = String(idx + 1).padStart(3, '0');
    const srcIn = toSmpte(reg.start);
    const srcOut = toSmpte(reg.end);
    const recIn = toSmpte(recordCursor);
    const recOut = toSmpte(recordCursor + reg.duration);
    recordCursor += reg.duration;

    lines.push(
      `${eventNum}  AX       AA/V  C        ${srcIn} ${srcOut} ${recIn} ${recOut}`
    );
    lines.push(`* FROM CLIP NAME: ${clipName}`);
  });

  return lines.join('\n');
}
