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
  Layers,
} from 'lucide-react';

interface CaptionCanvasPlayerProps {
  mediaUrl: string | null;
  mediaType: 'video' | 'audio' | null;
  mediaFileName: string;
  cues: CaptionCue[];
  styleConfig: CaptionStyleConfig;
  onPositionChange?: (patch: Partial<CaptionStyleConfig>) => void;
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
  const fgMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

  // Draws animated foreground architectural obstacles (skyscraper + bridge pillar + tower) for the built-in Showcase Video
  const drawDemoForegroundObstacles = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    nowSec: number
  ) => {
    ctx.save();
    const parallaxX = Math.sin(nowSec * 0.7) * (width * 0.018);

    // Obstacle 1: Left architectural suspension pillar / column
    const leftW = Math.round(width * 0.15);
    const leftX = Math.round(width * 0.12 - parallaxX * 0.7);
    const leftTop = Math.round(height * 0.28);
    const leftGrad = ctx.createLinearGradient(leftX, leftTop, leftX + leftW, height);
    leftGrad.addColorStop(0, '#0F172A');
    leftGrad.addColorStop(1, '#060A12');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(leftX, leftTop, leftW, height - leftTop);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(leftX, leftTop, leftW, height - leftTop);

    // Obstacle 2: Main central glass skyscraper monument standing in the middle
    const towerW = Math.round(width * 0.27);
    const towerX = Math.round(width * 0.5 - towerW * 0.48 + parallaxX);
    const towerTop = Math.round(height * 0.19);
    const towerH = height - towerTop;

    // Spire & stepped roof crown
    ctx.fillStyle = '#090E1A';
    ctx.fillRect(towerX + towerW * 0.46, towerTop - height * 0.09, towerW * 0.08, height * 0.09);
    ctx.fillRect(towerX + towerW * 0.18, towerTop - height * 0.032, towerW * 0.64, height * 0.032);

    // Main building body gradient
    const bGrad = ctx.createLinearGradient(towerX, towerTop, towerX + towerW, height);
    bGrad.addColorStop(0, '#111C33');
    bGrad.addColorStop(0.5, '#0B1222');
    bGrad.addColorStop(1, '#050811');
    ctx.fillStyle = bGrad;
    ctx.fillRect(towerX, towerTop, towerW, towerH);

    // Architectural cyan rim highlight on building edge
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.48)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(towerX, towerTop, towerW, towerH);

    // Animated skyscraper window grid
    const cols = 5;
    const rows = 15;
    const padX = towerW * 0.12;
    const cellW = (towerW - padX * 2) / cols;
    const cellH = (towerH * 0.85) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c * 3) % 4 !== 0) {
          const pulse = 0.12 + 0.08 * Math.sin(nowSec * 2 + r * 0.7 + c);
          ctx.fillStyle =
            (r + c) % 5 === 0
              ? `rgba(250, 204, 21, ${pulse + 0.08})`
              : `rgba(186, 230, 253, ${pulse})`;
          ctx.fillRect(
            towerX + padX + c * cellW + 3,
            towerTop + 22 + r * cellH,
            cellW - 6,
            cellH - 8
          );
        }
      }
    }

    // Obstacle 3: Right-side tower silhouette
    const sideW = Math.round(width * 0.17);
    const sideX = Math.round(width * 0.75 + parallaxX * 0.5);
    const sideTop = Math.round(height * 0.34);
    ctx.fillStyle = '#070C18';
    ctx.fillRect(sideX, sideTop, sideW, height - sideTop);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sideX, sideTop, sideW, height - sideTop);
    ctx.restore();
  };

  // Extracts foreground building / subject pixels from the video frame inside the caption bounding box
  const prepareVideoForegroundMask = (
    mainCtx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    patchX: number,
    patchY: number,
    patchW: number,
    patchH: number,
    style: CaptionStyleConfig
  ): HTMLCanvasElement | null => {
    const safeX = Math.max(0, Math.floor(patchX));
    const safeY = Math.max(0, Math.floor(patchY));
    const safeW = Math.min(canvasW - safeX, Math.ceil(patchW));
    const safeH = Math.min(canvasH - safeY, Math.ceil(patchH));
    if (safeW <= 4 || safeH <= 4) return null;

    if (!fgMaskCanvasRef.current) {
      fgMaskCanvasRef.current = document.createElement('canvas');
    }
    const fgCanvas = fgMaskCanvasRef.current;
    // Downsample 2x for <0.3ms real-time pixel matting + natural bilinear edge feathering
    const pw = Math.max(2, Math.round(safeW / 2));
    const ph = Math.max(2, Math.round(safeH / 2));
    if (fgCanvas.width !== pw || fgCanvas.height !== ph) {
      fgCanvas.width = pw;
      fgCanvas.height = ph;
    }

    const fgCtx = fgCanvas.getContext('2d', { willReadFrequently: true });
    if (!fgCtx) return null;

    fgCtx.clearRect(0, 0, pw, ph);
    fgCtx.drawImage(mainCtx.canvas, safeX, safeY, safeW, safeH, 0, 0, pw, ph);

    const imgData = fgCtx.getImageData(0, 0, pw, ph);
    const data = imgData.data;

    // Sample sky/background reference from top corners of the patch
    let bgR = 0;
    let bgG = 0;
    let bgB = 0;
    let sampleCount = 0;
    const stepX = Math.max(1, Math.floor(pw / 12));
    for (let x = 0; x < pw; x += stepX) {
      const idxTop = x * 4;
      bgR += data[idxTop];
      bgG += data[idxTop + 1];
      bgB += data[idxTop + 2];
      sampleCount++;
    }
    if (sampleCount > 0) {
      bgR /= sampleCount;
      bgG /= sampleCount;
      bgB /= sampleCount;
    }
    const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

    const thresholdSetting = style.depthThreshold ?? 48;
    const cutoff = Math.max(12, Math.min(130, (100 - thresholdSetting) * 1.15));
    const feather = 22;
    const depthMode = style.depthMode || 'auto-building-sky';

    for (let y = 0; y < ph; y++) {
      const relXCenterWeight =
        depthMode === 'center-portrait'
          ? 1 - Math.abs((y - ph * 0.5) / (ph * 0.7)) * 0.2
          : 1;
      for (let x = 0; x < pw; x++) {
        const i = (y * pw + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        const dR = r - bgR;
        const dG = g - bgG;
        const dB = b - bgB;
        const colorDist = Math.sqrt(dR * dR + dG * dG + dB * dB);

        let fgScore = 0;
        if (depthMode === 'dark-silhouette') {
          fgScore = Math.max(bgLum - lum, colorDist * 0.55);
        } else if (depthMode === 'bright-subject') {
          fgScore = Math.max(lum - bgLum, colorDist * 0.65);
        } else if (depthMode === 'center-portrait') {
          const horizDist = Math.abs(x - pw * 0.5) / (pw * 0.5);
          const centerBoost = Math.max(0, 1 - horizDist * 0.85) * 28;
          fgScore = (colorDist * 0.75 + Math.abs(lum - bgLum) * 0.6) * relXCenterWeight + centerBoost;
        } else {
          const lumDiff = bgLum > 115 ? bgLum - lum : Math.abs(lum - bgLum);
          fgScore = Math.max(lumDiff * 1.15, colorDist * 0.72);
        }

        if (fgScore <= cutoff - feather) {
          data[i + 3] = 0;
        } else if (fgScore >= cutoff + feather) {
          data[i + 3] = 255;
        } else {
          const t = (fgScore - (cutoff - feather)) / (feather * 2);
          data[i + 3] = Math.round(t * t * (3 - 2 * t) * 255);
        }
      }
    }

    fgCtx.putImageData(imgData, 0, 0);
    return fgCanvas;
  };

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, nowSec: number) => {
      const style = styleRef.current;
      const activeCues = cuesRef.current;

      // 1. Background / Video layer (Strictly NO watermark)
      ctx.fillStyle = '#0B1120';
      ctx.fillRect(0, 0, width, height);

      const vid = videoRef.current;
      const hasLiveVideo = mediaType === 'video' && vid && vid.readyState >= 2;

      if (hasLiveVideo && vid) {
        const vw = vid.videoWidth || width;
        const vh = vid.videoHeight || height;
        const scale = Math.min(width / vw, height / vh);
        const drawW = vw * scale;
        const drawH = vh * scale;
        const offsetX = (width - drawW) / 2;
        const offsetY = (height - drawH) / 2;

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
        // Built-in CapTanz Animated Showcase Video Scene (Skyline + Clouds + Light Trails)
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#070B19');
        grad.addColorStop(0.38, '#13203B');
        grad.addColorStop(0.72, '#1E1B4B');
        grad.addColorStop(1, '#090D16');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Animated horizon glow & distant skyline buildings (behind all text)
        const sunGlow = ctx.createRadialGradient(
          width * 0.5,
          height * 0.42,
          10,
          width * 0.5,
          height * 0.42,
          width * 0.65
        );
        sunGlow.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
        sunGlow.addColorStop(0.5, 'rgba(244, 63, 94, 0.10)');
        sunGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, width, height);

        if (mediaType !== 'audio') {
          const bgShift = Math.sin(nowSec * 0.35) * (width * 0.01);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
          ctx.fillRect(width * 0.04 + bgShift, height * 0.44, width * 0.15, height * 0.56);
          ctx.fillRect(width * 0.24 + bgShift, height * 0.38, width * 0.14, height * 0.62);
          ctx.fillRect(width * 0.61 + bgShift, height * 0.41, width * 0.15, height * 0.59);
          ctx.fillRect(width * 0.82 + bgShift, height * 0.46, width * 0.14, height * 0.54);
        }

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

      // 2. Find current active cue (with 1.8s continuous voiceover hold so captions never flicker)
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
            end: 6,
            text: transcribingRef.current
              ? 'Generating AI Captions…'
              : style.depthBehindSubject
                ? 'KUCH PICHE KUCH AAGE'
                : 'CAPTANZ 3D STUDIO',
            words: transcribingRef.current
              ? [
                  { word: 'Generating', start: 0, end: 2 },
                  { word: 'AI', start: 2, end: 4 },
                  { word: 'Captions…', start: 4, end: 6 },
                ]
              : style.depthBehindSubject
                ? [
                    { word: 'KUCH', start: 0, end: 1.5 },
                    { word: 'PICHE', start: 1.5, end: 3 },
                    { word: 'KUCH', start: 3, end: 4.5 },
                    { word: 'AAGE', start: 4.5, end: 6 },
                  ]
                : [
                    { word: 'CAPTANZ', start: 0, end: 2 },
                    { word: '3D', start: 2, end: 4 },
                    { word: 'STUDIO', start: 4, end: 6 },
                  ],
          };
        }
      }
      if (!activeCue) {
        if (!hasLiveVideo && style.depthBehindSubject && mediaType !== 'audio') {
          drawDemoForegroundObstacles(ctx, width, height, nowSec);
        }
        return;
      }

      const cueDur = Math.max(0.25, activeCue.end - activeCue.start);
      const rawCueProgress =
        activeCue.id === 'preview-guide'
          ? (nowSec % 4) / 4
          : Math.min(1, Math.max(0, (nowSec - activeCue.start) / cueDur));

      const words =
        activeCue.words && activeCue.words.length > 0
          ? activeCue.words
          : [{ word: activeCue.text, start: activeCue.start, end: activeCue.end }];

      const scaleFactor = width / 680;
      const computedFontSize = Math.max(
        26,
        Math.round(style.fontSize * scaleFactor)
      );
      const fontWeight =
        style.fontFamily === 'Bebas Neue' || style.fontFamily === 'Anton'
          ? '400'
          : style.preset === 'editorial-clean'
            ? '600'
            : '800';

      ctx.save();
      ctx.font = `${fontWeight} ${computedFontSize}px "${style.fontFamily}", sans-serif`;
      ctx.textBaseline = 'middle';

      const trackingPx = Math.round((style.letterSpacing || 0) * scaleFactor);
      if ('letterSpacing' in ctx) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
          `${trackingPx}px`;
      }

      const spaceWidth = ctx.measureText(' ').width * 1.18 + trackingPx;
      const maxLineWidth = width * 0.88;

      interface MeasuredWord {
        text: string;
        width: number;
        isActive: boolean;
        isPast: boolean;
        progress: number;
        wordIndex: number;
      }

      const anyWordDirectlyActive = words.some(
        (w) => nowSec >= w.start - 0.04 && nowSec <= w.end + 0.04
      );

      const measuredWords: MeasuredWord[] = words.map((w, wordIndex) => {
        const rawText = style.uppercase ? w.word.toUpperCase() : w.word;
        const isActive =
          activeCue.id === 'preview-guide'
            ? wordIndex === Math.min(1, words.length - 1)
            : anyWordDirectlyActive
              ? nowSec >= w.start - 0.04 && nowSec <= w.end + 0.04
              : wordIndex === Math.min(1, words.length - 1);
        const isPast =
          activeCue.id === 'preview-guide' ? wordIndex === 0 : nowSec > w.end;
        const wordDur = Math.max(0.05, w.end - w.start);
        const progress =
          activeCue.id === 'preview-guide'
            ? 0.5
            : isActive
              ? Math.min(1, Math.max(0, (nowSec - w.start) / wordDur))
              : isPast
                ? 1
                : 0;

        let displayWord = rawText;
        if (style.animationStyle === 'typewriter' && activeCue.id !== 'preview-guide') {
          if (!isPast && !isActive) {
            displayWord = '';
          } else if (isActive) {
            const charCount = Math.max(
              1,
              Math.ceil(rawText.length * Math.min(1, progress * 1.25))
            );
            displayWord = `${rawText.slice(0, charCount)}▌`;
          }
        }

        const wWidth =
          ctx.measureText(rawText).width + rawText.length * trackingPx * 0.15;

        return {
          text: displayWord,
          width: wWidth,
          isActive,
          isPast,
          progress,
          wordIndex,
        };
      });

      const lines: MeasuredWord[][] = [];
      let currentLine: MeasuredWord[] = [];
      let currentLineWidth = 0;

      for (const mw of measuredWords) {
        const addedWidth =
          currentLine.length === 0
            ? mw.width
            : currentLineWidth + spaceWidth + mw.width;
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

      // Compute Cinematic Crossing / Parallax Offset (for crossing behind & in front of obstacles)
      const crossDir = style.crossDirection || 'none';
      const speedRatio = (style.crossSpeed ?? 55) / 100;
      let crossOffsetX = 0;
      let crossOffsetY = 0;
      let crossScale = 1;

      if (crossDir === 'left-to-right') {
        const travel = width * (0.18 + speedRatio * 0.28);
        crossOffsetX = -travel * 0.5 + rawCueProgress * travel;
      } else if (crossDir === 'right-to-left') {
        const travel = width * (0.18 + speedRatio * 0.28);
        crossOffsetX = travel * 0.5 - rawCueProgress * travel;
      } else if (crossDir === 'rise-up') {
        const travelY = height * (0.08 + speedRatio * 0.14);
        crossOffsetY = travelY * 0.65 - rawCueProgress * travelY;
      } else if (crossDir === 'slow-zoom') {
        crossScale = 0.92 + rawCueProgress * 0.16 * (0.5 + speedRatio);
      }

      const lineHeight = computedFontSize * 1.3;
      const totalBlockHeight = lines.length * lineHeight;
      const xPosPct = style.xPosition ?? 50;
      const anchorX = (width * xPosPct) / 100 + crossOffsetX;
      const baseY =
        (height * style.yPosition) / 100 - totalBlockHeight / 2 + crossOffsetY;

      const widestLine = Math.max(
        40,
        ...lines.map((line) =>
          line.reduce(
            (acc, w, idx) => acc + w.width + (idx > 0 ? spaceWidth : 0),
            0
          )
        )
      );

      // Capture foreground obstacle mask from live video BEFORE drawing text
      const padBoundX = computedFontSize * 1.2;
      const padBoundY = computedFontSize * 0.9;
      const patchX = anchorX - widestLine / 2 - padBoundX;
      const patchY = baseY - padBoundY;
      const patchW = widestLine + padBoundX * 2;
      const patchH = totalBlockHeight + padBoundY * 2;

      let fgMaskCanvas: HTMLCanvasElement | null = null;
      if (style.depthBehindSubject && hasLiveVideo) {
        fgMaskCanvas = prepareVideoForegroundMask(
          ctx,
          width,
          height,
          patchX,
          patchY,
          patchW,
          patchH,
          style
        );
      }

      // Draw Backdrop Box if configured (always behind text)
      if (style.boxBgColor && style.boxBgColor !== 'transparent') {
        const padX = computedFontSize * 0.55;
        const padY = computedFontSize * 0.35;
        ctx.save();
        if (crossScale !== 1) {
          const blockCenterY = baseY + totalBlockHeight / 2;
          ctx.translate(anchorX, blockCenterY);
          ctx.scale(crossScale, crossScale);
          ctx.translate(-anchorX, -blockCenterY);
        }
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
        if (style.preset === 'ae-glass-capsule') {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.38)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      const animStyle = style.animationStyle || 'pop';
      const extrudeDepth = Math.round((style.extrudeDepth || 0) * scaleFactor);
      const extrudeColor = style.extrudeColor || '#0F172A';
      const glowBlur = Math.round((style.glowBlur || 0) * scaleFactor);
      const glowColor = style.glowColor || style.activeWordColor;
      const depthOrder = style.depthLayeringOrder || 'weave-active-front';

      // Determines whether a specific word renders IN FRONT OF obstacles (true) or BEHIND obstacles (false)
      const isWordRenderedInFrontOfObstacle = (
        mw: MeasuredWord,
        lineIdx: number,
        totalLinesCount: number
      ): boolean => {
        if (!style.depthBehindSubject) return true;
        if (depthOrder === 'all-behind') return false;
        if (depthOrder === 'alternate-words') {
          // Odd words pop IN FRONT of obstacles, Even words pass BEHIND obstacles
          return mw.wordIndex % 2 === 1;
        }
        if (depthOrder === 'split-lines') {
          // Top line passes BEHIND obstacle, Bottom line pops IN FRONT of obstacle
          if (totalLinesCount > 1) return lineIdx > 0;
          return mw.isActive;
        }
        // Default 'weave-active-front' (Viral YouTuber Sandwich: Kuch Piche, Kuch Aage):
        // Setup/inactive words glide BEHIND the obstacle, while the Active Spoken Word pops IN FRONT!
        return mw.isActive;
      };

      // Helper to render text lines for a specific depth pass
      const renderCaptionLines = (
        passMode: 'all' | 'behind-only' | 'front-only' | 'xray-behind'
      ) => {
        ctx.save();
        ctx.font = `${fontWeight} ${computedFontSize}px "${style.fontFamily}", sans-serif`;
        ctx.textBaseline = 'middle';
        if ('letterSpacing' in ctx) {
          (
            ctx as CanvasRenderingContext2D & { letterSpacing: string }
          ).letterSpacing = `${trackingPx}px`;
        }
        if (crossScale !== 1) {
          const blockCenterY = baseY + totalBlockHeight / 2;
          ctx.translate(anchorX, blockCenterY);
          ctx.scale(crossScale, crossScale);
          ctx.translate(-anchorX, -blockCenterY);
        }

        lines.forEach((line, lineIdx) => {
          const lineW = line.reduce(
            (acc, w, idx) => acc + w.width + (idx > 0 ? spaceWidth : 0),
            0
          );
          let cursorX = anchorX - lineW / 2;
          const centerY = baseY + lineIdx * lineHeight + lineHeight / 2;

          line.forEach((mw) => {
            if (!mw.text) {
              cursorX += mw.width + spaceWidth;
              return;
            }

            const inFront = isWordRenderedInFrontOfObstacle(
              mw,
              lineIdx,
              lines.length
            );
            if (passMode === 'behind-only' && inFront) {
              cursorX += mw.width + spaceWidth;
              return;
            }
            if (passMode === 'xray-behind' && inFront) {
              cursorX += mw.width + spaceWidth;
              return;
            }
            if (passMode === 'front-only' && !inFront) {
              cursorX += mw.width + spaceWidth;
              return;
            }

            ctx.save();
            const wordCenterX = cursorX + mw.width / 2;

            let wordScale = 1;
            let wordOffsetY = 0;
            let wordOffsetX = 0;
            let wordRotateRad = 0;

            if (animStyle === 'pop' || animStyle === 'cinematic-pan') {
              if (mw.isActive) {
                const popBoost =
                  style.animationIntensity === 'dynamic'
                    ? 0.16
                    : style.animationIntensity === 'medium'
                      ? 0.09
                      : 0.04;
                wordScale = 1 + popBoost * Math.sin(mw.progress * Math.PI);
              }
            } else if (animStyle === 'whip-slide') {
              if (mw.isActive) {
                const inv = Math.max(0, 1 - mw.progress * 1.6);
                wordOffsetY = inv * inv * computedFontSize * 0.48;
                wordScale = 1 + 0.1 * Math.sin(mw.progress * Math.PI);
              }
            } else if (animStyle === 'stomp') {
              if (mw.isActive) {
                const slam = Math.max(0, 1 - mw.progress * 2.2);
                wordScale = 1 + slam * 0.55;
              }
            } else if (animStyle === 'wave') {
              wordOffsetY =
                Math.sin(nowSec * 5.2 + mw.wordIndex * 0.95) *
                (computedFontSize * 0.13);
            } else if (animStyle === 'glitch' && mw.isActive) {
              wordOffsetX = Math.sin(nowSec * 48) * 3 * scaleFactor;
            } else if (animStyle === 'sticker-tilt' && mw.isActive) {
              wordScale = 1.12;
              wordRotateRad = ((mw.wordIndex % 2 === 0 ? -2.8 : 2.8) * Math.PI) / 180;
            } else if (animStyle === 'laser-strike' && mw.isActive) {
              wordScale = 1.1;
            }

            const drawY = centerY + wordOffsetY;
            const drawX = cursorX + wordOffsetX;

            if (wordScale !== 1 || wordRotateRad !== 0) {
              ctx.translate(wordCenterX, drawY);
              if (wordRotateRad !== 0) ctx.rotate(wordRotateRad);
              if (wordScale !== 1) ctx.scale(wordScale, wordScale);
              ctx.translate(-wordCenterX, -drawY);
            }

            if (passMode === 'xray-behind') {
              ctx.strokeStyle = style.activeWordColor || '#38BDF8';
              ctx.lineWidth = Math.max(1.5, 2 * scaleFactor);
              ctx.strokeText(mw.text, drawX, drawY);
              ctx.restore();
              cursorX += mw.width + spaceWidth;
              return;
            }

            // Active word pill background (supports Marker Swipe & Sticker double border)
            if (
              mw.isActive &&
              style.activeBgColor &&
              style.activeBgColor !== 'transparent'
            ) {
              const pillPadX = computedFontSize * 0.24;
              const pillPadY = computedFontSize * 0.16;
              const fullPillW = mw.width + pillPadX * 2;
              const swipeProgress =
                animStyle === 'marker-swipe'
                  ? Math.min(1, 0.25 + mw.progress * 0.95)
                  : 1;
              const pillX = drawX - pillPadX;
              const pillY = drawY - computedFontSize / 2 - pillPadY;
              const pillW = fullPillW * swipeProgress;
              const pillH = computedFontSize + pillPadY * 2;

              ctx.save();
              ctx.fillStyle = style.activeBgColor;
              ctx.beginPath();
              ctx.roundRect(pillX, pillY, pillW, pillH, 10);
              ctx.fill();

              if (animStyle === 'sticker-tilt') {
                ctx.lineWidth = Math.max(2, 3 * scaleFactor);
                ctx.strokeStyle = '#FFFFFF';
                ctx.stroke();
              }
              ctx.restore();
            }

            // Captik Laser Beam Strike under active word
            if (animStyle === 'laser-strike' && mw.isActive) {
              ctx.save();
              const beamY = drawY + computedFontSize * 0.48;
              ctx.shadowColor = glowColor;
              ctx.shadowBlur = 18 * scaleFactor;
              ctx.fillStyle = style.activeWordColor;
              ctx.beginPath();
              ctx.roundRect(
                drawX - 4,
                beamY,
                mw.width + 8,
                Math.max(4, 6 * scaleFactor),
                4
              );
              ctx.fill();
              ctx.restore();
            }

            // After Effects RGB Chromatic Aberration Split on Glitch mode
            if (animStyle === 'glitch' && (mw.isActive || style.preset === 'ae-rgb-glitch')) {
              const shift = (mw.isActive ? 5 : 2.5) * scaleFactor;
              ctx.save();
              ctx.globalAlpha = 0.78;
              ctx.fillStyle = '#FF0055';
              ctx.fillText(mw.text, drawX - shift, drawY - shift * 0.3);
              ctx.fillStyle = '#00F0FF';
              ctx.fillText(mw.text, drawX + shift, drawY + shift * 0.3);
              ctx.restore();
            }

            // After Effects 3D Isometric Stacked Extrusion
            if (extrudeDepth > 0) {
              ctx.save();
              ctx.fillStyle = extrudeColor;
              const steps = Math.min(12, extrudeDepth);
              for (let d = steps; d >= 1; d--) {
                ctx.fillText(mw.text, drawX + d * 0.85, drawY + d);
              }
              ctx.restore();
            }

            // After Effects Saber / Neon Outer Glow
            if (glowBlur > 0) {
              const flickerMult =
                animStyle === 'flicker'
                  ? 0.75 + 0.25 * Math.sin(nowSec * 28 + mw.wordIndex)
                  : 1;
              ctx.shadowColor = glowColor;
              ctx.shadowBlur = glowBlur * flickerMult;
            }

            // Text stroke
            if (style.strokeWidth > 0 && style.strokeColor !== 'transparent') {
              ctx.lineJoin = 'round';
              ctx.miterLimit = 2;
              ctx.lineWidth = Math.max(2, style.strokeWidth * scaleFactor);
              ctx.strokeStyle = style.strokeColor;
              ctx.strokeText(mw.text, drawX, drawY);
            }

            // Hollow Outline Mode: Inactive words are hollow neon outlines, active word is solid
            const isHollow = Boolean(style.hollowInactive && !mw.isActive);
            if (!isHollow) {
              if (style.gradientEndColor && !mw.isActive) {
                const textGrad = ctx.createLinearGradient(
                  drawX,
                  drawY - computedFontSize * 0.5,
                  drawX,
                  drawY + computedFontSize * 0.5
                );
                textGrad.addColorStop(0, style.textColor);
                textGrad.addColorStop(1, style.gradientEndColor);
                ctx.fillStyle = textGrad;
              } else if (style.gradientEndColor && mw.isActive) {
                const activeGrad = ctx.createLinearGradient(
                  drawX,
                  drawY - computedFontSize * 0.5,
                  drawX,
                  drawY + computedFontSize * 0.5
                );
                activeGrad.addColorStop(0, style.activeWordColor);
                activeGrad.addColorStop(1, style.gradientEndColor);
                ctx.fillStyle = activeGrad;
              } else if (
                style.preset === 'karaoke-glow' ||
                animStyle === 'karaoke'
              ) {
                ctx.fillStyle =
                  mw.isActive || mw.isPast
                    ? style.activeWordColor
                    : style.textColor;
              } else {
                ctx.fillStyle = mw.isActive
                  ? style.activeWordColor
                  : style.textColor;
              }

              ctx.fillText(mw.text, drawX, drawY);
            }

            ctx.restore();
            cursorX += mw.width + spaceWidth;
          });
        });

        ctx.restore();
      };

      ctx.restore();

      if (!style.depthBehindSubject) {
        // Standard single-pass render when obstacle depth sandwich is off
        renderCaptionLines('all');
      } else {
        // 4-PASS VIRAL YOUTUBER OBSTACLE SANDWICH ("Kuch Text Obstacles Ke Piche, Kuch Text Aage")
        // Pass 2: Draw words that pass BEHIND the obstacles
        renderCaptionLines('behind-only');

        // Pass 3: Draw Foreground Obstacles (Buildings / Person / Pillars) ON TOP of Pass 2
        if (hasLiveVideo && fgMaskCanvas) {
          const safeX = Math.max(0, Math.floor(patchX));
          const safeY = Math.max(0, Math.floor(patchY));
          const safeW = Math.min(width - safeX, Math.ceil(patchW));
          const safeH = Math.min(height - safeY, Math.ceil(patchH));
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(
            fgMaskCanvas,
            0,
            0,
            fgMaskCanvas.width,
            fgMaskCanvas.height,
            safeX,
            safeY,
            safeW,
            safeH
          );
          ctx.restore();
        } else if (!hasLiveVideo && mediaType !== 'audio') {
          drawDemoForegroundObstacles(ctx, width, height, nowSec);
        }

        // Pass 3B: Optional subtle X-Ray Ghost Rim on the behind-obstacle words
        const xrayOpacity = (style.depthXrayOutline ?? 20) / 100;
        if (xrayOpacity > 0.02) {
          ctx.save();
          ctx.globalAlpha = xrayOpacity;
          renderCaptionLines('xray-behind');
          ctx.restore();
        }

        // Pass 4: Draw words that pop IN FRONT OF the obstacles ON TOP of Pass 3!
        renderCaptionLines('front-only');
      }
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

  // Force an immediate canvas draw whenever `cues` or `styleConfig` updates even while playing
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
          const fixedBlob = await fixVideoDurationMetadata(
            rawBlob,
            recordedDurationSec
          );
          const url = URL.createObjectURL(fixedBlob);
          resolve(url);
        };
      });

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
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium truncate">
          <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="truncate">
            {mediaFileName || 'CapTanz 3D Showcase Video (Multi-Language Demo)'}
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="text-emerald-400 font-medium whitespace-nowrap">
            No Watermark
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Quick One-Click Toggle for Viral YouTuber Obstacle Weave (Kuch Piche, Kuch Aage) */}
          <button
            type="button"
            onClick={() =>
              onPositionChange?.({
                depthBehindSubject: !styleConfig.depthBehindSubject,
                depthLayeringOrder:
                  styleConfig.depthLayeringOrder || 'weave-active-front',
                crossDirection:
                  !styleConfig.depthBehindSubject &&
                  (!styleConfig.crossDirection || styleConfig.crossDirection === 'none')
                    ? 'left-to-right'
                    : styleConfig.crossDirection,
              })
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors border ${
              styleConfig.depthBehindSubject
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Weave captions behind & in front of obstacles (buildings/person) like viral YouTubers"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {styleConfig.depthBehindSubject
                ? 'Obstacle Weave (Piche+Aage): ON'
                : 'Obstacle Weave FX'}
            </span>
          </button>

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
                className={`px-2 py-1 text-xs font-mono tabular-nums rounded transition-colors whitespace-nowrap shrink-0 ${
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
      </div>

      {/* Offscreen Hardware-Decoded Media Elements */}
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

      {/* Center Canvas Stage */}
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
