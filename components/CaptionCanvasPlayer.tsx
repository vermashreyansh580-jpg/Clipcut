'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CaptionCue,
  CaptionStyleConfig,
  formatSrtTime,
  sliderValueToYPosition,
  yPositionToSliderValue,
  fixVideoDurationMetadata,
} from '@/lib/subtitles';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Film,
  CheckCircle2,
  Loader2,
  MoveVertical,
} from 'lucide-react';

interface CaptionCanvasPlayerProps {
  mediaUrl: string | null;
  mediaType: 'video' | 'audio' | null;
  mediaFileName: string;
  cues: CaptionCue[];
  styleConfig: CaptionStyleConfig;
  onPositionChange?: (patch: { xPosition?: number; yPosition?: number }) => void;
  aspectRatio: '9:16' | '16:9' | '1:1';
  onAspectRatioChange: (ratio: '9:16' | '16:9' | '1:1') => void;
  currentTime: number;
  duration: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (dur: number) => void;
  isTranscribing?: boolean;
}

export default function CaptionCanvasPlayer({
  mediaUrl,
  mediaType,
  mediaFileName,
  cues,
  styleConfig,
  onPositionChange,
  aspectRatio,
  onAspectRatioChange,
  currentTime,
  duration,
  onTimeUpdate,
  onDurationChange,
  isTranscribing = false,
}: CaptionCanvasPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isDraggingCanvasRef = useRef(false);
  const resolvingDurationRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportedExt, setExportedExt] = useState<'mp4' | 'webm'>('webm');

  const cuesRef = useRef(cues);
  const styleRef = useRef(styleConfig);
  const timeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const exportingRef = useRef(isExportingVideo);
  const playingRef = useRef(isPlaying);
  const transcribingRef = useRef(isTranscribing);

  useEffect(() => {
    cuesRef.current = cues;
    styleRef.current = styleConfig;
    timeRef.current = currentTime;
    durationRef.current = duration;
    exportingRef.current = isExportingVideo;
    playingRef.current = isPlaying;
    transcribingRef.current = isTranscribing;
  }, [cues, styleConfig, currentTime, duration, isExportingVideo, isPlaying, isTranscribing]);

  const getCanvasDimensions = useCallback(() => {
    if (aspectRatio === '9:16') return { width: 720, height: 1280 };
    if (aspectRatio === '1:1') return { width: 720, height: 720 };
    return { width: 1280, height: 720 };
  }, [aspectRatio]);

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, nowSec: number) => {
      const style = styleRef.current;
      const activeCues = cuesRef.current;

      // 1. Background / Video layer (Strictly NO watermark, optimized single-pass render)
      ctx.fillStyle = '#0B1120';
      ctx.fillRect(0, 0, width, height);

      const vid = videoRef.current;
      if (mediaType === 'video' && vid && vid.readyState >= 2) {
        const vw = vid.videoWidth || width;
        const vh = vid.videoHeight || height;
        const scale = Math.min(width / vw, height / vh);
        const drawW = vw * scale;
        const drawH = vh * scale;
        const offsetX = (width - drawW) / 2;
        const offsetY = (height - drawH) / 2;

        // Only draw ambient fill if video does not already cover at least 92% of the canvas
        if (drawW < width * 0.92 || drawH < height * 0.92) {
          ctx.save();
          ctx.globalAlpha = 0.22;
          const coverScale = Math.max(width / vw, height / vh);
          ctx.drawImage(
            vid,
            (width - vw * coverScale) / 2,
            (height - vh * coverScale) / 2,
            vw * coverScale,
            vh * coverScale
          );
          ctx.restore();
        }

        ctx.drawImage(vid, offsetX, offsetY, drawW, drawH);
      } else {
        // Clean studio slate background for audio-only lyric videos or SRT preview
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#0F172A');
        grad.addColorStop(1, '#1E293B');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        if (mediaType === 'audio') {
          const barCount = 24;
          const totalBarW = width * 0.55;
          const startX = (width - totalBarW) / 2;
          const barW = (totalBarW / barCount) * 0.6;
          const gap = (totalBarW / barCount) * 0.4;
          const centerY = height * 0.42;

          ctx.fillStyle = 'rgba(29, 92, 255, 0.45)';
          for (let i = 0; i < barCount; i++) {
            const wave =
              Math.sin(nowSec * 6 + i * 0.55) * 0.4 +
              Math.cos(nowSec * 3.5 - i * 0.3) * 0.35 +
              0.3;
            const barH = Math.max(8, wave * (height * 0.14));
            ctx.beginPath();
            ctx.roundRect(
              startX + i * (barW + gap),
              centerY - barH / 2,
              barW,
              barH,
              4
            );
            ctx.fill();
          }
        }
      }

      // 2. Find current active cue (with 1.8s continuous voiceover hold so captions never flicker between phrases)
      let activeCue = activeCues.find(
        (c) => nowSec >= c.start - 0.05 && nowSec <= c.end + 0.05
      );
      if (!activeCue && activeCues.length > 0) {
        activeCue = activeCues.find(
          (c, idx) =>
            nowSec > c.end &&
            nowSec - c.end <= 1.8 &&
            (!activeCues[idx + 1] || nowSec < activeCues[idx + 1].start)
        );
      }
      if (!activeCue && !exportingRef.current && !playingRef.current) {
        if (activeCues.length > 0) {
          activeCue = activeCues[0];
        } else {
          activeCue = {
            id: 'preview-guide',
            index: 1,
            start: 0,
            end: 9999,
            text: transcribingRef.current
              ? 'Generating AI Captions…'
              : 'पॉइंटर स्लाइड करें · Caption Position',
            words: transcribingRef.current
              ? [
                  { word: 'Generating', start: 0, end: 9999 },
                  { word: 'AI', start: 9999, end: 9999 },
                  { word: 'Captions…', start: 9999, end: 9999 },
                ]
              : [
                  { word: 'पॉइंटर', start: 0, end: 9999 },
                  { word: 'स्लाइड', start: 9999, end: 9999 },
                  { word: 'करें', start: 9999, end: 9999 },
                ],
          };
        }
      }
      if (!activeCue) return;

      const words =
        activeCue.words && activeCue.words.length > 0
          ? activeCue.words
          : [{ word: activeCue.text, start: activeCue.start, end: activeCue.end }];

      const scaleFactor = width / 680;
      const computedFontSize = Math.max(
        28,
        Math.round(style.fontSize * scaleFactor)
      );
      const fontWeight = style.preset === 'editorial-clean' ? '600' : '800';
      ctx.font = `${fontWeight} ${computedFontSize}px "${style.fontFamily}", sans-serif`;
      ctx.textBaseline = 'middle';

      const spaceWidth = ctx.measureText(' ').width * 1.15;
      const maxLineWidth = width * 0.86;

      interface MeasuredWord {
        text: string;
        width: number;
        isActive: boolean;
        isPast: boolean;
        progress: number;
      }

      const measuredWords: MeasuredWord[] = words.map((w) => {
        const displayWord = style.uppercase ? w.word.toUpperCase() : w.word;
        const wWidth = ctx.measureText(displayWord).width;
        const isActive = nowSec >= w.start - 0.04 && nowSec <= w.end + 0.04;
        const isPast = nowSec > w.end;
        const wordDur = Math.max(0.05, w.end - w.start);
        const progress = isActive
          ? Math.min(1, Math.max(0, (nowSec - w.start) / wordDur))
          : 0;
        return {
          text: displayWord,
          width: wWidth,
          isActive,
          isPast,
          progress,
        };
      });

      const lines: MeasuredWord[][] = [];
      let currentLine: MeasuredWord[] = [];
      let currentLineWidth = 0;

      for (const mw of measuredWords) {
        const addedWidth =
          currentLine.length === 0 ? mw.width : currentLineWidth + spaceWidth + mw.width;
        if (
          (addedWidth > maxLineWidth ||
            currentLine.length >= style.maxWordsPerLine) &&
          currentLine.length > 0
        ) {
          lines.push(currentLine);
          currentLine = [mw];
          currentLineWidth = mw.width;
        } else {
          currentLine.push(mw);
          currentLineWidth = addedWidth;
        }
      }
      if (currentLine.length > 0) lines.push(currentLine);

      const lineHeight = computedFontSize * 1.32;
      const totalBlockHeight = lines.length * lineHeight;
      const xPosPct = style.xPosition ?? 50;
      const anchorX = (width * xPosPct) / 100;
      const baseY = (height * style.yPosition) / 100 - totalBlockHeight / 2;

      if (style.boxBgColor && style.boxBgColor !== 'transparent') {
        const widestLine = Math.max(
          ...lines.map((line) =>
            line.reduce(
              (acc, w, idx) => acc + w.width + (idx > 0 ? spaceWidth : 0),
              0
            )
          )
        );
        const padX = computedFontSize * 0.55;
        const padY = computedFontSize * 0.35;
        ctx.save();
        ctx.fillStyle = style.boxBgColor;
        ctx.beginPath();
        ctx.roundRect(
          anchorX - widestLine / 2 - padX,
          baseY - padY,
          widestLine + padX * 2,
          totalBlockHeight + padY * 2,
          14
        );
        ctx.fill();
        ctx.restore();
      }

      lines.forEach((line, lineIdx) => {
        const lineW = line.reduce(
          (acc, w, idx) => acc + w.width + (idx > 0 ? spaceWidth : 0),
          0
        );
        let cursorX = anchorX - lineW / 2;
        const centerY = baseY + lineIdx * lineHeight + lineHeight / 2;

        line.forEach((mw) => {
          ctx.save();
          const wordCenterX = cursorX + mw.width / 2;

          let wordScale = 1;
          if (mw.isActive) {
            const popBoost =
              style.animationIntensity === 'dynamic'
                ? 0.14
                : style.animationIntensity === 'medium'
                  ? 0.08
                  : 0.04;
            const bounce = Math.sin(mw.progress * Math.PI);
            wordScale = 1 + popBoost * bounce;
          }

          if (wordScale !== 1) {
            ctx.translate(wordCenterX, centerY);
            ctx.scale(wordScale, wordScale);
            ctx.translate(-wordCenterX, -centerY);
          }

          if (
            mw.isActive &&
            style.activeBgColor &&
            style.activeBgColor !== 'transparent'
          ) {
            const pillPadX = computedFontSize * 0.24;
            const pillPadY = computedFontSize * 0.16;
            ctx.fillStyle = style.activeBgColor;
            ctx.beginPath();
            ctx.roundRect(
              cursorX - pillPadX,
              centerY - computedFontSize / 2 - pillPadY,
              mw.width + pillPadX * 2,
              computedFontSize + pillPadY * 2,
              10
            );
            ctx.fill();
          }

          if (style.strokeWidth > 0 && style.strokeColor !== 'transparent') {
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.lineWidth = Math.max(2, style.strokeWidth * scaleFactor);
            ctx.strokeStyle = style.strokeColor;
            ctx.strokeText(mw.text, cursorX, centerY);
          }

          if (style.preset === 'karaoke-glow') {
            ctx.fillStyle =
              mw.isActive || mw.isPast ? style.activeWordColor : style.textColor;
          } else {
            ctx.fillStyle = mw.isActive
              ? style.activeWordColor
              : style.textColor;
          }

          ctx.fillText(mw.text, cursorX, centerY);
          ctx.restore();

          cursorX += mw.width + spaceWidth;
        });
      });
    },
    [mediaType]
  );

  // Redraw when style, cues, aspect ratio, or paused scrub position changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const { width, height } = getCanvasDimensions();
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (!playingRef.current && !exportingRef.current) {
      drawFrame(ctx, width, height, currentTime);
    }
  }, [currentTime, styleConfig, cues, aspectRatio, isTranscribing, getCanvasDimensions, drawFrame]);

  // Also force an immediate canvas draw whenever `cues` or `styleConfig` updates even while playing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const vid = videoRef.current;
    const aud = audioRef.current;
    const nowT =
      mediaType === 'video' && vid && !vid.paused
        ? vid.currentTime
        : mediaType === 'audio' && aud && !aud.paused
          ? aud.currentTime
          : timeRef.current;
    drawFrame(ctx, canvas.width, canvas.height, nowT);
  }, [cues, styleConfig, mediaType, drawFrame]);

  // High-FPS playback loop decoupled from parent React state re-renders (throttles onTimeUpdate to 8Hz)
  useEffect(() => {
    if (!isPlaying || isExportingVideo) return;

    let rafId = 0;
    let lastTimestamp = performance.now();
    let lastUiSync = 0;

    const tick = (now: number) => {
      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      const vid = videoRef.current;
      const aud = audioRef.current;

      let nextTime = timeRef.current;
      if (mediaType === 'video' && vid && !vid.paused) {
        nextTime = vid.currentTime;
      } else if (mediaType === 'audio' && aud && !aud.paused) {
        nextTime = aud.currentTime;
      } else {
        const maxDur = Math.max(1, durationRef.current);
        nextTime = timeRef.current + dt;
        if (nextTime >= maxDur) {
          nextTime = 0;
          setIsPlaying(false);
        }
      }

      timeRef.current = nextTime;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          drawFrame(ctx, canvas.width, canvas.height, nextTime);
        }
      }

      if (now - lastUiSync >= 120) {
        lastUiSync = now;
        onTimeUpdate(nextTime);
      }

      if (playingRef.current && !exportingRef.current) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isExportingVideo, mediaType, onTimeUpdate, drawFrame]);

  // Resolve real duration on mobile when <video> / <audio> reports Infinity or 0
  const resolveMediaElementDuration = useCallback(
    (el: HTMLMediaElement) => {
      const d = el.duration;
      if (Number.isFinite(d) && d > 0) {
        onDurationChange(d);
        return;
      }
      if ((d === Infinity || Number.isNaN(d) || d <= 0) && !resolvingDurationRef.current) {
        resolvingDurationRef.current = true;
        const onSeekUpdate = () => {
          el.removeEventListener('timeupdate', onSeekUpdate);
          if (Number.isFinite(el.duration) && el.duration > 0) {
            onDurationChange(el.duration);
          }
          try {
            el.currentTime = 0;
          } catch {}
          resolvingDurationRef.current = false;
        };
        el.addEventListener('timeupdate', onSeekUpdate);
        try {
          el.currentTime = 1e101;
        } catch {
          el.removeEventListener('timeupdate', onSeekUpdate);
          resolvingDurationRef.current = false;
        }
      }
    },
    [onDurationChange]
  );

  const togglePlay = async () => {
    const vid = videoRef.current;
    const aud = audioRef.current;

    if (isPlaying) {
      if (vid) vid.pause();
      if (aud) aud.pause();
      setIsPlaying(false);
    } else {
      if (currentTime >= duration - 0.1) {
        handleSeek(0);
      }
      if (mediaType === 'video' && vid && mediaUrl) {
        await vid.play().catch(() => {});
      } else if (mediaType === 'audio' && aud && mediaUrl) {
        await aud.play().catch(() => {});
      }
      setIsPlaying(true);
    }
  };

  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(Math.max(1, duration), newTime));
    timeRef.current = clamped;
    if (videoRef.current) videoRef.current.currentTime = clamped;
    if (audioRef.current) audioRef.current.currentTime = clamped;
    onTimeUpdate(clamped);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) drawFrame(ctx, canvas.width, canvas.height, clamped);
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
    if (audioRef.current) audioRef.current.muted = next;
  };

  // Smooth, Hardware-Accelerated Watermark-Free Video Export + Duration Header Patching
  const handleExportWatermarkFreeVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isExportingVideo) return;

    setIsExportingVideo(true);
    exportingRef.current = true;
    setExportProgress(0);
    setExportedVideoUrl(null);

    try {
      const vid = videoRef.current;
      const aud = audioRef.current;
      if (vid) vid.pause();
      if (aud) aud.pause();
      setIsPlaying(false);
      playingRef.current = false;

      const mediaEl = mediaType === 'video' ? vid : mediaType === 'audio' ? aud : null;
      const mediaRealDur =
        mediaEl && Number.isFinite(mediaEl.duration) && mediaEl.duration > 0
          ? mediaEl.duration
          : 0;
      const cueMaxEnd =
        cuesRef.current.length > 0
          ? Math.max(...cuesRef.current.map((c) => c.end))
          : 0;

      const exportDuration = Math.max(
        1,
        mediaRealDur || durationRef.current || cueMaxEnd || 5
      );

      const stream = canvas.captureStream(30);

      // Attach audio track if available
      if (mediaEl && mediaUrl) {
        try {
          const elWithCapture = mediaEl as HTMLMediaElement & {
            captureStream?: () => MediaStream;
            mozCaptureStream?: () => MediaStream;
          };
          const mediaStream =
            elWithCapture.captureStream?.() || elWithCapture.mozCaptureStream?.();
          if (mediaStream) {
            mediaStream.getAudioTracks().forEach((track) => {
              stream.addTrack(track);
            });
          }
        } catch {
          // Visual canvas stream fallback
        }
      }

      // Prefer hardware-accelerated H.264 / MP4 or fast VP8 over slow software VP9 to eliminate export lag
      const mimeTypes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/webm;codecs=vp9,opus',
      ];
      const supportedMime =
        mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const isMp4 = supportedMime.includes('mp4');
      setExportedExt(isMp4 ? 'mp4' : 'webm');

      const recorder = new MediaRecorder(
        stream,
        supportedMime
          ? { mimeType: supportedMime, videoBitsPerSecond: 5_000_000 }
          : { videoBitsPerSecond: 5_000_000 }
      );

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      let recordedDurationSec = exportDuration;

      const exportDonePromise = new Promise<string>((resolve) => {
        recorder.onstop = async () => {
          const rawBlob = new Blob(chunks, {
            type: supportedMime || 'video/webm',
          });
          // Patch WebM EBML Duration (0x4489) or MP4 mvhd/tkhd/mdhd Duration so phones never show 0:00
          const fixedBlob = await fixVideoDurationMetadata(
            rawBlob,
            recordedDurationSec
          );
          const url = URL.createObjectURL(fixedBlob);
          resolve(url);
        };
      });

      // Seek media to 0:00 and wait for seek to settle before starting recorder
      if (mediaEl) {
        mediaEl.currentTime = 0;
        await new Promise<void>((res) => {
          const done = () => {
            mediaEl.removeEventListener('seeked', done);
            res();
          };
          mediaEl.addEventListener('seeked', done);
          setTimeout(done, 180);
        });
      }

      const ctx = canvas.getContext('2d', { alpha: false })!;
      drawFrame(ctx, canvas.width, canvas.height, 0);

      recorder.start(250);
      const startPerf = performance.now();

      if (mediaEl && mediaUrl) {
        await mediaEl.play().catch(() => {});
      }

      let lastPct = 0;

      await new Promise<void>((resolve) => {
        const step = () => {
          const elapsed = (performance.now() - startPerf) / 1000;
          const nowT =
            mediaEl && !mediaEl.paused && !mediaEl.ended
              ? mediaEl.currentTime
              : elapsed;

          drawFrame(ctx, canvas.width, canvas.height, nowT);

          const pct = Math.min(99, Math.round((nowT / exportDuration) * 100));
          if (pct >= lastPct + 2 || pct === 99) {
            lastPct = pct;
            setExportProgress(pct);
          }

          const mediaFinished = mediaEl ? mediaEl.ended : false;
          if (
            mediaFinished ||
            nowT >= exportDuration ||
            elapsed >= exportDuration + 0.35
          ) {
            recordedDurationSec = Math.max(1, nowT || exportDuration);
            resolve();
          } else {
            requestAnimationFrame(step);
          }
        };
        requestAnimationFrame(step);
      });

      if (mediaEl) mediaEl.pause();
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }

      const finalUrl = await exportDonePromise;
      setExportProgress(100);
      setExportedVideoUrl(finalUrl);
      onTimeUpdate(0);

      const ext = isMp4 ? 'mp4' : 'webm';
      const baseName = mediaFileName
        ? mediaFileName.replace(/\.[^.]+$/, '')
        : 'captioned-video';
      const a = document.createElement('a');
      a.href = finalUrl;
      a.download = `${baseName}-no-watermark.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      exportingRef.current = false;
      setIsExportingVideo(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
      {/* Top Player Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium truncate">
          <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="truncate">
            {mediaFileName || 'Live Caption Canvas Preview'}
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="text-emerald-400 font-medium whitespace-nowrap">
            No Watermark
          </span>
        </div>

        {/* Aspect Ratio Selector */}
        <div
          className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800"
          role="group"
          aria-label="Canvas aspect ratio"
        >
          {(['9:16', '16:9', '1:1'] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => onAspectRatioChange(ratio)}
              className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded transition-colors whitespace-nowrap shrink-0 ${
                aspectRatio === ratio
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Offscreen Hardware-Decoded Media Elements (not display:none so mobile browsers keep hardware decoding & duration active) */}
      {mediaUrl && mediaType === 'video' && (
        <video
          ref={videoRef}
          src={mediaUrl}
          preload="auto"
          playsInline
          crossOrigin="anonymous"
          onLoadedMetadata={(e) => resolveMediaElementDuration(e.currentTarget)}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) onDurationChange(d);
          }}
          onLoadedData={() => {
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d', { alpha: false });
              if (ctx) drawFrame(ctx, canvas.width, canvas.height, timeRef.current);
            }
          }}
          onEnded={() => setIsPlaying(false)}
          className="fixed -left-[9999px] top-0 w-1 h-1 opacity-0 pointer-events-none"
        />
      )}
      {mediaUrl && mediaType === 'audio' && (
        <audio
          ref={audioRef}
          src={mediaUrl}
          preload="auto"
          crossOrigin="anonymous"
          onLoadedMetadata={(e) => resolveMediaElementDuration(e.currentTarget)}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) onDurationChange(d);
          }}
          onEnded={() => setIsPlaying(false)}
          className="fixed -left-[9999px] top-0 w-1 h-1 opacity-0 pointer-events-none"
        />
      )}

      {/* Center Canvas Stage (Supports Direct Drag-Anywhere Caption Positioning) */}
      <div className="relative flex-1 flex items-center justify-center p-4 bg-slate-950 min-h-[440px]">
        {isTranscribing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-950/90 border border-blue-700 text-xs font-semibold text-blue-100 shadow-lg">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
            <span>AI Captions Generating & Proofreading Spelling…</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          data-testid="caption-preview-canvas"
          onPointerDown={(e) => {
            if (!onPositionChange) return;
            isDraggingCanvasRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const rect = e.currentTarget.getBoundingClientRect();
            const xPct = Math.round(
              Math.max(15, Math.min(85, ((e.clientX - rect.left) / rect.width) * 100))
            );
            const yPct = Math.round(
              Math.max(10, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100))
            );
            onPositionChange({ xPosition: xPct, yPosition: yPct });
          }}
          onPointerMove={(e) => {
            if (!isDraggingCanvasRef.current || !onPositionChange) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const xPct = Math.round(
              Math.max(15, Math.min(85, ((e.clientX - rect.left) / rect.width) * 100))
            );
            const yPct = Math.round(
              Math.max(10, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100))
            );
            onPositionChange({ xPosition: xPct, yPosition: yPct });
          }}
          onPointerUp={(e) => {
            if (isDraggingCanvasRef.current) {
              isDraggingCanvasRef.current = false;
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {}
            }
          }}
          className={`cursor-grab active:cursor-grabbing touch-none rounded-xl shadow-2xl border border-slate-800/80 transition-all ${
            aspectRatio === '9:16'
              ? 'h-[450px] w-auto aspect-[9/16]'
              : aspectRatio === '1:1'
                ? 'h-[410px] w-auto aspect-square'
                : 'w-full max-w-[600px] h-auto aspect-video'
          }`}
        />
      </div>

      {/* Dedicated Caption Height Pointer Line (Right = Captions Move UP, Left = Captions Move DOWN) */}
      <div className="px-4 py-3 bg-slate-900/95 border-t border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-bold text-white">
            <MoveVertical className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Caption Position Pointer Line (कैप्शन हाइट लाइन)</span>
          </span>
          <span className="font-mono tabular-nums text-[11px] text-blue-300 font-semibold">
            Pointer: {yPositionToSliderValue(styleConfig.yPosition)}% (Right = ऊपर · Left = नीचे)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
            ← नीचे (Bottom)
          </span>
          <input
            type="range"
            aria-label="Caption position pointer line (slide right to move captions up, slide left to move captions down)"
            data-testid="caption-position-pointer-line"
            min={0}
            max={100}
            step={1}
            value={yPositionToSliderValue(styleConfig.yPosition)}
            onChange={(e) => {
              const sliderVal = parseInt(e.target.value, 10);
              onPositionChange?.({
                yPosition: sliderValueToYPosition(sliderVal),
              });
            }}
            className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg cursor-ew-resize"
          />
          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
            ऊपर (Top) →
          </span>
        </div>
      </div>

      {/* Timeline & Transport Controls */}
      <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 space-y-2.5">
        {/* Interactive Cue Timeline Scrubber */}
        <div className="space-y-1">
          <input
            type="range"
            aria-label="Timeline scrubber"
            min={0}
            max={Math.max(1, duration)}
            step={0.05}
            value={Math.min(currentTime, Math.max(1, duration))}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
            <span>{formatSrtTime(currentTime)}</span>
            <span>
              {cues.length} cues · {formatSrtTime(duration)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Play Preview</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSeek(0)}
              aria-label="Restart preview from beginning"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportWatermarkFreeVideo}
            disabled={isExportingVideo || cues.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            {isExportingVideo ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="font-mono tabular-nums">
                  Rendering {exportProgress}%
                </span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export Video (No Watermark)</span>
              </>
            )}
          </button>
        </div>

        {exportedVideoUrl && !isExportingVideo && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/60 border border-emerald-800/70 text-xs text-emerald-200">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Watermark-free video with fixed duration metadata ready.
            </span>
            <a
              href={exportedVideoUrl}
              download={`${(mediaFileName || 'captioned-video').replace(/\.[^.]+$/, '')}-no-watermark.${exportedExt}`}
              className="underline font-semibold text-white hover:text-emerald-300 whitespace-nowrap ml-2"
            >
              Download Again
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
