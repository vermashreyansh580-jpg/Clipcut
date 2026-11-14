export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface CaptionCue {
  id: string;
  index: number;
  start: number;
  end: number;
  text: string;
  words: WordTiming[];
  speaker?: string;
}

export type CaptionStylePreset =
  | 'ae-behind-building'
  | 'ae-skyline-rise'
  | 'ae-neon-saber'
  | 'ae-3d-extrude'
  | 'ae-rgb-glitch'
  | 'ae-whip-slide'
  | 'ae-bass-stomp'
  | 'ae-gold-luxury'
  | 'ae-fire-inferno'
  | 'ae-hollow-outline'
  | 'ae-typewriter-hud'
  | 'ae-sine-wave'
  | 'ae-glass-capsule'
  | 'ae-anamorphic-film'
  | 'hormozi-pop'
  | 'word-highlight'
  | 'boxed-pill'
  | 'karaoke-glow'
  | 'bounce-bold'
  | 'editorial-clean';

export type CaptionAnimationStyle =
  | 'pop'
  | 'whip-slide'
  | 'typewriter'
  | 'wave'
  | 'stomp'
  | 'glitch'
  | 'cinematic-pan'
  | 'karaoke'
  | 'flicker';

export type CaptionCrossDirection =
  | 'none'
  | 'left-to-right'
  | 'right-to-left'
  | 'rise-up'
  | 'slow-zoom';

export type CaptionDepthMode =
  | 'auto-building-sky'
  | 'dark-silhouette'
  | 'bright-subject'
  | 'center-portrait';

export type CaptionFontFamily =
  | 'Plus Jakarta Sans'
  | 'Bebas Neue'
  | 'Anton'
  | 'Montserrat'
  | 'Cinzel'
  | 'Orbitron'
  | 'Oswald'
  | 'Fraunces'
  | 'JetBrains Mono'
  | 'Arial Black';

export interface CaptionStyleConfig {
  preset: CaptionStylePreset;
  fontFamily: CaptionFontFamily;
  fontSize: number;
  xPosition?: number; // 15 to 85 (% from left, default 50)
  yPosition: number; // 10 to 90 (% from top)
  textColor: string;
  activeWordColor: string;
  activeBgColor: string;
  boxBgColor: string;
  strokeColor: string;
  strokeWidth: number;
  uppercase: boolean;
  maxWordsPerLine: number;
  animationIntensity: 'subtle' | 'medium' | 'dynamic';
  // After Effects Motion & Visual FX
  animationStyle?: CaptionAnimationStyle;
  glowColor?: string;
  glowBlur?: number; // 0 to 40
  extrudeDepth?: number; // 0 to 14 (3D block extrusion)
  extrudeColor?: string;
  gradientEndColor?: string;
  letterSpacing?: number; // 0 to 16px
  hollowInactive?: boolean;
  // Cinematic Behind-Building / Subject Depth Layer & Parallax Crossing
  depthBehindSubject?: boolean;
  depthMode?: CaptionDepthMode;
  depthThreshold?: number; // 10 to 90
  depthXrayOutline?: number; // 0 to 60 (% ghost rim opacity on building)
  crossDirection?: CaptionCrossDirection;
  crossSpeed?: number; // 10 to 100
}

export function sliderValueToYPosition(sliderVal: number): number {
  const clamped = Math.max(0, Math.min(100, Number(sliderVal) || 0));
  return Math.round(90 - clamped * 0.8);
}

export function yPositionToSliderValue(yPosition: number): number {
  const clamped = Math.max(10, Math.min(90, Number(yPosition) || 50));
  return Math.round(((90 - clamped) / 80) * 100);
}

export const DEFAULT_STYLE_PRESETS: Record<
  CaptionStylePreset,
  {
    name: string;
    tagline: string;
    category: 'cinematic-depth' | 'after-effects' | 'viral';
    badge: string;
    config: CaptionStyleConfig;
  }
> = {
  'ae-behind-building': {
    name: 'AE Behind Building (Cinematic Cross)',
    tagline: 'Giant 3D title crosses horizontally behind buildings & subjects',
    category: 'cinematic-depth',
    badge: 'BEHIND FX',
    config: {
      preset: 'ae-behind-building',
      fontFamily: 'Bebas Neue',
      fontSize: 82,
      xPosition: 50,
      yPosition: 44,
      textColor: '#FFFFFF',
      activeWordColor: '#38BDF8',
      activeBgColor: 'transparent',
      boxBgColor: 'transparent',
      strokeColor: '#000000',
      strokeWidth: 4,
      uppercase: true,
      maxWordsPerLine: 3,
      animationIntensity: 'dynamic',
      animationStyle: 'cinematic-pan',
      glowColor: '#38BDF8',
      glowBlur: 18,
      extrudeDepth: 6,
      extrudeColor: '#0F172A',
      letterSpacing: 6,
      depthBehindSubject: true,
      depthMode: 'auto-building-sky',
      depthThreshold: 48,
      depthXrayOutline: 26,
      crossDirection: 'left-to-right',
      crossSpeed: 55,
    },
  },
  'ae-skyline-rise': {
    name: 'AE Horizon Rise (Behind Subject)',
    tagline: 'Monumental gold/amber title rises up from behind skyline & towers',
    category: 'cinematic-depth',
    badge: 'DEPTH RISE',
    config: {
      preset: 'ae-skyline-rise',
      fontFamily: 'Anton',
      fontSize: 76,
      xPosition: 50,
      yPosition: 46,
      textColor: '#FEF08A',
      activeWordColor: '#FACC15',
      gradientEndColor: '#F97316',
      activeBgColor: 'transparent',
      boxBgColor: 'transparent',
      strokeColor: '#000000',
      strokeWidth: 4,
      uppercase: true,
      maxWordsPerLine: 3,
      animationIntensity: 'dynamic',
      animationStyle: 'cinematic-pan',
      glowColor: '#F59E0B',
      glowBlur: 20,
      extrudeDepth: 5,
      extrudeColor: '#1E1B4B',
      letterSpacing: 4,
      depthBehindSubject: true,
      depthMode: 'auto-building-sky',
      depthThreshold: 48,
      depthXrayOutline: 24,
      crossDirection: 'rise-up',
      crossSpeed: 50,
    },
  },
  'ae-neon-saber': {
    name: 'AE Saber Neon Glow',
    tagline: 'After Effects Saber electric neon core with multi-pass bloom',
    category: 'after-effects',
    badge: 'SABER GLOW',
    config: {
      preset: 'ae-neon-saber',
      fontFamily: 'Orbitron',
      fontSize: 50,
      xPosition: 50,
      yPosition: 50,
      textColor: '#E0F2FE',
      activeWordColor: '#00F0FF',
      activeBgColor: 'transparent',
      boxBgColor: 'transparent',
      strokeColor: '#0284C7',
      strokeWidth: 4,
      uppercase: true,
      maxWordsPerLine: 3,
      animationIntensity: 'dynamic',
      animationStyle: 'flicker',
      glowColor: '#00F0FF',
      glowBlur: 32,
      letterSpacing: 3,
      depthBehindSubject: false,
      crossDirection: 'none',
    },
  },
  'ae-3d-extrude': {
    name: 'AE 3D Isometric Extrude',
    tagline: 'Deep 3D stacked block extrusion with heavy perspective pop',
    category: 'after-effects',
    badge: '3D EXTRUDE',
    config: {
      preset: 'ae-3d-extrude',
      fontFamily: 'Anton',
      fontSize: 60,
      xPosition: 50,
      yPosition: 50,
      textColor: '#FFFFFF',
      activeWordColor: '#FACC15',
      activeBgColor: 'transparent',
      boxBgColor: 'transparent',
      strokeColor: '#000000',
      strokeWidth: 6,
      uppercase: true,
      maxWordsPerLine: 3,
      animationIntensity: 'dynamic',
      animationStyle: 'pop',
      extrudeDepth: 11,
      extrudeColor: '#0F172A',
      letterSpacing: 2,
      depthBehindSubject: false,
      crossDirection: 'none',
    },
  },
  'ae-rgb-glitch': {
    name: 'AE RGB Split Cyberpunk Glitch',
    tagline: 'Red/Cyan chromatic aberration split + frame slice jitter',
    category: 'after-effects',
    badge: 'RGB GLITCH',
    config: {
      preset: 'ae-rgb-glitch',
      fontFamily: 'Montserrat',
      fontSize: 54,
      xPosition: 50,
      yPosition: 50,
      textColor: '#FFFFFF',
      activeWordColor: '#F43F5E',
      activeBgColor: '#090D16',
      boxBgColor: 'transparent',
      strokeColor: '#000000',
      strokeWidth: 5,
      uppercase: true,
      maxWordsPerLine: 3,
      animationIntensity: 'dynamic',
      animationStyle: 'glitch',
      glowColor: '#00F0FF',
      glowBlur: 14,
      letterSpacing: 2,
      depthBehindSubject: false,
      crossDirection: 'none',
    },
  },
  'ae-whip-slide': {
    name: 'AE Kinetic Whip Slide',
    tagline: 'Words whip-pan upward from baseline with spring overshoot',
    category: 'after-effects',
    badge: 'WHIP PAN',
    config: {
      preset: 'ae-whip-slide',
      fontFamily: 'Oswald',
      fontSize: 58,
      xPosition: 50,
      yPosition: 50,
      textColor: '#F8FAFC',
      activeWordColor: '#34D399',
      activeBgColor: 'transparent',
      boxBgColor: 'transparent',
      strokeColor: '#000000',
      strokeWidth: 7,
      uppercase: true,
      maxWordsPerLine: 4,
      animationIntensity: 'dynamic',
      animationStyle: 'whip-slide',
      extrudeDepth: 6,
      extrudeColor: '#022C22',
      letterSpacing: 2,
      depthBehindSubject: false,
      crossDirection: 'none',
    },
  },
  'ae-bass-stomp': {
    name: 'AE Bass Stomp Slam',
    tagline: '1.6x to 1.0x heavy impact slam on every spoken word',
    category: 'after-effects',
    badge: 'BASS SLAM',
    config: {
      preset: 'ae-bass-stomp',
      fontFamily: 'Anton',
      fontSize: 62,
      xPosition: 50,
      yPosition: 50,
      textColor: '#FFFFFF',
      activeWordColor: '#FB923C',
      activeBgColor: 'transparent',
      boxBgColor: 'transparent',
      strokeColor: '#000000',
      strokeWidth: 8,
      uppercase: true,
      maxWordsPerLine: 3,
      animationIntensity: 'dynamic',
      animationStyle: 'stomp',
      extrudeDepth: 8,
      extrudeColor: '#431407',
      letterSpacing: 2,
      depthBehindSubject: false,
      crossDirection: 'none',
    },
  },
  'ae-gold-luxury': {
    name: 'AE 24K Metallic Gold',
    tagline: 'Multi-stop luxury gold gradient fill with 3D bevel shadow',
    category: 'after-effects',
    badge: '24K GOLD',
    config: {
      preset: 'ae-gold-luxury',
      fontFamily: 'Cinzel',
      fontSize: 52,
      xPosition: 50,
      yPosition: 50,
      textColor: '#FEF9C3',
      activeWordColor: '#FDE047',
      gradientEndColor: '#D97706',
      activeBgColor: 'transparent',
      boxBgColor: 'rgba(15, 23, 42, 0.45)',
      strokeColor: '#451A03',
      strokeWidth: 5,
      uppercase: true,
      maxWordsPerLine: 4,
      animationIntensity: 'medium',
      animationStyle: 'pop',
      glowColor: '#F59E0B',
      glowBlur: 16,
      extrudeDepth: 5,
      extrudeColor: '#271202',
      letterSpacing: 3,
      depthBehindSubject: false,
      crossDirection: 'none',
    },
  },
  'ae-fire-inferno': {
    name: 'AE Inferno Heat Wave',
    tagline: 'Blazing yellow-to-crimson vertical gradient with upward float',
    category: 'after-effects',
    badge: 'INFERNO',
    config: {
      preset: 'ae-fire-inferno',
      fontFamily: 'Bebas Neue',
      fontSize: 66,
      xPosition: 50,
      yPosition: 50,
      textColor: '#FEF08A',
      activeWordColor: '#FACC15',
      gradientEndColor: '#DC2626',
      activeBgColor: 'transparent',
      boxBgColor: 'transparent',
      strokeColor: '#450A0A',
      strokeWidth: 6,
      uppercase: true,
      maxWordsPerLine: 4,
      animationIntensity: 'dynamic',
      animationStyle: 'wave',
      glowColor: '#EA580C',
      glowBlur: 24,
      extrudeDepth: 5,
      extrudeColor: '#450A0A',
      letterSpacing: 3,
      depthBehindSubject: false,
      crossDirection: 'none',
    },
  },
  'ae-hollow-outline': {
    name: 'AE Hollow Neon Stroke',
    tagline: 'Inactive words are transparent neon outlines; active word fills solid',
    category: 'after-effects',
    badge: 'HOLLOW FX',
    config: {
      preset: 'ae-hollow-outline',
      fontFamily: 'Montserrat',
      fontSize: 56,
      xPosition: 50,
      yPosition: 50,
      textColor: '#38BDF8',
      activeWordColor: '#FFFFFF',
      activeBgColor: 'transparent',
      boxBgColor: 'transparent',
      strokeColor: '#38BDF8',
      strokeWidth: 4,
      uppercase: true,
      maxWordsPerLine: 3,
      animationIntensity: 'dynamic',
      animationStyle: 'pop',
      hollowInactive: true,
      glowColor: '#0EA5E9',
      glowBlur: 20,
      letterSpacing: 3,
      depthBehindSubject: false,
      crossDirection: 'none',
    },
  },
  'ae-typewriter-hud': {
    name: 'AE Sci-Fi Typewriter HUD',
    tagline: 'Character-by-character terminal reveal with live cursor block',
    category: 'after-effects',
    badge: 'HUD TYPE',
    config: {
      preset: 'ae-typewriter-hud',
      fontFamily: 'JetBrains Mono',
      fontSize: 44,
      xPosition: 50,
      yPosition: 50,
      textColor: '#A7F3D0',
      activeWordColor: '#10B981',
      activeBgColor: 'transparent',
      boxBgColor: 'rgba(6, 20, 15, 0.82)',
      strokeColor: '#000000',
      strokeWidth: 3,
      uppercase: false,
      maxWordsPerLine: 5,
      animationIntensity: 'medium',
      animationStyle: 'typewriter',
      glowColor: '#10B981',
      glowBlur: 14,
      letterSpacing: 1,
      depthBehindSubject: false,
      crossDirection: 'none',
    },
  },
  'ae-sine-wave': {
    name: 'AE Floating Wave Kinetic',
    tagline: 'Continuous smooth sinusoidal wave motion across spoken words',
    category: 'after-effects',
    badge: 'WAVE FX',
    config: {
      preset: 'ae-sine-wave',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 52,
      xPosition: 50,
      yPosition: 50,
      textColor: '#FFFFFF',
      activeWordColor: '#C084FC',
      gradientEndColor: '#6366F1',
      activeBgColor: 'transparent',
      boxBgColor: 'transparent',
      strokeColor: '#1E1B4B',
      strokeWidth: 6,
      uppercase: true,
      maxWordsPerLine: 4,
      animationIntensity: 'dynamic',
      animationStyle: 'wave',
      glowColor: '#A855F7',
      glowBlur: 18,
      letterSpacing: 2,
      depthBehindSubject: false,
      crossDirection: 'none',
    },
  },
  'ae-glass-capsule': {
    name: 'AE Frosted Glass Capsule',
    tagline: 'Modern translucent glass HUD bar with neon active word pill',
    category: 'after-effects',
    badge: 'GLASS HUD',
    config: {
      preset: 'ae-glass-capsule',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 46,
      xPosition: 50,
      yPosition: 50,
      textColor: '#E2E8F0',
      activeWordColor: '#FFFFFF',
      activeBgColor: '#2563EB',
      boxBgColor: 'rgba(15, 23, 42, 0.72)',
      strokeColor: '#000000',
      strokeWidth: 3,
      uppercase: false,
      maxWordsPerLine: 5,
      animationIntensity: 'medium',
      animationStyle: 'pop',
      glowColor: '#3B82F6',
      glowBlur: 12,
      letterSpacing: 1,
      depthBehindSubject: false,
      crossDirection: 'none',
    },
  },
  'ae-anamorphic-film': {
    name: 'AE Anamorphic Cinema Title',
    tagline: 'Wide letter-spaced Hollywood trailer typography with slow drift',
    category: 'after-effects',
    badge: 'TRAILER',
    config: {
      preset: 'ae-anamorphic-film',
      fontFamily: 'Cinzel',
      fontSize: 48,
      xPosition: 50,
      yPosition: 50,
      textColor: '#F8FAFC',
      activeWordColor: '#FDE047',
      activeBgColor: 'transparent',
      boxBgColor: 'transparent',
      strokeColor: '#000000',
      strokeWidth: 4,
      uppercase: true,
      maxWordsPerLine: 4,
      animationIntensity: 'subtle',
      animationStyle: 'cinematic-pan',
      glowColor: '#FEF08A',
      glowBlur: 12,
      letterSpacing: 6,
      crossDirection: 'slow-zoom',
      crossSpeed: 35,
      depthBehindSubject: false,
    },
  },
  'hormozi-pop': {
    name: 'Creator Pop (Hormozi)',
    tagline: 'Bold active word pop with high-contrast stroke',
    category: 'viral',
    badge: 'VIRAL',
    config: {
      preset: 'hormozi-pop',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 52,
      xPosition: 50,
      yPosition: 50,
      textColor: '#FFFFFF',
      activeWordColor: '#FACC15',
      activeBgColor: 'transparent',
      boxBgColor: 'transparent',
      strokeColor: '#000000',
      strokeWidth: 8,
      uppercase: true,
      maxWordsPerLine: 4,
      animationIntensity: 'dynamic',
      animationStyle: 'pop',
    },
  },
  'word-highlight': {
    name: 'Word Highlight Box',
    tagline: 'Royal blue pill moves word-by-word as spoken',
    category: 'viral',
    badge: 'PILL BOX',
    config: {
      preset: 'word-highlight',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 48,
      xPosition: 50,
      yPosition: 50,
      textColor: '#FFFFFF',
      activeWordColor: '#FFFFFF',
      activeBgColor: '#1D5CFF',
      boxBgColor: 'rgba(15, 23, 42, 0.55)',
      strokeColor: '#000000',
      strokeWidth: 4,
      uppercase: false,
      maxWordsPerLine: 5,
      animationIntensity: 'medium',
      animationStyle: 'pop',
    },
  },
  'boxed-pill': {
    name: 'Studio Boxed',
    tagline: 'Clean dark translucent backdrop for maximum legibility',
    category: 'viral',
    badge: 'STUDIO',
    config: {
      preset: 'boxed-pill',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 44,
      xPosition: 50,
      yPosition: 50,
      textColor: '#F8FAFC',
      activeWordColor: '#38BDF8',
      activeBgColor: 'transparent',
      boxBgColor: 'rgba(11, 17, 32, 0.85)',
      strokeColor: 'transparent',
      strokeWidth: 0,
      uppercase: false,
      maxWordsPerLine: 6,
      animationIntensity: 'subtle',
      animationStyle: 'pop',
    },
  },
  'karaoke-glow': {
    name: 'Emerald Fill',
    tagline: 'Progressive word-by-word color sweep',
    category: 'viral',
    badge: 'KARAOKE',
    config: {
      preset: 'karaoke-glow',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 50,
      xPosition: 50,
      yPosition: 50,
      textColor: 'rgba(255, 255, 255, 0.45)',
      activeWordColor: '#10B981',
      activeBgColor: 'transparent',
      boxBgColor: 'rgba(0, 0, 0, 0.4)',
      strokeColor: '#000000',
      strokeWidth: 5,
      uppercase: true,
      maxWordsPerLine: 4,
      animationIntensity: 'medium',
      animationStyle: 'karaoke',
    },
  },
  'bounce-bold': {
    name: 'Reels Bounce',
    tagline: 'Spring-scaled active words for short-form clips',
    category: 'viral',
    badge: 'BOUNCE',
    config: {
      preset: 'bounce-bold',
      fontFamily: 'Arial Black',
      fontSize: 54,
      xPosition: 50,
      yPosition: 50,
      textColor: '#FFFFFF',
      activeWordColor: '#FB7185',
      activeBgColor: '#0F172A',
      boxBgColor: 'transparent',
      strokeColor: '#000000',
      strokeWidth: 7,
      uppercase: true,
      maxWordsPerLine: 3,
      animationIntensity: 'dynamic',
      animationStyle: 'pop',
    },
  },
  'editorial-clean': {
    name: 'Documentary Serif',
    tagline: 'Refined editorial subtitle style for interviews & films',
    category: 'viral',
    badge: 'SERIF',
    config: {
      preset: 'editorial-clean',
      fontFamily: 'Fraunces',
      fontSize: 42,
      xPosition: 50,
      yPosition: 50,
      textColor: '#FFFFFF',
      activeWordColor: '#FDE047',
      activeBgColor: 'transparent',
      boxBgColor: 'rgba(15, 23, 42, 0.72)',
      strokeColor: '#000000',
      strokeWidth: 2,
      uppercase: false,
      maxWordsPerLine: 7,
      animationIntensity: 'subtle',
      animationStyle: 'pop',
    },
  },
};

export function pad2(n: number): string {
  return String(Math.floor(Math.max(0, n))).padStart(2, '0');
}

export function pad3(n: number): string {
  return String(Math.floor(Math.max(0, n))).padStart(3, '0');
}

export function formatSrtTime(seconds: number): string {
  const clamped = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalMs = Math.round(clamped * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(ms)}`;
}

export function formatVttTime(seconds: number): string {
  return formatSrtTime(seconds).replace(',', '.');
}

export function formatSbvTime(seconds: number): string {
  const clamped = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalMs = Math.round(clamped * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return `${h}:${pad2(m)}:${pad2(s)}.${pad3(ms)}`;
}

export function formatAssTime(seconds: number): string {
  const clamped = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalCs = Math.round(clamped * 100);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return `${h}:${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}

export function parseTimecodeToSeconds(raw: string): number {
  const cleaned = raw.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return Math.max(0, h * 3600 + m * 60 + s);
  }
  if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return Math.max(0, m * 60 + s);
  }
  const direct = parseFloat(cleaned);
  return Number.isFinite(direct) ? Math.max(0, direct) : 0;
}

export function computeWordTimings(
  text: string,
  start: number,
  end: number
): WordTiming[] {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];
  const safeStart = Math.max(0, start);
  const safeEnd = Math.max(safeStart + 0.05, end);
  const duration = safeEnd - safeStart;
  const totalWeight = tokens.reduce((acc, w) => acc + Math.max(1, w.length), 0);

  let cursor = safeStart;
  return tokens.map((word, idx) => {
    const weight = Math.max(1, word.length);
    const slice = (weight / totalWeight) * duration;
    const wordStart = Number(cursor.toFixed(3));
    const wordEnd =
      idx === tokens.length - 1
        ? Number(safeEnd.toFixed(3))
        : Number((cursor + slice).toFixed(3));
    cursor += slice;
    return {
      word,
      start: wordStart,
      end: wordEnd,
    };
  });
}

export function normalizeCues(
  rawCues: Array<{
    id?: string;
    start: number;
    end: number;
    text: string;
    words?: WordTiming[];
    speaker?: string;
  }>
): CaptionCue[] {
  return rawCues
    .map((c, idx) => {
      const start = Math.max(0, Number(c.start) || 0);
      const end = Math.max(start + 0.1, Number(c.end) || start + 2);
      const text = (c.text || '').trim();
      const words =
        c.words && c.words.length > 0
          ? c.words
          : computeWordTimings(text, start, end);
      return {
        id: c.id || `cue-${idx + 1}`,
        index: idx + 1,
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        text,
        words,
        speaker: c.speaker,
      };
    })
    .filter((c) => c.text.length > 0);
}

export function parseSubtitleFile(content: string): CaptionCue[] {
  const trimmed = content
    .replace(/^\uFEFF/, '')
    .replace(/\\n/g, '\n')
    .trim();
  if (!trimmed) return [];

  // JSON format check
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : parsed.cues || [];
      if (Array.isArray(arr)) {
        return normalizeCues(
          arr.map((item, idx) => ({
            id: item.id || `cue-${idx + 1}`,
            start:
              typeof item.start === 'number'
                ? item.start
                : parseTimecodeToSeconds(String(item.start || '0')),
            end:
              typeof item.end === 'number'
                ? item.end
                : parseTimecodeToSeconds(String(item.end || '2')),
            text: String(item.text || ''),
            words: Array.isArray(item.words) ? item.words : undefined,
          }))
        );
      }
    } catch {
      // Fall through to text parsers
    }
  }

  // ASS / SSA format check
  if (/\[Events\]/i.test(trimmed) || /^Dialogue:/im.test(trimmed)) {
    const lines = trimmed.split(/\r?\n/);
    const raw: Array<{ start: number; end: number; text: string }> = [];
    for (const line of lines) {
      if (line.startsWith('Dialogue:')) {
        const rest = line.slice('Dialogue:'.length).trim();
        const parts = rest.split(',');
        if (parts.length >= 10) {
          const start = parseTimecodeToSeconds(parts[1]);
          const end = parseTimecodeToSeconds(parts[2]);
          const textRaw = parts
            .slice(9)
            .join(',')
            .replace(/\{[^}]*\}/g, '')
            .replace(/\\N/gi, ' ')
            .trim();
          if (textRaw) {
            raw.push({ start, end, text: textRaw });
          }
        }
      }
    }
    if (raw.length > 0) return normalizeCues(raw);
  }

  // Standard SRT / WebVTT / SBV blocks
  const cleanedVtt = trimmed
    .replace(/^WEBVTT[^\n]*\n+/i, '')
    .replace(/\r\n/g, '\n');
  const blocks = cleanedVtt.split(/\n{2,}/);
  const rawCues: Array<{ start: number; end: number; text: string }> = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    // Find the line with timing
    let timeLineIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      if (
        lines[i].includes('-->') ||
        /^\d{1,2}:\d{2}:\d{2}[.,]\d{2,3}\s*,\s*\d{1,2}:\d{2}:\d{2}[.,]\d{2,3}$/.test(
          lines[i]
        )
      ) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx !== -1) {
      const timeLine = lines[timeLineIdx];
      let start = 0;
      let end = 2;
      if (timeLine.includes('-->')) {
        const [startStr, endWithSettings] = timeLine.split('-->');
        const endStr = (endWithSettings || '').trim().split(/\s+/)[0];
        start = parseTimecodeToSeconds(startStr);
        end = parseTimecodeToSeconds(endStr);
      } else {
        // SBV format: 0:00:01.000,0:00:03.500
        const [startStr, endStr] = timeLine.split(',');
        start = parseTimecodeToSeconds(startStr);
        end = parseTimecodeToSeconds(endStr || '');
      }
      const text = lines
        .slice(timeLineIdx + 1)
        .join(' ')
        .replace(/<[^>]+>/g, '')
        .trim();
      if (text) {
        rawCues.push({ start, end, text });
      }
    }
  }

  if (rawCues.length > 0) {
    return normalizeCues(rawCues);
  }

  // Fallback: plain text sentences -> auto-timed at ~150 WPM (2.5 words/sec)
  const sentences = trimmed
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  let cursor = 0;
  const fallbackRaw = sentences.map((line) => {
    const wordCount = Math.max(1, line.split(/\s+/).length);
    const duration = Math.max(1.2, Number((wordCount / 2.6).toFixed(2)));
    const start = cursor;
    const end = cursor + duration;
    cursor = end + 0.15;
    return { start, end, text: line };
  });

  return normalizeCues(fallbackRaw);
}

export function exportToSrt(cues: CaptionCue[]): string {
  return cues
    .map(
      (c, i) =>
        `${i + 1}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${c.text}`
    )
    .join('\n\n');
}

export function exportToVtt(cues: CaptionCue[]): string {
  const body = cues
    .map(
      (c, i) =>
        `${i + 1}\n${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${c.text}`
    )
    .join('\n\n');
  return `WEBVTT\n\n${body}`;
}

export function exportToSbv(cues: CaptionCue[]): string {
  return cues
    .map(
      (c) => `${formatSbvTime(c.start)},${formatSbvTime(c.end)}\n${c.text}`
    )
    .join('\n\n');
}

export function exportToAss(
  cues: CaptionCue[],
  style?: Partial<CaptionStyleConfig>
): string {
  const fontName = style?.fontFamily || 'Plus Jakarta Sans';
  const fontSize = style?.fontSize || 48;
  const header = `[Script Info]
Title: CaptionX Free Studio Export
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},&H00FFFFFF,&H0015CCFA,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,0,2,40,40,180,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = cues
    .map(
      (c) =>
        `Dialogue: 0,${formatAssTime(c.start)},${formatAssTime(c.end)},Default,,0,0,0,,${c.text.replace(/\n/g, '\\N')}`
    )
    .join('\n');

  return `${header}\n${events}`;
}

export function exportToTxt(
  cues: CaptionCue[],
  includeTimestamps = false
): string {
  if (includeTimestamps) {
    return cues
      .map((c) => `[${formatSrtTime(c.start)} -> ${formatSrtTime(c.end)}] ${c.text}`)
      .join('\n');
  }
  return cues.map((c) => c.text).join('\n');
}

export function exportToJson(cues: CaptionCue[]): string {
  return JSON.stringify(
    cues.map((c, idx) => ({
      index: idx + 1,
      start: c.start,
      end: c.end,
      text: c.text,
      words: c.words,
    })),
    null,
    2
  );
}

export function shiftCuesTiming(
  cues: CaptionCue[],
  offsetSeconds: number,
  speedMultiplier = 1
): CaptionCue[] {
  const safeScale = speedMultiplier > 0 ? speedMultiplier : 1;
  return normalizeCues(
    cues.map((c) => {
      const duration = Math.max(0.1, (c.end - c.start) / safeScale);
      const rawStart = c.start / safeScale + offsetSeconds;
      const start = Math.max(0, rawStart);
      const end = Math.max(start + 0.1, start + duration);
      return {
        id: c.id,
        start,
        end,
        text: c.text,
        speaker: c.speaker,
        words: computeWordTimings(c.text, start, end),
      };
    })
  );
}

export function mergeSubtitleLists(
  first: CaptionCue[],
  second: CaptionCue[],
  mode: 'append-after-first' | 'interleave-by-time' = 'append-after-first',
  customGapSeconds = 0.5
): CaptionCue[] {
  if (mode === 'append-after-first') {
    const firstEnd =
      first.length > 0 ? Math.max(...first.map((c) => c.end)) : 0;
    const secondMinStart =
      second.length > 0 ? Math.min(...second.map((c) => c.start)) : 0;
    const offset =
      first.length > 0
        ? Math.max(0, firstEnd + customGapSeconds - secondMinStart)
        : 0;
    const shiftedSecond = shiftCuesTiming(second, offset);
    return normalizeCues([...first, ...shiftedSecond]);
  }

  const combined = [...first, ...second].sort((a, b) => a.start - b.start);
  return normalizeCues(combined);
}

export function bridgeContinuousCueGaps(
  cues: CaptionCue[],
  maxBridgeSeconds = 1.5
): CaptionCue[] {
  if (cues.length <= 1) return cues;
  const cloned: CaptionCue[] = cues.map((c) => ({
    ...c,
    words: c.words ? c.words.map((w) => ({ ...w })) : [],
  }));

  for (let i = 0; i < cloned.length - 1; i++) {
    const curr = cloned[i];
    const next = cloned[i + 1];
    const gap = next.start - curr.end;
    if (gap > 0 && gap <= maxBridgeSeconds) {
      curr.end = Number(next.start.toFixed(3));
      if (curr.words.length > 0) {
        curr.words[curr.words.length - 1].end = curr.end;
      }
    }
    for (let wIdx = 0; wIdx < curr.words.length - 1; wIdx++) {
      const wCurr = curr.words[wIdx];
      const wNext = curr.words[wIdx + 1];
      if (wNext.start > wCurr.end && wNext.start - wCurr.end <= 0.6) {
        wCurr.end = wNext.start;
      }
    }
  }
  const lastCue = cloned[cloned.length - 1];
  for (let wIdx = 0; wIdx < lastCue.words.length - 1; wIdx++) {
    const wCurr = lastCue.words[wIdx];
    const wNext = lastCue.words[wIdx + 1];
    if (wNext.start > wCurr.end && wNext.start - wCurr.end <= 0.6) {
      wCurr.end = wNext.start;
    }
  }

  return cloned;
}

export function regroupCuesByMaxWords(
  cues: CaptionCue[],
  maxWordsPerCue: number
): CaptionCue[] {
  const limit = Math.max(1, Math.min(15, Math.floor(maxWordsPerCue)));
  const allWords: WordTiming[] = [];

  for (const cue of cues) {
    const words =
      cue.words && cue.words.length > 0
        ? cue.words
        : computeWordTimings(cue.text, cue.start, cue.end);
    allWords.push(...words);
  }

  if (allWords.length === 0) return [];

  const regrouped: Array<{
    start: number;
    end: number;
    text: string;
    words: WordTiming[];
  }> = [];

  let currentChunk: WordTiming[] = [];
  for (let i = 0; i < allWords.length; i++) {
    const w = allWords[i];
    currentChunk.push(w);
    const endsWithPunctuation = /[.!?।]$/.test(w.word);
    const nextWord = allWords[i + 1];
    const hasLongGap = nextWord && nextWord.start - w.end > 0.85;

    if (
      currentChunk.length >= limit ||
      endsWithPunctuation ||
      hasLongGap ||
      i === allWords.length - 1
    ) {
      regrouped.push({
        start: currentChunk[0].start,
        end: currentChunk[currentChunk.length - 1].end,
        text: currentChunk.map((item) => item.word).join(' '),
        words: currentChunk,
      });
      currentChunk = [];
    }
  }

  return bridgeContinuousCueGaps(normalizeCues(regrouped), 2.2);
}

export function buildContinuousCuesFromWhisper(
  rawWords: Array<{ word?: string; start?: number; end?: number }>,
  rawSegments: Array<{ text?: string; start?: number; end?: number }>,
  maxWordsPerLine = 4
): CaptionCue[] {
  const cleanedWords: WordTiming[] = (Array.isArray(rawWords) ? rawWords : [])
    .map((w) => ({
      word: String(w.word || '').trim(),
      start: Math.max(0, Number(w.start) || 0),
      end: Math.max((Number(w.start) || 0) + 0.08, Number(w.end) || 0.2),
    }))
    .filter((w) => w.word.length > 0 && w.word !== '.');

  const validSegments = (Array.isArray(rawSegments) ? rawSegments : [])
    .map((s) => ({
      text: String(s.text || '').trim(),
      start: Math.max(0, Number(s.start) || 0),
      end: Math.max((Number(s.start) || 0) + 0.2, Number(s.end) || 1),
    }))
    .filter((s) => s.text.length > 0);

  const mergedWords: WordTiming[] = [];

  if (validSegments.length > 0) {
    const usedWordIndices = new Set<number>();

    for (const seg of validSegments) {
      const segTokens = seg.text.split(/\s+/).filter(Boolean);
      if (segTokens.length === 0) continue;

      const matchingEntries: Array<{ idx: number; item: WordTiming }> = [];
      cleanedWords.forEach((w, idx) => {
        if (usedWordIndices.has(idx)) return;
        const mid = (w.start + w.end) / 2;
        if (mid >= seg.start - 0.18 && mid <= seg.end + 0.18) {
          matchingEntries.push({ idx, item: w });
        }
      });

      matchingEntries.forEach((e) => usedWordIndices.add(e.idx));

      if (matchingEntries.length === segTokens.length) {
        // 1-to-1 match: use segment tokens (which have cleaner orthography/punctuation) with exact word timings
        for (let i = 0; i < segTokens.length; i++) {
          mergedWords.push({
            word: segTokens[i],
            start: matchingEntries[i].item.start,
            end: matchingEntries[i].item.end,
          });
        }
      } else if (
        matchingEntries.length > 0 &&
        matchingEntries.length >= Math.ceil(segTokens.length * 0.92)
      ) {
        mergedWords.push(...matchingEntries.map((e) => e.item));
      } else {
        // Recover 100% of spoken words from segment text so middle words never vanish
        const startBound =
          matchingEntries.length > 0
            ? Math.min(seg.start, matchingEntries[0].item.start)
            : seg.start;
        const endBound =
          matchingEntries.length > 0
            ? Math.max(
                seg.end,
                matchingEntries[matchingEntries.length - 1].item.end
              )
            : seg.end;
        mergedWords.push(
          ...computeWordTimings(seg.text, startBound, Math.max(startBound + 0.2, endBound))
        );
      }
    }
  } else {
    mergedWords.push(...cleanedWords);
  }

  if (mergedWords.length === 0) return [];

  // Ensure monotonic timestamps
  mergedWords.sort((a, b) => a.start - b.start);

  const singleCue = normalizeCues([
    {
      id: 'cue-1',
      start: mergedWords[0].start,
      end: mergedWords[mergedWords.length - 1].end,
      text: mergedWords.map((w) => w.word).join(' '),
      words: mergedWords,
    },
  ]);

  return regroupCuesByMaxWords(singleCue, Math.max(1, maxWordsPerLine || 4));
}

const LANGUAGE_TO_ISO_MAP: Record<string, string> = {
  hinglish: 'hi',
  hindi: 'hi',
  english: 'en',
  urdu: 'ur',
  punjabi: 'pa',
  marathi: 'mr',
  tamil: 'ta',
  telugu: 'te',
  bengali: 'bn',
  gujarati: 'gu',
  arabic: 'ar',
  spanish: 'es',
  portuguese: 'pt',
  french: 'fr',
  german: 'de',
  indonesian: 'id',
  japanese: 'ja',
  korean: 'ko',
  turkish: 'tr',
};

export function getWhisperIsoLanguageCode(language: string): string | null {
  if (!language || language === 'auto') return null;
  const clean = language.trim().toLowerCase();
  if (clean.length === 2) return clean;
  for (const [key, iso] of Object.entries(LANGUAGE_TO_ISO_MAP)) {
    if (clean.includes(key)) return iso;
  }
  return null;
}

const DEVANAGARI_VOWELS: Record<string, string> = {
  अ: 'a',
  आ: 'aa',
  इ: 'i',
  ई: 'ee',
  उ: 'u',
  ऊ: 'oo',
  ऋ: 'ri',
  ए: 'e',
  ऐ: 'ai',
  ओ: 'o',
  औ: 'au',
  ऑ: 'o',
  ॲ: 'a',
};

const DEVANAGARI_MATRAS: Record<string, string> = {
  'ा': 'a',
  'ि': 'i',
  'ी': 'ee',
  'ु': 'u',
  'ू': 'oo',
  'ृ': 'ri',
  'े': 'e',
  'ै': 'ai',
  'ो': 'o',
  'ौ': 'au',
  'ॉ': 'o',
  'ॅ': 'a',
};

const DEVANAGARI_CONSONANTS: Record<string, string> = {
  क: 'k',
  ख: 'kh',
  ग: 'g',
  घ: 'gh',
  ङ: 'n',
  च: 'ch',
  छ: 'chh',
  ज: 'j',
  झ: 'jh',
  ञ: 'n',
  ट: 't',
  ठ: 'th',
  ड: 'd',
  ढ: 'dh',
  ण: 'n',
  त: 't',
  थ: 'th',
  द: 'd',
  ध: 'dh',
  न: 'n',
  प: 'p',
  फ: 'ph',
  ब: 'b',
  भ: 'bh',
  म: 'm',
  य: 'y',
  र: 'r',
  ल: 'l',
  व: 'v',
  श: 'sh',
  ष: 'sh',
  स: 's',
  ह: 'h',
  ड़: 'd',
  ढ़: 'dh',
  क़: 'q',
  ख़: 'kh',
  ग़: 'gh',
  ज़: 'z',
  फ़: 'f',
};

const COMMON_HINGLISH_WORDS: Record<string, string> = {
  आज: 'aaj',
  हम: 'hum',
  बात: 'baat',
  करेंगे: 'karenge',
  करते: 'karte',
  करता: 'karta',
  करती: 'karti',
  करना: 'karna',
  करनी: 'karni',
  करने: 'karne',
  करो: 'karo',
  करें: 'karein',
  किया: 'kiya',
  किये: 'kiye',
  किए: 'kiye',
  कैसे: 'kaise',
  कैसा: 'kaisa',
  कैसी: 'kaisi',
  हो: 'ho',
  हूँ: 'hoon',
  हूं: 'hoon',
  होता: 'hota',
  होती: 'hoti',
  होते: 'hote',
  होना: 'hona',
  होने: 'hone',
  आप: 'aap',
  आपको: 'aapko',
  आपका: 'aapka',
  आपकी: 'aapki',
  तुम: 'tum',
  तुम्हें: 'tumhe',
  तू: 'tu',
  मैं: 'main',
  मैंने: 'maine',
  मुझे: 'mujhe',
  मुझको: 'mujhko',
  मेरा: 'mera',
  मेरी: 'meri',
  मेरे: 'mere',
  तेरा: 'tera',
  तेरी: 'teri',
  तुम्हारा: 'tumhara',
  हमारा: 'hamara',
  हमारी: 'hamari',
  हमारे: 'hamare',
  हमें: 'humein',
  क्या: 'kya',
  क्यों: 'kyu',
  कहाँ: 'kahan',
  कब: 'kab',
  कौन: 'kaun',
  नहीं: 'nahi',
  ना: 'na',
  मत: 'mat',
  हाँ: 'haan',
  हां: 'haan',
  है: 'hai',
  हैं: 'hain',
  था: 'tha',
  थी: 'thi',
  थे: 'the',
  होगा: 'hoga',
  होगी: 'hogi',
  होंगे: 'honge',
  और: 'aur',
  या: 'ya',
  तो: 'toh',
  भी: 'bhi',
  ही: 'hi',
  से: 'se',
  में: 'mein',
  पर: 'par',
  पे: 'pe',
  को: 'ko',
  का: 'ka',
  की: 'ki',
  के: 'ke',
  लिए: 'liye',
  यह: 'yeh',
  ये: 'ye',
  वह: 'woh',
  वो: 'wo',
  इस: 'is',
  उस: 'us',
  इसको: 'isko',
  उसको: 'usko',
  उनको: 'unko',
  इनको: 'inko',
  यहाँ: 'yahan',
  वहाँ: 'wahan',
  जहाँ: 'jahan',
  जहां: 'jahan',
  बहुत: 'bahut',
  काफी: 'kaafi',
  ज़्यादा: 'zyada',
  ज्यादा: 'zyada',
  अच्छा: 'accha',
  अच्छी: 'acchi',
  अच्छे: 'acche',
  ठीक: 'theek',
  भाई: 'bhai',
  दोस्त: 'dost',
  दोस्तों: 'dosto',
  चलो: 'chalo',
  चलता: 'chalta',
  चलती: 'chalti',
  चलते: 'chalte',
  चला: 'chala',
  चली: 'chali',
  चलें: 'chalein',
  देखो: 'dekho',
  देखना: 'dekhna',
  देखते: 'dekhte',
  देखता: 'dekhta',
  देखिए: 'dekhiye',
  दिखता: 'dikhta',
  दिखाता: 'dikhata',
  दिखा: 'dikha',
  सुनो: 'suno',
  सुनना: 'sunna',
  बताओ: 'batao',
  बताना: 'batana',
  बताते: 'batate',
  बोलता: 'bolta',
  बोलते: 'bolte',
  बोलना: 'bolna',
  लगता: 'lagta',
  लगती: 'lagti',
  लगते: 'lagte',
  लगा: 'laga',
  बनता: 'banta',
  बनती: 'banti',
  बनते: 'bante',
  बनाना: 'banana',
  बना: 'bana',
  आता: 'aata',
  आती: 'aati',
  आते: 'aate',
  आया: 'aaya',
  जाता: 'jaata',
  जाती: 'jaati',
  जाते: 'jaate',
  गया: 'gaya',
  गए: 'gaye',
  गई: 'gayi',
  उड़: 'ud',
  चाहिए: 'chahiye',
  समझ: 'samajh',
  समझना: 'samajhna',
  वीडियो: 'video',
  वीडियोज़: 'videos',
  वीडियोज़: 'videos',
  ऑडियो: 'audio',
  चैनल: 'channel',
  सब्सक्राइब: 'subscribe',
  लाइक: 'like',
  शेयर: 'share',
  कमेंट: 'comment',
  स्वागत: 'swagat',
  नमस्ते: 'namaste',
  जिंदगी: 'zindagi',
  ज़िंदगी: 'zindagi',
  दुनिया: 'duniya',
  प्यार: 'pyaar',
  दिल: 'dil',
  सपना: 'sapna',
  सपने: 'sapne',
  काम: 'kaam',
  नाम: 'naam',
  शुरू: 'shuru',
  खत्म: 'khatam',
  साथ: 'saath',
  हाथ: 'haath',
  रात: 'raat',
  दिन: 'din',
  साल: 'saal',
  आजकल: 'aajkal',
  अभी: 'abhi',
  कभी: 'kabhi',
  सभी: 'sabhi',
  सब: 'sab',
  कुछ: 'kuch',
  कोई: 'koi',
  अगर: 'agar',
  मगर: 'magar',
  लेकिन: 'lekin',
  क्योंकि: 'kyunki',
  इसलिए: 'isliye',
  जब: 'jab',
  तब: 'tab',
  अब: 'ab',
  फिर: 'phir',
  सिर्फ: 'sirf',
  बस: 'bas',
  यार: 'yaar',
  लोग: 'log',
  लोगों: 'logo',
  तरह: 'tarah',
  तरीका: 'tarika',
  तरीके: 'tarike',
  वक्त: 'waqt',
  समय: 'samay',
  टाइम: 'time',
  टाइमिंग: 'timing',
  सेकंड: 'second',
  मिनट: 'minute',
  पैसा: 'paisa',
  पैसे: 'paise',
  घर: 'ghar',
  देश: 'desh',
  भारत: 'bharat',
  इंडिया: 'india',
  हिंदी: 'hindi',
  इंग्लिश: 'english',
  कैप्शन: 'caption',
  कैप्शंस: 'captions',
  एक्सपोर्ट: 'export',
  रेंडर: 'render',
  वेबसाइट: 'website',
  बटन: 'button',
  फोन: 'phone',
  मोबाइल: 'mobile',
  प्रॉब्लम: 'problem',
  स्पेलिंग: 'spelling',
  मिस्टेक: 'mistake',
  मिस्टेक्स: 'mistakes',
  फिक्स: 'fix',
  जनरेट: 'generate',
  प्ले: 'play',
  लैगी: 'laggy',
  प्रॉपर: 'proper',
  आवाज: 'aawaz',
  आवाज़: 'aawaz',
  बिल्कुल: 'bilkul',
  सही: 'sahi',
  गलत: 'galat',
  गड़बड़: 'gadbad',
  चीज़: 'cheez',
  चीज़: 'cheez',
  चीजें: 'cheezein',
  चीज़ें: 'cheezein',
  जगह: 'jagah',
  अलावा: 'alawa',
  सारा: 'saara',
  सारी: 'saari',
  सारे: 'saare',
  पूरा: 'poora',
  पूरी: 'poori',
  अंदर: 'andar',
  बाहर: 'bahar',
  ऊपर: 'oopar',
  नीचे: 'neeche',
  आगे: 'aage',
  पीछे: 'peeche',
  पहले: 'pehle',
  बाद: 'baad',
  बीच: 'beech',
  दें: 'dein',
  दिया: 'diya',
  लिया: 'liya',
  दूसरा: 'doosra',
  दूसरी: 'doosri',
  तीसरा: 'teesra',
};

export function transliterateDevanagariToHinglish(input: string): string {
  if (!input || !/[\u0900-\u097F]/.test(input)) return input;

  const normalized = input
    .replace(/ड़/g, 'ड़')
    .replace(/ढ़/g, 'ढ़')
    .replace(/क़/g, 'क़')
    .replace(/ख़/g, 'ख़')
    .replace(/ग़/g, 'ग़')
    .replace(/ज़/g, 'ज़')
    .replace(/फ़/g, 'फ़')
    .replace(/।/g, '.');

  return normalized
    .split(/(\s+)/)
    .map((token) => {
      if (!/[\u0900-\u097F]/.test(token)) return token;
      const match = token.match(
        /^([^\u0900-\u097F]*)([\u0900-\u097F]+)([^\u0900-\u097F]*)$/
      );
      if (match) {
        const [, prefix, core, suffix] = match;
        if (COMMON_HINGLISH_WORDS[core]) {
          return `${prefix}${COMMON_HINGLISH_WORDS[core]}${suffix}`;
        }
      }

      const chars = Array.from(token);
      let out = '';
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const next = chars[i + 1];
        const afterNext = chars[i + 2];
        const isLastChar = i === chars.length - 1;

        if (DEVANAGARI_VOWELS[ch] !== undefined) {
          out += DEVANAGARI_VOWELS[ch];
        } else if (DEVANAGARI_CONSONANTS[ch] !== undefined) {
          const base = DEVANAGARI_CONSONANTS[ch];
          if (next === '्') {
            out += base;
            i++;
          } else if (next && DEVANAGARI_MATRAS[next] !== undefined) {
            const matraSound =
              next === 'ा' && i === 0 && chars.length <= 3
                ? 'aa'
                : DEVANAGARI_MATRAS[next];
            out += base + matraSound;
            i++;
          } else if (isLastChar && chars.length > 1) {
            out += base;
          } else if (
            i > 0 &&
            next &&
            DEVANAGARI_CONSONANTS[next] !== undefined &&
            afterNext &&
            DEVANAGARI_MATRAS[afterNext] !== undefined
          ) {
            // Hindi medial schwa deletion before a CV syllable (e.g. चलता -> chalta, समझना -> samajhna)
            out += base;
          } else {
            out += base + 'a';
          }
        } else if (DEVANAGARI_MATRAS[ch] !== undefined) {
          out += DEVANAGARI_MATRAS[ch];
        } else if (ch === 'ं' || ch === 'ँ') {
          out += 'n';
        } else if (ch === 'ः') {
          out += 'h';
        } else if (ch !== '्' && ch !== '़') {
          out += ch;
        }
      }
      return out;
    })
    .join('');
}

export function applyProofreadOrTranslatedCues(
  originalCues: CaptionCue[],
  updatedItems: Array<{ index?: number; text?: string }>,
  isHinglish: boolean
): CaptionCue[] {
  const byIndex = new Map<number, string>();
  for (const item of updatedItems) {
    if (typeof item.index === 'number' && typeof item.text === 'string') {
      const rawTxt = item.text.trim();
      if (!rawTxt) continue;
      const cleanTxt = isHinglish
        ? transliterateDevanagariToHinglish(rawTxt)
        : rawTxt;
      if (cleanTxt) {
        byIndex.set(item.index, cleanTxt);
      }
    }
  }

  const merged = originalCues.map((c, idx) => {
    const candidate = byIndex.get(idx);
    const fallbackText = isHinglish
      ? transliterateDevanagariToHinglish(c.text)
      : c.text;
    const finalText = candidate && candidate.length > 0 ? candidate : fallbackText;
    const newTokens = finalText.split(/\s+/).filter(Boolean);

    // If token count matches existing Whisper word timings, keep exact Whisper word timestamps
    let words: WordTiming[];
    if (c.words && c.words.length === newTokens.length && newTokens.length > 0) {
      words = c.words.map((w, wIdx) => ({
        word: newTokens[wIdx],
        start: w.start,
        end: w.end,
      }));
    } else {
      words = computeWordTimings(finalText, c.start, c.end);
    }

    return {
      id: c.id,
      start: c.start,
      end: c.end,
      text: finalText,
      words,
      speaker: c.speaker,
    };
  });

  return bridgeContinuousCueGaps(normalizeCues(merged), 2.2);
}

/**
 * Injects or updates the Matroska Info -> Duration (0x4489) float64 element
 * and Segment byte size in a MediaRecorder WebM buffer so mobile phones and
 * media players display the exact video duration instead of 0:00.
 */
export function patchWebmDurationBytes(
  bytes: Uint8Array,
  durationMs: number
): Uint8Array {
  if (!bytes || bytes.length < 32) return bytes;
  // Check EBML magic header 0x1A 0x45 0xDF 0xA3
  if (
    bytes[0] !== 0x1a ||
    bytes[1] !== 0x45 ||
    bytes[2] !== 0xdf ||
    bytes[3] !== 0xa3
  ) {
    return bytes;
  }

  const safeDurationMs = Math.max(100, Number.isFinite(durationMs) ? durationMs : 1000);
  const floatBuf = new ArrayBuffer(8);
  new DataView(floatBuf).setFloat64(0, safeDurationMs, false);
  const floatBytes = new Uint8Array(floatBuf);

  // Locate Info element [0x15, 0x49, 0xA9, 0x66] before the first Cluster [0x1F, 0x43, 0xB6, 0x75]
  const scanLimit = Math.min(bytes.length - 12, 8192);
  let infoPos = -1;
  for (let i = 0; i < scanLimit; i++) {
    if (
      bytes[i] === 0x1f &&
      bytes[i + 1] === 0x43 &&
      bytes[i + 2] === 0xb6 &&
      bytes[i + 3] === 0x75
    ) {
      break;
    }
    if (
      bytes[i] === 0x15 &&
      bytes[i + 1] === 0x49 &&
      bytes[i + 2] === 0xa9 &&
      bytes[i + 3] === 0x66
    ) {
      infoPos = i;
      break;
    }
  }

  if (infoPos === -1) return bytes;

  const vintPos = infoPos + 4;
  const firstByte = bytes[vintPos];
  if (!firstByte) return bytes;

  let vintLen = 1;
  let mask = 0x80;
  while (vintLen <= 8 && (firstByte & mask) === 0) {
    vintLen++;
    mask >>= 1;
  }
  if (vintLen > 8 || vintPos + vintLen > bytes.length) return bytes;

  let infoDataSize = firstByte & (mask - 1);
  for (let k = 1; k < vintLen; k++) {
    infoDataSize = infoDataSize * 256 + bytes[vintPos + k];
  }

  const infoBodyStart = vintPos + vintLen;
  const infoBodyEnd = Math.min(bytes.length, infoBodyStart + infoDataSize);

  // Check if Duration [0x44, 0x89, 0x88] is already inside Info body
  for (let i = infoBodyStart; i <= infoBodyEnd - 11; i++) {
    if (bytes[i] === 0x44 && bytes[i + 1] === 0x89 && bytes[i + 2] === 0x88) {
      const copy = new Uint8Array(bytes);
      copy.set(floatBytes, i + 3);
      return copy;
    }
  }

  // Construct 11-byte Duration element: ID [0x44, 0x89], size [0x88] (8 bytes), float64
  const durationElem = new Uint8Array(11);
  durationElem[0] = 0x44;
  durationElem[1] = 0x89;
  durationElem[2] = 0x88;
  durationElem.set(floatBytes, 3);

  const newInfoDataSize = infoDataSize + durationElem.length;
  const newInfoVint = new Uint8Array([
    0x10 | ((newInfoDataSize >>> 24) & 0x0f),
    (newInfoDataSize >>> 16) & 0xff,
    (newInfoDataSize >>> 8) & 0xff,
    newInfoDataSize & 0xff,
  ]);

  const beforeInfoSize = bytes.subarray(0, vintPos);
  const infoBody = bytes.subarray(infoBodyStart, infoBodyEnd);
  const afterInfo = bytes.subarray(infoBodyEnd);

  const totalLen =
    beforeInfoSize.length +
    newInfoVint.length +
    infoBody.length +
    durationElem.length +
    afterInfo.length;

  const out = new Uint8Array(totalLen);
  let offset = 0;
  out.set(beforeInfoSize, offset);
  offset += beforeInfoSize.length;
  out.set(newInfoVint, offset);
  offset += newInfoVint.length;
  out.set(infoBody, offset);
  offset += infoBody.length;
  out.set(durationElem, offset);
  offset += durationElem.length;
  out.set(afterInfo, offset);

  return out;
}

/**
 * Patches MP4 / fMP4 mvhd, tkhd, mdhd, and mehd boxes when MediaRecorder writes 0 duration.
 */
export function patchMp4DurationBytes(
  bytes: Uint8Array,
  durationMs: number
): Uint8Array {
  if (!bytes || bytes.length < 32) return bytes;
  const out = new Uint8Array(bytes);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const safeDurationSec = Math.max(0.1, durationMs / 1000);
  const limit = Math.min(out.length - 32, 65536);

  let movieTimescale = 1000;

  for (let i = 4; i < limit; i++) {
    // 'mvhd' = 0x6D 0x76 0x68 0x64
    if (
      out[i] === 0x6d &&
      out[i + 1] === 0x76 &&
      out[i + 2] === 0x68 &&
      out[i + 3] === 0x64
    ) {
      const version = out[i + 4];
      if (version === 0 && i + 24 <= out.length) {
        const ts = view.getUint32(i + 16, false);
        if (ts > 0 && ts < 10_000_000) {
          movieTimescale = ts;
          view.setUint32(i + 20, Math.round(safeDurationSec * ts), false);
        }
      }
    }
    // 'mdhd' = 0x6D 0x64 0x68 0x64
    if (
      out[i] === 0x6d &&
      out[i + 1] === 0x64 &&
      out[i + 2] === 0x68 &&
      out[i + 3] === 0x64
    ) {
      const version = out[i + 4];
      if (version === 0 && i + 24 <= out.length) {
        const ts = view.getUint32(i + 16, false);
        if (ts > 0 && ts < 10_000_000) {
          view.setUint32(i + 20, Math.round(safeDurationSec * ts), false);
        }
      }
    }
    // 'tkhd' = 0x74 0x6B 0x68 0x64
    if (
      out[i] === 0x74 &&
      out[i + 1] === 0x6b &&
      out[i + 2] === 0x68 &&
      out[i + 3] === 0x64
    ) {
      const version = out[i + 4];
      if (version === 0 && i + 28 <= out.length) {
        view.setUint32(
          i + 24,
          Math.round(safeDurationSec * movieTimescale),
          false
        );
      }
    }
    // 'mehd' = 0x6D 0x65 0x68 0x64
    if (
      out[i] === 0x6d &&
      out[i + 1] === 0x65 &&
      out[i + 2] === 0x68 &&
      out[i + 3] === 0x64
    ) {
      const version = out[i + 4];
      if (version === 0 && i + 12 <= out.length) {
        view.setUint32(
          i + 8,
          Math.round(safeDurationSec * movieTimescale),
          false
        );
      }
    }
  }

  return out;
}

export async function fixVideoDurationMetadata(
  blob: Blob,
  durationSeconds: number
): Promise<Blob> {
  try {
    const durationMs = Math.max(100, Math.round(durationSeconds * 1000));
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    ) {
      const patched = patchWebmDurationBytes(bytes, durationMs);
      return new Blob([patched.buffer as ArrayBuffer], {
        type: blob.type || 'video/webm',
      });
    }
    const patchedMp4 = patchMp4DurationBytes(bytes, durationMs);
    return new Blob([patchedMp4.buffer as ArrayBuffer], {
      type: blob.type || 'video/mp4',
    });
  } catch {
    return blob;
  }
}

const DEFAULT_FILLERS = [
  'um',
  'uh',
  'erm',
  'ah',
  'hmm',
  'uhh',
  'umm',
];

export function removeFillerWordsFromCues(
  cues: CaptionCue[],
  extraFillers: string[] = []
): { cues: CaptionCue[]; removedCount: number } {
  const fillerSet = new Set(
    [...DEFAULT_FILLERS, ...extraFillers].map((f) => f.toLowerCase().trim())
  );
  let removedCount = 0;

  const cleanedRaw = cues
    .map((cue) => {
      const tokens = cue.text.split(/\s+/).filter(Boolean);
      const kept = tokens.filter((token) => {
        const stripped = token.replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase();
        if (fillerSet.has(stripped)) {
          removedCount++;
          return false;
        }
        return true;
      });
      const text = kept.join(' ').trim();
      return {
        id: cue.id,
        start: cue.start,
        end: cue.end,
        text,
        words: computeWordTimings(text, cue.start, cue.end),
      };
    })
    .filter((c) => c.text.length > 0);

  return {
    cues: normalizeCues(cleanedRaw),
    removedCount,
  };
}

export interface SubtitleMetrics {
  cueCount: number;
  totalWords: number;
  totalCharacters: number;
  totalDurationSeconds: number;
  avgCps: number;
  maxCps: number;
  fastCueIds: string[];
}

export function calculateSubtitleMetrics(cues: CaptionCue[]): SubtitleMetrics {
  if (cues.length === 0) {
    return {
      cueCount: 0,
      totalWords: 0,
      totalCharacters: 0,
      totalDurationSeconds: 0,
      avgCps: 0,
      maxCps: 0,
      fastCueIds: [],
    };
  }

  let totalWords = 0;
  let totalCharacters = 0;
  let totalActiveTime = 0;
  let maxCps = 0;
  const fastCueIds: string[] = [];

  for (const cue of cues) {
    const words = cue.text.trim().split(/\s+/).filter(Boolean).length;
    const chars = cue.text.trim().length;
    const duration = Math.max(0.1, cue.end - cue.start);
    const cps = chars / duration;
    totalWords += words;
    totalCharacters += chars;
    totalActiveTime += duration;
    if (cps > maxCps) maxCps = cps;
    if (cps > 20) fastCueIds.push(cue.id);
  }

  const maxEnd = Math.max(...cues.map((c) => c.end));
  const minStart = Math.min(...cues.map((c) => c.start));

  return {
    cueCount: cues.length,
    totalWords,
    totalCharacters,
    totalDurationSeconds: Number(Math.max(0, maxEnd - minStart).toFixed(2)),
    avgCps: Number(
      (totalActiveTime > 0 ? totalCharacters / totalActiveTime : 0).toFixed(1)
    ),
    maxCps: Number(maxCps.toFixed(1)),
    fastCueIds,
  };
}
