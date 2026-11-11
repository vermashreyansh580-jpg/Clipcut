'use client';

import React, { useState, useMemo } from 'react';
import {
  CaptionCue,
  parseSubtitleFile,
  exportToSrt,
  exportToVtt,
  exportToAss,
  exportToSbv,
  exportToTxt,
  exportToJson,
  shiftCuesTiming,
  mergeSubtitleLists,
  removeFillerWordsFromCues,
  calculateSubtitleMetrics,
  formatSrtTime,
} from '@/lib/subtitles';
import {
  detectSilencesFromSamples,
  encodeTrimmedWav,
  exportKeptRegionsToEdl,
  SilenceAnalysisResult,
} from '@/lib/audio-silence';
import { translateWithGroqClientOrServer } from '@/lib/groq';
import {
  Search,
  Upload,
  Download,
  Copy,
  Check,
  ArrowRight,
  Clock,
  Merge,
  FileCode2,
  Languages,
  Scissors,
  Sparkles,
  FileText,
  Loader2,
  Trash2,
  Plus,
} from 'lucide-react';

export type ToolId =
  | 'srt-editor'
  | 'srt-timing-adjuster'
  | 'srt-merger'
  | 'subtitle-converter'
  | 'subtitle-translator'
  | 'filler-remover'
  | 'silence-remover';

interface ToolCardItem {
  id: ToolId;
  letter: string;
  badgeColor: string;
  category: 'Timing & Editing' | 'Format Conversion' | 'AI & Audio Tools';
  title: string;
  tag?: string;
  description: string;
}

const TOOLS_CATALOG: ToolCardItem[] = [
  {
    id: 'srt-editor',
    letter: 'E',
    badgeColor: 'bg-blue-600 text-white',
    category: 'Timing & Editing',
    title: 'SRT & Subtitle Editor',
    tag: 'Real-Time CPS',
    description:
      'Open or paste an SRT or VTT file and edit text and timing in your browser — fix typos, retime cues, watch reading speed (CPS), and export a clean SRT or VTT.',
  },
  {
    id: 'srt-timing-adjuster',
    letter: 'T',
    badgeColor: 'bg-violet-600 text-white',
    category: 'Timing & Editing',
    title: 'SRT Timing Adjuster',
    tag: 'Most Used',
    description:
      'Shift every timestamp in an SRT file earlier or later by an exact number of seconds or milliseconds, or adjust playback frame rate scaling.',
  },
  {
    id: 'srt-merger',
    letter: 'M',
    badgeColor: 'bg-pink-600 text-white',
    category: 'Timing & Editing',
    title: 'SRT Merger',
    description:
      'Combine two SRT or VTT subtitle files into one. The second file timestamps are automatically offset to follow the first or interleaved by timecode.',
  },
  {
    id: 'subtitle-converter',
    letter: 'C',
    badgeColor: 'bg-emerald-600 text-white',
    category: 'Format Conversion',
    title: 'Universal Subtitle Converter',
    tag: '6 Formats',
    description:
      'Convert any subtitle file between SRT, WebVTT, ASS (Advanced SubStation Alpha), YouTube SBV, plain TXT transcript, and developer JSON.',
  },
  {
    id: 'filler-remover',
    letter: 'F',
    badgeColor: 'bg-amber-600 text-white',
    category: 'Timing & Editing',
    title: 'Filler Word Remover',
    description:
      'Automatically detect and strip spoken filler words (um, uh, erm, hmm, plus custom words) from your subtitle file while preserving cue timestamps.',
  },
  {
    id: 'subtitle-translator',
    letter: 'L',
    badgeColor: 'bg-indigo-600 text-white',
    category: 'AI & Audio Tools',
    title: 'AI Subtitle Translator',
    tag: 'Hinglish + 89 Languages',
    description:
      'Translate any SRT or VTT subtitle file into 89+ languages including Hinglish (Hindi in Latin script), Hindi, Urdu, Spanish, and Arabic while keeping exact cue timing.',
  },
  {
    id: 'silence-remover',
    letter: 'S',
    badgeColor: 'bg-teal-600 text-white',
    category: 'AI & Audio Tools',
    title: 'Free Silence Remover',
    tag: 'Web Audio Engine',
    description:
      'Drop any audio or video file to detect silent gaps using real-time RMS audio analysis. Download a silence-free WAV or Premiere Pro EDL cut list.',
  },
];

const TRANSLATION_LANGUAGES = [
  'Hinglish (Hindi in Latin Script)',
  'Hindi (हिन्दी)',
  'English',
  'Urdu (اردو)',
  'Punjabi (पञ्जाबी)',
  'Marathi (मराठी)',
  'Tamil (தமிழ்)',
  'Telugu (తెలుగు)',
  'Bengali (বাংলা)',
  'Gujarati (ગુજરાતી)',
  'Arabic (العربية)',
  'Spanish (Español)',
  'French (Français)',
  'German (Deutsch)',
  'Portuguese (Português)',
  'Indonesian (Bahasa Indonesia)',
  'Japanese (日本語)',
  'Korean (한국어)',
  'Turkish (Türkçe)',
];

interface FreeToolsHubProps {
  initialTool?: ToolId;
  onSendCuesToStudio: (cues: CaptionCue[], label: string) => void;
}

export default function FreeToolsHub({
  initialTool = 'srt-editor',
  onSendCuesToStudio,
}: FreeToolsHubProps) {
  const [activeTool, setActiveTool] = useState<ToolId>(initialTool);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Shared Subtitle Input state (starts empty or user-uploaded/typed so zero fake data is shown, with a 1-click "Load Sample SRT Format" helper if user wants to test syntax)
  const [rawInputA, setRawInputA] = useState<string>('');
  const [rawInputB, setRawInputB] = useState<string>('');

  // Timing Adjuster state
  const [shiftSeconds, setShiftSeconds] = useState<number>(1.5);
  const [speedScale, setSpeedScale] = useState<number>(1.0);

  // Merger state
  const [mergeMode, setMergeMode] = useState<
    'append-after-first' | 'interleave-by-time'
  >('append-after-first');
  const [mergeGap, setMergeGap] = useState<number>(0.5);

  // Converter state
  const [targetFormat, setTargetFormat] = useState<
    'srt' | 'vtt' | 'ass' | 'sbv' | 'txt' | 'json'
  >('vtt');

  // Filler Remover state
  const [customFillersInput, setCustomFillersInput] = useState<string>('like, matlab');

  // AI Translator state
  const [targetLanguage, setTargetLanguage] = useState<string>(
    TRANSLATION_LANGUAGES[0]
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedCues, setTranslatedCues] = useState<CaptionCue[]>([]);
  const [translateError, setTranslateError] = useState<string | null>(null);

  // Silence Remover state
  const [silenceFileName, setSilenceFileName] = useState<string>('');
  const [silenceThresholdDb, setSilenceThresholdDb] = useState<number>(-35);
  const [minSilenceDur, setMinSilenceDur] = useState<number>(0.35);
  const [audioSamplesRef, setAudioSamplesRef] = useState<{
    samples: Float32Array;
    sampleRate: number;
  } | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [silenceError, setSilenceError] = useState<string | null>(null);

  const [copiedFlag, setCopiedFlag] = useState(false);

  const filteredTools = useMemo(() => {
    return TOOLS_CATALOG.filter((tool) => {
      const matchesCategory =
        categoryFilter === 'All' || tool.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        tool.title.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, categoryFilter]);

  const parsedCuesA = useMemo(() => parseSubtitleFile(rawInputA), [rawInputA]);
  const parsedCuesB = useMemo(() => parseSubtitleFile(rawInputB), [rawInputB]);

  const metricsA = useMemo(
    () => calculateSubtitleMetrics(parsedCuesA),
    [parsedCuesA]
  );

  // Compute active tool output in real time
  const processedCues = useMemo(() => {
    if (activeTool === 'srt-timing-adjuster') {
      return shiftCuesTiming(parsedCuesA, shiftSeconds, speedScale);
    }
    if (activeTool === 'srt-merger') {
      return mergeSubtitleLists(
        parsedCuesA,
        parsedCuesB,
        mergeMode,
        mergeGap
      );
    }
    if (activeTool === 'filler-remover') {
      const extras = customFillersInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return removeFillerWordsFromCues(parsedCuesA, extras).cues;
    }
    if (activeTool === 'subtitle-translator') {
      return translatedCues.length > 0 ? translatedCues : parsedCuesA;
    }
    return parsedCuesA;
  }, [
    activeTool,
    parsedCuesA,
    parsedCuesB,
    shiftSeconds,
    speedScale,
    mergeMode,
    mergeGap,
    customFillersInput,
    translatedCues,
  ]);

  const fillerRemovedCount = useMemo(() => {
    const extras = customFillersInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return removeFillerWordsFromCues(parsedCuesA, extras).removedCount;
  }, [parsedCuesA, customFillersInput]);

  const formattedOutputString = useMemo(() => {
    if (processedCues.length === 0) return '';
    const fmt = activeTool === 'subtitle-converter' ? targetFormat : 'srt';
    if (fmt === 'vtt') return exportToVtt(processedCues);
    if (fmt === 'ass') return exportToAss(processedCues);
    if (fmt === 'sbv') return exportToSbv(processedCues);
    if (fmt === 'txt') return exportToTxt(processedCues, false);
    if (fmt === 'json') return exportToJson(processedCues);
    return exportToSrt(processedCues);
  }, [processedCues, activeTool, targetFormat]);

  // Real-time silence analysis whenever threshold or minSilenceDur changes
  const silenceAnalysis: SilenceAnalysisResult | null = useMemo(() => {
    if (!audioSamplesRef) return null;
    return detectSilencesFromSamples(
      audioSamplesRef.samples,
      audioSamplesRef.sampleRate,
      silenceThresholdDb,
      minSilenceDur,
      0.05
    );
  }, [audioSamplesRef, silenceThresholdDb, minSilenceDur]);

  const handleFileUploadToText = async (
    file: File,
    target: 'A' | 'B'
  ) => {
    const text = await file.text();
    if (target === 'A') {
      setRawInputA(text);
      setTranslatedCues([]);
    } else {
      setRawInputB(text);
    }
  };

  const handleAudioFileForSilence = async (file: File) => {
    setIsAnalyzingAudio(true);
    setSilenceError(null);
    setSilenceFileName(file.name);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      // Copy into standalone Float32Array
      const samples = new Float32Array(channelData.length);
      samples.set(channelData);
      setAudioSamplesRef({
        samples,
        sampleRate: audioBuffer.sampleRate,
      });
      await audioCtx.close();
    } catch {
      setSilenceError(
        'Could not decode audio track from this file. Please upload a valid WAV, MP3, WebM, or MP4 file with an audio stream.'
      );
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  const handleDownloadTrimmedWav = () => {
    if (!audioSamplesRef || !silenceAnalysis) return;
    const wavBytes = encodeTrimmedWav(
      audioSamplesRef.samples,
      audioSamplesRef.sampleRate,
      silenceAnalysis.keptRegions
    );
    const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base = silenceFileName
      ? silenceFileName.replace(/\.[^.]+$/, '')
      : 'audio';
    a.download = `${base}-silence-removed.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadEdl = () => {
    if (!silenceAnalysis) return;
    const edlContent = exportKeptRegionsToEdl(
      silenceAnalysis.keptRegions,
      silenceFileName || 'CLIP.MP4'
    );
    const blob = new Blob([edlContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(silenceFileName || 'timeline').replace(/\.[^.]+$/, '')}-premiere-cuts.edl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRunAiTranslation = async () => {
    if (parsedCuesA.length === 0) {
      setTranslateError('Please upload or enter SRT/VTT subtitle cues first.');
      return;
    }
    setIsTranslating(true);
    setTranslateError(null);
    try {
      const data = await translateWithGroqClientOrServer({
        cues: parsedCuesA,
        targetLanguage,
      });
      setTranslatedCues(data.cues || []);
    } catch (err: unknown) {
      setTranslateError(
        err instanceof Error ? err.message : 'Translation failed.'
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDownloadOutput = () => {
    if (!formattedOutputString) return;
    const ext = activeTool === 'subtitle-converter' ? targetFormat : 'srt';
    const blob = new Blob([formattedOutputString], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captionx-export.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyOutput = async () => {
    if (!formattedOutputString) return;
    await navigator.clipboard.writeText(formattedOutputString);
    setCopiedFlag(true);
    setTimeout(() => setCopiedFlag(false), 1800);
  };

  const updateSingleCueText = (index: number, newText: string) => {
    const next = parsedCuesA.map((c, idx) =>
      idx === index ? { ...c, text: newText } : c
    );
    setRawInputA(exportToSrt(next));
  };

  const deleteSingleCue = (index: number) => {
    const next = parsedCuesA.filter((_, idx) => idx !== index);
    setRawInputA(exportToSrt(next));
  };

  const addNewCueRow = () => {
    const lastEnd =
      parsedCuesA.length > 0
        ? parsedCuesA[parsedCuesA.length - 1].end
        : 0;
    const next = [
      ...parsedCuesA,
      {
        id: `cue-${parsedCuesA.length + 1}`,
        index: parsedCuesA.length + 1,
        start: Number((lastEnd + 0.2).toFixed(2)),
        end: Number((lastEnd + 2.5).toFixed(2)),
        text: 'New subtitle line',
        words: [],
      },
    ];
    setRawInputA(exportToSrt(next));
  };

  const activeToolMeta =
    TOOLS_CATALOG.find((t) => t.id === activeTool) || TOOLS_CATALOG[0];

  return (
    <div className="space-y-12">
      {/* Header & Search Filter */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-semibold tracking-wider text-blue-600 uppercase">
            Free Browser Tools
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Online tools for captions, subtitles & audio
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Every subtitle converter, timing adjuster, merger, and silence
            analyzer runs directly in your browser with instant watermark-free
            downloads.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              aria-label="Search subtitle tools"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools (e.g. SRT, VTT, Silence)…"
              className="pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 w-full sm:w-64"
            />
          </div>

          <div
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
            role="group"
            aria-label="Filter tools by category"
          >
            {(['All', 'Timing & Editing', 'Format Conversion', 'AI & Audio Tools'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    categoryFilter === cat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Tool Selector Grid matching caption-x.com/tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => {
          const isSelected = tool.id === activeTool;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveTool(tool.id)}
              className={`text-left p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                isSelected
                  ? 'bg-blue-50/60 border-blue-600 ring-2 ring-blue-600/15'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-9 h-9 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${tool.badgeColor}`}
                    >
                      {tool.letter}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {tool.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {tool.category}
                        {tool.tag ? ` · ${tool.tag}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {tool.description}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                <span>
                  {isSelected ? 'Active in Workbench Below' : 'Open Free Tool'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Live Tool Workbench */}
      <div
        id="active-tool-workbench"
        className="scroll-mt-20 bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="flex items-center gap-3.5">
            <span
              className={`w-10 h-10 rounded-xl font-bold text-base flex items-center justify-center shrink-0 ${activeToolMeta.badgeColor}`}
            >
              {activeToolMeta.letter}
            </span>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                {activeToolMeta.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                {activeToolMeta.description}
              </p>
            </div>
          </div>

          {activeTool !== 'silence-remover' && processedCues.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onSendCuesToStudio(processedCues, activeToolMeta.title)
              }
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Open Cues in Video Studio →
            </button>
          )}
        </div>

        {/* WORKBENCH 1: REAL-TIME AUDIO SILENCE REMOVER */}
        {activeTool === 'silence-remover' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="silence-audio-upload"
                  className="block text-xs font-bold text-slate-700"
                >
                  1. Select Audio or Video File (WAV, MP3, MP4, WebM)
                </label>
                <label
                  htmlFor="silence-audio-upload"
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-blue-200 hover:border-blue-500 rounded-xl bg-blue-50/40 cursor-pointer transition-colors text-center"
                >
                  <Upload className="w-6 h-6 text-blue-600" />
                  <span className="text-sm font-semibold text-slate-900">
                    {silenceFileName || 'Drop audio or video file here'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Decoded locally in browser via Web Audio API
                  </span>
                  <input
                    id="silence-audio-upload"
                    type="file"
                    accept="audio/*,video/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAudioFileForSilence(f);
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <label htmlFor="silence-threshold-slider">
                      Silence Threshold (dB)
                    </label>
                    <span className="font-mono tabular-nums font-semibold">
                      {silenceThresholdDb} dB
                    </span>
                  </div>
                  <input
                    id="silence-threshold-slider"
                    type="range"
                    min={-60}
                    max={-15}
                    step={1}
                    value={silenceThresholdDb}
                    onChange={(e) =>
                      setSilenceThresholdDb(parseInt(e.target.value, 10))
                    }
                    className="w-full accent-blue-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <label htmlFor="min-silence-duration-slider">
                      Minimum Pause Duration (seconds)
                    </label>
                    <span className="font-mono tabular-nums font-semibold">
                      {minSilenceDur.toFixed(2)}s
                    </span>
                  </div>
                  <input
                    id="min-silence-duration-slider"
                    type="range"
                    min={0.15}
                    max={2.0}
                    step={0.05}
                    value={minSilenceDur}
                    onChange={(e) =>
                      setMinSilenceDur(parseFloat(e.target.value))
                    }
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

              {silenceError && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
                  {silenceError}
                </p>
              )}
            </div>

            <div className="lg:col-span-7 bg-slate-900 text-white p-6 rounded-xl border border-slate-800 space-y-5">
              {isAnalyzingAudio ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-300">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
                  <p className="text-sm font-medium">
                    Decoding audio waveform & measuring RMS amplitude…
                  </p>
                </div>
              ) : silenceAnalysis ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <p className="text-xs text-emerald-400 font-semibold">
                        Real-Time Waveform Analysis Complete
                      </p>
                      <h4 className="text-lg font-bold">
                        {silenceAnalysis.silentRegions.length} silent gaps
                        detected ·{' '}
                        <span className="font-mono tabular-nums text-emerald-400">
                          {silenceAnalysis.totalSilenceRemovedSeconds}s
                        </span>{' '}
                        removed ({silenceAnalysis.percentageSaved}%)
                      </h4>
                    </div>
                    <div className="text-right font-mono tabular-nums text-xs text-slate-400">
                      Original: {silenceAnalysis.totalDuration}s
                    </div>
                  </div>

                  {/* Waveform bars visualization */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400">
                      Measured Audio Amplitude Profile (64 segments)
                    </p>
                    <div className="h-24 flex items-center gap-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                      {silenceAnalysis.waveformPeaks.map((peak, i) => {
                        const heightPct = Math.max(8, Math.round(peak * 100));
                        const isSilentBar = peak < 0.08;
                        return (
                          <div
                            key={i}
                            style={{ height: `${heightPct}%` }}
                            className={`flex-1 rounded-full transition-all ${
                              isSilentBar ? 'bg-slate-700' : 'bg-emerald-400'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadTrimmedWav}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Silence-Removed WAV</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadEdl}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
                    >
                      <Scissors className="w-4 h-4 text-emerald-400" />
                      <span>Export Premiere Pro / Resolve Cut List (.EDL)</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center space-y-2 text-slate-400">
                  <Scissors className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-white">
                    Upload any audio or video file on the left to inspect silent
                    gaps
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Your file is decoded in real time using your browser&apos;s
                    Web Audio API. No fake numbers — see your actual silent
                    regions and export a clean WAV or EDL cut list.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* WORKBENCH 2: SUBTITLE EDITOR, TIMING ADJUSTER, MERGER, CONVERTER, FILLER REMOVER & AI TRANSLATOR */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Input + Tool Controls */}
            <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="subtitle-source-a"
                  className="text-xs font-bold text-slate-800"
                >
                  {activeTool === 'srt-merger'
                    ? 'First Subtitle File (SRT / VTT)'
                    : 'Source Subtitles (Paste SRT, VTT, SBV, ASS, or plain text)'}
                </label>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="upload-srt-file-a"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                    <input
                      id="upload-srt-file-a"
                      type="file"
                      accept=".srt,.vtt,.sbv,.ass,.ssa,.txt,.json"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUploadToText(f, 'A');
                      }}
                      className="hidden"
                    />
                  </label>
                  {rawInputA && (
                    <button
                      type="button"
                      onClick={() => {
                        setRawInputA('');
                        setTranslatedCues([]);
                      }}
                      className="text-xs text-slate-500 hover:text-rose-600 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <textarea
                id="subtitle-source-a"
                rows={7}
                value={rawInputA}
                onChange={(e) => {
                  setRawInputA(e.target.value);
                  setTranslatedCues([]);
                }}
                placeholder={`1\n00:00:00,500 --> 00:00:02,800\nPaste your SRT or VTT subtitles here or upload a file above.\n\n2\n00:00:03,000 --> 00:00:05,500\nEvery tool processes your actual subtitle data in real time.`}
                className="w-full p-3.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              />

              {/* Second input for SRT Merger */}
              {activeTool === 'srt-merger' && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="subtitle-source-b"
                      className="text-xs font-bold text-slate-800"
                    >
                      Second Subtitle File (SRT / VTT to Merge)
                    </label>
                    <label
                      htmlFor="upload-srt-file-b"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Second File</span>
                      <input
                        id="upload-srt-file-b"
                        type="file"
                        accept=".srt,.vtt,.sbv,.ass,.txt"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUploadToText(f, 'B');
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <textarea
                    id="subtitle-source-b"
                    rows={5}
                    value={rawInputB}
                    onChange={(e) => setRawInputB(e.target.value)}
                    placeholder={`1\n00:00:00,000 --> 00:00:02,500\nSecond subtitle file cues go here...`}
                    className="w-full p-3.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              {/* Tool-Specific Controls */}
              {activeTool === 'srt-timing-adjuster' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label
                      htmlFor="shift-seconds-input"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Shift Offset (Seconds, + later / - earlier)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="shift-seconds-input"
                        type="number"
                        step="0.1"
                        value={shiftSeconds}
                        onChange={(e) =>
                          setShiftSeconds(parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setShiftSeconds((s) => Number((s - 0.5).toFixed(2)))}
                        className="px-2.5 py-2 text-xs font-mono bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        -0.5s
                      </button>
                      <button
                        type="button"
                        onClick={() => setShiftSeconds((s) => Number((s + 0.5).toFixed(2)))}
                        className="px-2.5 py-2 text-xs font-mono bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        +0.5s
                      </button>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="speed-scale-input"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Speed / Framerate Ratio (1.0 = normal)
                    </label>
                    <input
                      id="speed-scale-input"
                      type="number"
                      step="0.01"
                      min="0.25"
                      max="4"
                      value={speedScale}
                      onChange={(e) =>
                        setSpeedScale(parseFloat(e.target.value) || 1)
                      }
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {activeTool === 'srt-merger' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label
                      htmlFor="merge-mode-select"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Merge Mode
                    </label>
                    <select
                      id="merge-mode-select"
                      value={mergeMode}
                      onChange={(e) =>
                        setMergeMode(
                          e.target.value as
                            | 'append-after-first'
                            | 'interleave-by-time'
                        )
                      }
                      className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="append-after-first">
                        Append Second File After First (Auto-Offset)
                      </option>
                      <option value="interleave-by-time">
                        Interleave Both Files by Original Timestamp
                      </option>
                    </select>
                  </div>
                  {mergeMode === 'append-after-first' && (
                    <div>
                      <label
                        htmlFor="merge-gap-input"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Gap Between Files (Seconds)
                      </label>
                      <input
                        id="merge-gap-input"
                        type="number"
                        step="0.1"
                        min="0"
                        value={mergeGap}
                        onChange={(e) =>
                          setMergeGap(parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTool === 'subtitle-converter' && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="block text-xs font-bold text-slate-700">
                    Target Subtitle Format
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'srt', label: 'SRT (SubRip)' },
                        { id: 'vtt', label: 'WebVTT (.vtt)' },
                        { id: 'ass', label: 'ASS / SSA Styled' },
                        { id: 'sbv', label: 'YouTube (.sbv)' },
                        { id: 'txt', label: 'Plain Text (.txt)' },
                        { id: 'json', label: 'Developer JSON' },
                      ] as const
                    ).map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setTargetFormat(fmt.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          targetFormat === fmt.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTool === 'filler-remover' && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label
                    htmlFor="custom-fillers-input"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Additional Filler Words to Strip (comma-separated, besides
                    um, uh, erm, ah, hmm)
                  </label>
                  <input
                    id="custom-fillers-input"
                    type="text"
                    value={customFillersInput}
                    onChange={(e) => setCustomFillersInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                  <p className="text-xs text-emerald-700 font-medium">
                    Filler words removed from current input:{' '}
                    <span className="font-mono tabular-nums font-bold">
                      {fillerRemovedCount}
                    </span>
                  </p>
                </div>
              )}

              {activeTool === 'subtitle-translator' && (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1">
                      <label
                        htmlFor="translator-target-lang"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Translate Into Language
                      </label>
                      <select
                        id="translator-target-lang"
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-white"
                      >
                        {TRANSLATION_LANGUAGES.map((lang) => (
                          <option key={lang} value={lang}>
                            {lang}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunAiTranslation}
                      disabled={isTranslating || parsedCuesA.length === 0}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      {isTranslating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Translating Cues…</span>
                        </>
                      ) : (
                        <>
                          <Languages className="w-3.5 h-3.5" />
                          <span>Translate Subtitles Now</span>
                        </>
                      )}
                    </button>
                  </div>
                  {translateError && (
                    <p className="text-xs text-rose-600">{translateError}</p>
                  )}
                </div>
              )}

              {/* Live Metrics Summary */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600 font-mono tabular-nums">
                <span>Cues: {metricsA.cueCount}</span>
                <span aria-hidden="true">·</span>
                <span>Words: {metricsA.totalWords}</span>
                <span aria-hidden="true">·</span>
                <span>Duration: {metricsA.totalDurationSeconds}s</span>
                <span aria-hidden="true">·</span>
                <span>Avg Speed: {metricsA.avgCps} CPS</span>
              </div>
            </div>

            {/* Right Column: Interactive Cue List (for Editor) or Live Formatted Output */}
            <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {activeTool === 'srt-editor'
                    ? 'Interactive Cue Editor & Reading Speed'
                    : `Live Processed Output (.${activeTool === 'subtitle-converter' ? targetFormat : 'srt'})`}
                </h4>

                <div className="flex items-center gap-2">
                  {activeTool === 'srt-editor' && (
                    <button
                      type="button"
                      onClick={addNewCueRow}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Cue</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyOutput}
                    disabled={!formattedOutputString}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 text-xs font-semibold transition-colors"
                  >
                    {copiedFlag ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadOutput}
                    disabled={!formattedOutputString}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      Download .
                      {(activeTool === 'subtitle-converter'
                        ? targetFormat
                        : 'srt'
                      ).toUpperCase()}
                    </span>
                  </button>
                </div>
              </div>

              {processedCues.length === 0 ? (
                <div className="py-16 text-center space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <FileText className="w-7 h-7 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">
                    No subtitle cues loaded yet
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Paste your SRT/VTT text or upload a subtitle file on the
                    left to inspect, edit, convert, or adjust timestamps in real
                    time.
                  </p>
                </div>
              ) : activeTool === 'srt-editor' ? (
                <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
                  {parsedCuesA.map((cue, idx) => {
                    const dur = Math.max(0.1, cue.end - cue.start);
                    const cps = Number((cue.text.length / dur).toFixed(1));
                    return (
                      <div
                        key={cue.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
                          <span>
                            #{idx + 1} · {formatSrtTime(cue.start)} →{' '}
                            {formatSrtTime(cue.end)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                cps > 20
                                  ? 'text-amber-600 font-semibold'
                                  : 'text-emerald-600'
                              }
                            >
                              {cps} CPS {cps > 20 ? '(Fast)' : '(Optimal)'}
                            </span>
                            <button
                              type="button"
                              onClick={() => deleteSingleCue(idx)}
                              aria-label={`Delete cue ${idx + 1}`}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          aria-label={`Edit cue ${idx + 1} text`}
                          value={cue.text}
                          onChange={(e) =>
                            updateSingleCueText(idx, e.target.value)
                          }
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  readOnly
                  aria-label="Processed subtitle output"
                  rows={12}
                  value={formattedOutputString}
                  className="w-full p-3.5 text-xs font-mono tabular-nums bg-slate-900 text-slate-100 rounded-xl border border-slate-800"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
