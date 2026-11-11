'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  CaptionCue,
  CaptionStyleConfig,
  CaptionStylePreset,
  DEFAULT_STYLE_PRESETS,
  parseSubtitleFile,
  exportToSrt,
  exportToVtt,
  exportToAss,
  exportToSbv,
  exportToTxt,
  exportToJson,
  regroupCuesByMaxWords,
  removeFillerWordsFromCues,
  calculateSubtitleMetrics,
  computeWordTimings,
  formatSrtTime,
  sliderValueToYPosition,
  yPositionToSliderValue,
} from '@/lib/subtitles';
import CaptionCanvasPlayer from './CaptionCanvasPlayer';
import FreeToolsHub, { ToolId } from './FreeToolsHub';
import {
  ACTIVE_GROQ_STT_MODELS,
  ACTIVE_GROQ_LLM_MODELS,
  GROQ_API_BASE,
  getGroqApiKey,
  transcribeWithGroqClientOrServer,
  translateWithGroqClientOrServer,
} from '@/lib/groq';
import { encodeTrimmedWav } from '@/lib/audio-silence';
import { safeParseResponseJson } from '@/lib/utils';
import {
  Upload,
  Sparkles,
  Mic,
  Square,
  Download,
  Plus,
  Trash2,
  Languages,
  Scissors,
  Type as TypeIcon,
  Palette,
  Sliders,
  FileText,
  Loader2,
  CheckCircle2,
  Video,
  Globe,
  ChevronDown,
  Wand2,
} from 'lucide-react';

const STUDIO_LANGUAGES = [
  { code: 'auto', name: 'Auto-Detect Language', script: 'All Scripts', region: 'Global' },
  { code: 'hinglish', name: 'Hinglish (Hindi in Latin)', script: 'Latin (Reels/Shorts)', region: 'India' },
  { code: 'Hindi', name: 'Hindi (हिन्दी)', script: 'Devanagari', region: 'India' },
  { code: 'English', name: 'English', script: 'Latin', region: 'Global' },
  { code: 'Urdu', name: 'Urdu (اردو)', script: 'Perso-Arabic / Roman', region: 'South Asia' },
  { code: 'Punjabi', name: 'Punjabi (ਪੰਜਾਬੀ)', script: 'Gurmukhi / Latin', region: 'India & Pakistan' },
  { code: 'Marathi', name: 'Marathi (मराठी)', script: 'Devanagari', region: 'India' },
  { code: 'Tamil', name: 'Tamil (தமிழ்)', script: 'Tamil', region: 'India & Sri Lanka' },
  { code: 'Telugu', name: 'Telugu (తెలుగు)', script: 'Telugu', region: 'India' },
  { code: 'Bengali', name: 'Bengali (বাংলা)', script: 'Bengali', region: 'India & Bangladesh' },
  { code: 'Gujarati', name: 'Gujarati (ગુજરાતી)', script: 'Gujarati', region: 'India' },
  { code: 'Arabic', name: 'Arabic (العربية)', script: 'RTL Arabic', region: 'MENA' },
  { code: 'Spanish', name: 'Spanish (Español)', script: 'Latin', region: 'Europe & LatAm' },
  { code: 'Portuguese', name: 'Portuguese (Português)', script: 'Latin', region: 'Brazil & Portugal' },
  { code: 'French', name: 'French (Français)', script: 'Latin', region: 'Europe & Africa' },
  { code: 'German', name: 'German (Deutsch)', script: 'Latin', region: 'Europe' },
  { code: 'Indonesian', name: 'Indonesian (Bahasa)', script: 'Latin', region: 'Southeast Asia' },
  { code: 'Japanese', name: 'Japanese (日本語)', script: 'Kanji / Kana', region: 'East Asia' },
  { code: 'Korean', name: 'Korean (한국어)', script: 'Hangul', region: 'East Asia' },
  { code: 'Turkish', name: 'Turkish (Türkçe)', script: 'Latin', region: 'Eurasia' },
];

const FAQ_ITEMS = [
  {
    q: 'Are exported videos really free of watermarks?',
    a: 'Yes. Every video rendered in CaptionX Free Studio is 100% free of watermarks, logos, or corner branding. Both your burned-in video export (.webm / .mp4) and your subtitle files (.srt, .vtt, .ass, .sbv, .txt, .json) download cleanly.',
  },
  {
    q: 'Does it support Hinglish and Indian regional languages?',
    a: 'Yes. Select "Hinglish (Hindi in Latin)" to transcribe or translate Hindi speech into Roman/Latin script popular on Instagram Reels and YouTube Shorts, or choose native Devanagari Hindi, Urdu, Punjabi, Tamil, Telugu, Marathi, Bengali, or Gujarati.',
  },
  {
    q: 'How does the browser video captioning and export work?',
    a: 'When you upload or record a video or audio clip, Gemini AI transcribes your speech with timestamps. The studio then renders your video and animated word-by-word captions on an HTML5 60fps canvas and records the output directly in your browser with zero watermark.',
  },
  {
    q: 'Can I edit individual words, timestamps, or import my own SRT file?',
    a: 'Yes. You can import any existing .srt, .vtt, .ass, or .sbv subtitle file, edit every cue text and start/end timestamp in real time, strip filler words (um, uh), and regroup lines by maximum words per cue.',
  },
];

export default function CaptionStudioApp() {
  // Media state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'audio' | null>(null);
  const [mediaFileName, setMediaFileName] = useState<string>('');

  // Live Browser Recording state (so users can record real voice/camera clips on the spot)
  const [isRecordingMedia, setIsRecordingMedia] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'audio' | 'video' | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Subtitle cues state (starts empty until user uploads media, imports SRT, or adds cues — no fake pre-populated reviews/data)
  const [cues, setCues] = useState<CaptionCue[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(12);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');

  // Style configuration state
  const [styleConfig, setStyleConfig] = useState<CaptionStyleConfig>(
    DEFAULT_STYLE_PRESETS['hormozi-pop'].config
  );
  const [activeStudioTab, setActiveStudioTab] = useState<'transcript' | 'style' | 'export'>('transcript');

  // AI Transcription & Translation state (Groq Live Active Models)
  const [selectedLanguage, setSelectedLanguage] = useState<string>('hinglish');
  const [selectedSttModel, setSelectedSttModel] = useState<string>(
    'whisper-large-v3'
  );
  const [selectedLlmModel, setSelectedLlmModel] = useState<string>(
    'openai/gpt-oss-120b'
  );
  const [liveGroqModelsCount, setLiveGroqModelsCount] = useState<number>(11);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeStatus, setTranscribeStatus] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const extractedWavCacheRef = useRef<{ file: File; blob: Blob; duration: number } | null>(null);

  React.useEffect(() => {
    const checkModels = async () => {
      try {
        if (typeof window !== 'undefined') {
          const r = await fetch('/api/groq-models');
          if (r.ok) {
            const d = await safeParseResponseJson<{ models?: Array<{ id: string }> }>(r);
            if (Array.isArray(d.models) && d.models.length > 0) {
              setLiveGroqModelsCount(d.models.length);
              return;
            }
          }
        }
        const directRes = await fetch(`${GROQ_API_BASE}/models`, {
          headers: { Authorization: `Bearer ${getGroqApiKey()}` },
        });
        const directData = await safeParseResponseJson<{
          data?: Array<{ id: string; active?: boolean }>;
        }>(directRes);
        if (Array.isArray(directData.data) && directData.data.length > 0) {
          setLiveGroqModelsCount(directData.data.length);
        }
      } catch {
        // Keep default count if offline
      }
    };
    checkModels();
  }, []);

  // Paste SRT quick modal/drawer inside studio
  const [pasteSrtOpen, setPasteSrtOpen] = useState(false);
  const [pasteSrtText, setPasteSrtText] = useState('');

  // Language search filter
  const [langSearch, setLangSearch] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [selectedToolId, setSelectedToolId] = useState<ToolId>('srt-editor');

  const metrics = useMemo(() => calculateSubtitleMetrics(cues), [cues]);

  const filteredLanguages = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return STUDIO_LANGUAGES;
    return STUDIO_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.region.toLowerCase().includes(q) ||
        l.script.toLowerCase().includes(q)
    );
  }, [langSearch]);

  // Handle uploading video, audio, or subtitle file
  const handleSelectFile = async (file: File) => {
    setTranscribeError(null);
    setTranscribeStatus(null);

    const lower = file.name.toLowerCase();
    if (
      lower.endsWith('.srt') ||
      lower.endsWith('.vtt') ||
      lower.endsWith('.ass') ||
      lower.endsWith('.sbv') ||
      lower.endsWith('.json')
    ) {
      const text = await file.text();
      const parsed = parseSubtitleFile(text);
      setCues(parsed);
      if (parsed.length > 0) {
        const maxEnd = Math.max(...parsed.map((c) => c.end));
        setDuration(Math.max(5, maxEnd + 1));
      }
      setMediaFileName(file.name);
      document
        .getElementById('studio-workspace')
        ?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    const url = URL.createObjectURL(file);
    const isVideo =
      file.type.startsWith('video/') ||
      lower.endsWith('.mp4') ||
      lower.endsWith('.mov') ||
      lower.endsWith('.webm');

    setMediaFile(file);
    setMediaUrl(url);
    setMediaType(isVideo ? 'video' : 'audio');
    setMediaFileName(file.name);
    setAspectRatio(isVideo ? '9:16' : '1:1');

    document
      .getElementById('studio-workspace')
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  // Start / Stop real WebRTC Microphone or Camera recording
  const startLiveRecording = async (mode: 'audio' | 'video') => {
    setTranscribeError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video' ? { width: 720, height: 1280 } : false,
      });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const mime = mode === 'video' ? 'video/webm' : 'audio/webm';
        const ext = 'webm';
        const blob = new Blob(chunks, { type: mime });
        const recordedFile = new File([blob], `live-recording.${ext}`, {
          type: mime,
        });
        handleSelectFile(recordedFile);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingMedia(true);
      setRecordingMode(mode);
    } catch {
      setTranscribeError(
        'Microphone/camera permission was denied or is unavailable on this device. Please upload a video, audio, or SRT file instead.'
      );
    }
  };

  const stopLiveRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingMedia(false);
    setRecordingMode(null);
  };

  // Extract 12kHz mono WAV from any uploaded video/audio file (isolated from <video> playback) and call Groq Whisper + AI Spelling Proofreader
  const handleAutoTranscribeMedia = async () => {
    if (!mediaFile) {
      setTranscribeError(
        'Please upload a video or audio file (or record your voice) first to auto-generate AI captions.'
      );
      return;
    }

    setIsTranscribing(true);
    setTranscribeError(null);
    setTranscribeStatus(
      `Transcribing & proofreading captions with Groq ${selectedSttModel} + ${selectedLlmModel}…`
    );

    try {
      let uploadBlob: Blob;
      let uploadName = mediaFile.name || 'audio.wav';
      let knownDuration = duration;

      if (
        extractedWavCacheRef.current &&
        extractedWavCacheRef.current.file === mediaFile
      ) {
        uploadBlob = extractedWavCacheRef.current.blob;
        uploadName = 'extracted-audio.wav';
        knownDuration = extractedWavCacheRef.current.duration;
        if (knownDuration > 0) setDuration(knownDuration);
      } else {
        const clonedFile = mediaFile.slice(0, mediaFile.size, mediaFile.type);
        const arrayBuf = await clonedFile.arrayBuffer();

        // Downsample to 12kHz mono WAV in browser so even large 4K/1080p videos become a compact ~1.4MB/min audio stream
        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const audioCtx = new AudioCtx({ sampleRate: 12000 });
          const decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0));
          const channel = decoded.getChannelData(0);
          const wavBytes = encodeTrimmedWav(channel, decoded.sampleRate, [
            { start: 0, end: decoded.duration, duration: decoded.duration },
          ]);
          uploadBlob = new Blob([wavBytes.buffer as ArrayBuffer], {
            type: 'audio/wav',
          });
          uploadName = 'extracted-audio.wav';
          if (Number.isFinite(decoded.duration) && decoded.duration > 0) {
            knownDuration = decoded.duration;
            setDuration(decoded.duration);
          }
          extractedWavCacheRef.current = {
            file: mediaFile,
            blob: uploadBlob,
            duration: knownDuration,
          };
          await audioCtx.close();
        } catch {
          uploadBlob = new Blob([arrayBuf], {
            type: mediaFile.type || 'audio/wav',
          });
        }
      }

      const data = await transcribeWithGroqClientOrServer({
        audioBlob: uploadBlob,
        fileName: uploadName,
        language: selectedLanguage,
        sttModel: selectedSttModel,
        llmModel: selectedLlmModel,
        maxWordsPerLine: styleConfig.maxWordsPerLine,
        durationSeconds: knownDuration,
      });

      const generatedCues: CaptionCue[] = data.cues || [];
      setCues(generatedCues);
      if (generatedCues.length > 0) {
        const lastEnd = Math.max(...generatedCues.map((c) => c.end));
        if (lastEnd > knownDuration) setDuration(lastEnd + 0.5);
      }
      setTranscribeStatus(
        `Generated & proofread ${generatedCues.length} word-timed cues via Groq (${data.modelUsed || selectedSttModel}).`
      );
    } catch (err: unknown) {
      setTranscribeError(
        err instanceof Error ? err.message : 'Could not transcribe file.'
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTranslateStudioCues = async () => {
    if (cues.length === 0) {
      setTranscribeError(
        'Add or generate subtitle cues first before translating.'
      );
      return;
    }
    setIsTranscribing(true);
    setTranscribeError(null);
    setTranscribeStatus(
      `Translating ${cues.length} cues into ${selectedLanguage} via Groq (${selectedLlmModel})…`
    );

    try {
      const data = await translateWithGroqClientOrServer({
        cues,
        targetLanguage: selectedLanguage,
        llmModel: selectedLlmModel,
      });
      setCues(data.cues || []);
      setTranscribeStatus(
        `Translated ${cues.length} cues to ${selectedLanguage} via Groq (${data.modelUsed || selectedLlmModel}).`
      );
    } catch (err: unknown) {
      setTranscribeError(
        err instanceof Error ? err.message : 'Translation failed.'
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleApplyPreset = (presetKey: CaptionStylePreset) => {
    setStyleConfig(DEFAULT_STYLE_PRESETS[presetKey].config);
  };

  const handleAddCue = () => {
    const lastEnd =
      cues.length > 0 ? Math.max(...cues.map((c) => c.end)) : 0;
    const start = Number((lastEnd + 0.1).toFixed(2));
    const end = Number((start + 2.4).toFixed(2));
    const text = 'Type your caption text here';
    const nextCue: CaptionCue = {
      id: `cue-${Date.now()}`,
      index: cues.length + 1,
      start,
      end,
      text,
      words: computeWordTimings(text, start, end),
    };
    const updated = [...cues, nextCue];
    setCues(updated);
    if (end > duration) setDuration(end + 1);
    setCurrentTime(start + 0.1);
  };

  const handleUpdateCue = (
    idx: number,
    patch: Partial<{ start: number; end: number; text: string }>
  ) => {
    setCues((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const start = patch.start !== undefined ? Math.max(0, patch.start) : c.start;
        const end =
          patch.end !== undefined ? Math.max(start + 0.1, patch.end) : c.end;
        const text = patch.text !== undefined ? patch.text : c.text;
        return {
          ...c,
          start,
          end,
          text,
          words: computeWordTimings(text, start, end),
        };
      })
    );
  };

  const handleDeleteCue = (idx: number) => {
    setCues((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStripFillers = () => {
    const { cues: cleaned, removedCount } = removeFillerWordsFromCues(cues);
    setCues(cleaned);
    setTranscribeStatus(`Removed ${removedCount} filler words.`);
  };

  const handleRegroupWords = (maxWords: number) => {
    setStyleConfig((prev) => ({ ...prev, maxWordsPerLine: maxWords }));
    if (cues.length > 0) {
      setCues((prev) => regroupCuesByMaxWords(prev, maxWords));
    }
  };

  const handleDownloadSubtitleFile = (
    format: 'srt' | 'vtt' | 'ass' | 'sbv' | 'txt' | 'json'
  ) => {
    if (cues.length === 0) return;
    let content = '';
    if (format === 'srt') content = exportToSrt(cues);
    if (format === 'vtt') content = exportToVtt(cues);
    if (format === 'ass') content = exportToAss(cues, styleConfig);
    if (format === 'sbv') content = exportToSbv(cues);
    if (format === 'txt') content = exportToTxt(cues, false);
    if (format === 'json') content = exportToJson(cues);

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = mediaFileName
      ? mediaFileName.replace(/\.[^.]+$/, '')
      : 'captions';
    a.href = url;
    a.download = `${base}-no-watermark.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportPastedSrt = () => {
    const parsed = parseSubtitleFile(pasteSrtText);
    if (parsed.length > 0) {
      setCues(parsed);
      const maxEnd = Math.max(...parsed.map((c) => c.end));
      setDuration(Math.max(duration, maxEnd + 1));
      setPasteSrtOpen(false);
      setPasteSrtText('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="text-xl font-black tracking-tight text-slate-950 whitespace-nowrap shrink-0"
        >
          CAPTION <span className="text-blue-600">X</span>
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-600"
        >
          <a
            href="#studio-workspace"
            className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Caption Studio
          </a>
          <a
            href="#free-tools"
            className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Free Tools
          </a>
          <a
            href="#silence-remover-section"
            className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Silence Remover
          </a>
          <a
            href="#languages-section"
            className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Languages
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <a
            href="#studio-workspace"
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            Open Free Studio
          </a>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* HERO + AUTO CAPTION UPLOAD SECTION (Inspired by caption-x.com & caption-x.com/studio, 100% Free & No Watermark, Zero Fake Data) */}
        <section className="relative overflow-hidden bg-gradient-to-b from-sky-50/70 via-white to-white pt-12 pb-16 px-4 sm:px-6 lg:px-8 border-b border-slate-100">
          <div className="max-w-6xl mx-auto space-y-10">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <p className="text-xs font-semibold text-blue-600 tracking-wide">
                100% Free Browser Studio · Zero Watermark on Video & SRT Exports · Hinglish & 100+ Languages
              </p>
              <h1
                className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.08]"
                style={{ textWrap: 'balance' }}
              >
                Automatic Captions for{' '}
                <span
                  className="text-teal-600 font-semibold italic"
                  style={{ fontFamily: 'var(--font-fraunces), serif' }}
                >
                  Every Video & Reel
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Upload a video or audio clip, auto-generate word-timed captions
                with AI, customize animated styles, and export a captioned
                video right in your browser — completely free and with{' '}
                <strong className="font-semibold text-slate-900">
                  no watermark
                </strong>
                .
              </p>
            </div>

            {/* CaptionX Studio Upload Box */}
            <div className="max-w-3xl mx-auto">
              <div className="rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-8 sm:p-10 text-center space-y-6 transition-colors hover:border-blue-400">
                <div className="w-14 h-14 rounded-2xl bg-blue-100/80 border border-blue-200 flex items-center justify-center mx-auto text-blue-600">
                  <Upload className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Drag & drop your video, song, or SRT file
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Video (MP4, MOV, WebM) · Audio (MP3, WAV) · Subtitles (SRT,
                    VTT, ASS, SBV) · Export with zero watermark
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <label
                    htmlFor="hero-media-upload"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose a File</span>
                    <input
                      id="hero-media-upload"
                      type="file"
                      accept="video/*,audio/*,.srt,.vtt,.ass,.sbv,.json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSelectFile(file);
                      }}
                      className="hidden"
                    />
                  </label>

                  {!isRecordingMedia ? (
                    <>
                      <button
                        type="button"
                        onClick={() => startLiveRecording('audio')}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                      >
                        <Mic className="w-4 h-4 text-blue-600" />
                        <span>Record Voice Clip</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startLiveRecording('video')}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                      >
                        <Video className="w-4 h-4 text-teal-600" />
                        <span>Record Camera Clip</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={stopLiveRecording}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0"
                    >
                      <Square className="w-4 h-4" />
                      <span>
                        Stop {recordingMode === 'video' ? 'Camera' : 'Voice'}{' '}
                        Recording
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setPasteSrtOpen(true);
                      document
                        .getElementById('studio-workspace')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>Paste SRT / Transcript</span>
                  </button>
                </div>
              </div>

              {/* 3-Step Flow Indicator matching caption-x.com/studio */}
              <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto mt-8 text-center">
                <div className="space-y-1">
                  <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-600 font-bold text-xs flex items-center justify-center mx-auto font-mono tabular-nums">
                    1
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    Upload or Record
                  </p>
                  <p className="text-xs text-slate-500">Video, audio, or SRT</p>
                </div>
                <div className="space-y-1">
                  <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-600 font-bold text-xs flex items-center justify-center mx-auto font-mono tabular-nums">
                    2
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    Edit & Style
                  </p>
                  <p className="text-xs text-slate-500">
                    AI transcribe + templates
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center justify-center mx-auto font-mono tabular-nums">
                    3
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    Export Clean Video
                  </p>
                  <p className="text-xs text-emerald-700 font-medium">
                    Zero watermark
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE CAPTION STUDIO WORKSPACE */}
        <section
          id="studio-workspace"
          className="scroll-mt-20 py-14 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Interactive Browser Studio
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Caption Studio & Watermark-Free Exporter
              </h2>
            </div>

            {/* Real-time Computed Session Metrics */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-mono tabular-nums">
              <span>Active Cues: {metrics.cueCount}</span>
              <span aria-hidden="true">·</span>
              <span>Total Words: {metrics.totalWords}</span>
              <span aria-hidden="true">·</span>
              <span>Reading Speed: {metrics.avgCps} CPS</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 font-sans font-semibold">
                Watermark: Disabled (Free)
              </span>
            </div>
          </div>

          {transcribeError && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-700 font-medium"
            >
              {transcribeError}
            </div>
          )}

          {transcribeStatus && !transcribeError && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-800 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{transcribeStatus}</span>
            </div>
          )}

          {/* Paste SRT Drawer if toggled */}
          {pasteSrtOpen && (
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="studio-paste-srt-textarea"
                  className="text-xs font-bold text-slate-800"
                >
                  Paste SRT, VTT, ASS, or plain text lines (auto-timed if no
                  timestamps are present)
                </label>
                <button
                  type="button"
                  onClick={() => setPasteSrtOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Close
                </button>
              </div>
              <textarea
                id="studio-paste-srt-textarea"
                rows={5}
                value={pasteSrtText}
                onChange={(e) => setPasteSrtText(e.target.value)}
                placeholder={`1\n00:00:00,000 --> 00:00:02,500\nAaj hum baat karenge how to edit reels fast\n\n2\n00:00:02,600 --> 00:00:05,200\nBilkul free aur bina kisi watermark ke`}
                className="w-full p-3 text-xs font-mono bg-white border border-slate-200 rounded-xl"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleImportPastedSrt}
                  disabled={!pasteSrtText.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold transition-colors"
                >
                  Load Cues into Studio
                </button>
              </div>
            </div>
          )}

          {/* 3-Column Studio Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* LEFT PANEL (Cols 1-4): AI Transcription + Cue Editor */}
            <div className="lg:col-span-4 bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {/* AI Controls Box */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Groq AI Engine ({liveGroqModelsCount} Live Models)
                    </span>
                    <label
                      htmlFor="studio-quick-upload"
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Change File
                      <input
                        id="studio-quick-upload"
                        type="file"
                        accept="video/*,audio/*,.srt,.vtt,.ass,.sbv"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleSelectFile(f);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label
                      htmlFor="studio-language-select"
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Spoken or Target Language
                    </label>
                    <select
                      id="studio-language-select"
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      {STUDIO_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} — {lang.script}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="studio-stt-model-select"
                        className="block text-[10px] font-semibold text-slate-500 mb-1"
                      >
                        Groq Speech Model (Live)
                      </label>
                      <select
                        id="studio-stt-model-select"
                        value={selectedSttModel}
                        onChange={(e) => setSelectedSttModel(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-[11px] font-mono font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        {ACTIVE_GROQ_STT_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="studio-llm-model-select"
                        className="block text-[10px] font-semibold text-slate-500 mb-1"
                      >
                        Groq Translation LLM (Live)
                      </label>
                      <select
                        id="studio-llm-model-select"
                        value={selectedLlmModel}
                        onChange={(e) => setSelectedLlmModel(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-[11px] font-mono font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        {ACTIVE_GROQ_LLM_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleAutoTranscribeMedia}
                      disabled={isTranscribing || !mediaFile}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                    >
                      {isTranscribing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Working…</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>Auto-Caption</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleTranslateStudioCues}
                      disabled={isTranscribing || cues.length === 0}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      <Languages className="w-3.5 h-3.5" />
                      <span>Translate Cues</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleStripFillers}
                      disabled={cues.length === 0}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40"
                    >
                      Cut &quot;um / uh&quot; fillers
                    </button>
                    <button
                      type="button"
                      onClick={() => setPasteSrtOpen(true)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      Paste SRT / Lines
                    </button>
                  </div>
                </div>

                {/* Cue List Header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Timed Subtitle Cues ({cues.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCue}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Cue</span>
                  </button>
                </div>

                {/* Scrollable Cue Editor List */}
                {cues.length === 0 ? (
                  <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-white space-y-3">
                    <FileText className="w-7 h-7 text-slate-400 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-bold text-slate-800">
                        No caption cues added yet
                      </p>
                      <p className="text-xs text-slate-500">
                        Upload a video/audio file and click{' '}
                        <strong>Auto-Caption</strong>, paste an SRT file, or
                        add a manual cue below to preview animated captions on
                        the canvas.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddCue}
                        className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                      >
                        + Add First Caption Cue
                      </button>
                      <button
                        type="button"
                        onClick={() => setPasteSrtOpen(true)}
                        className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
                      >
                        Paste SRT Text
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
                    {cues.map((cue, idx) => {
                      const isCurrent =
                        currentTime >= cue.start && currentTime <= cue.end;
                      return (
                        <div
                          key={cue.id}
                          onClick={() => setCurrentTime(cue.start + 0.05)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                            isCurrent
                              ? 'bg-blue-50/90 border-blue-500 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-700">
                                #{idx + 1}
                              </span>
                              <input
                                type="number"
                                aria-label={`Cue ${idx + 1} start time in seconds`}
                                step="0.1"
                                min="0"
                                value={cue.start}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  handleUpdateCue(idx, {
                                    start: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
                              />
                              <span>→</span>
                              <input
                                type="number"
                                aria-label={`Cue ${idx + 1} end time in seconds`}
                                step="0.1"
                                min="0.1"
                                value={cue.end}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  handleUpdateCue(idx, {
                                    end: parseFloat(e.target.value) || 1,
                                  })
                                }
                                className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
                              />
                              <span>s</span>
                            </div>

                            <button
                              type="button"
                              aria-label={`Delete cue ${idx + 1}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCue(idx);
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <input
                            type="text"
                            aria-label={`Cue ${idx + 1} caption text`}
                            value={cue.text}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleUpdateCue(idx, { text: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Subtitle Download Bar */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">
                  Export Subtitle Track:
                </span>
                <div className="flex items-center gap-1.5">
                  {(['srt', 'vtt', 'ass', 'txt'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      disabled={cues.length === 0}
                      onClick={() => handleDownloadSubtitleFile(fmt)}
                      className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 text-[11px] font-mono font-bold text-slate-700 uppercase transition-colors"
                    >
                      .{fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CENTER PANEL (Cols 5-8): 60fps HTML5 Canvas Player & Watermark-Free Video Exporter */}
            <div className="lg:col-span-5 flex flex-col">
              <CaptionCanvasPlayer
                mediaUrl={mediaUrl}
                mediaType={mediaType}
                mediaFileName={mediaFileName}
                cues={cues}
                styleConfig={styleConfig}
                onPositionChange={(patch) =>
                  setStyleConfig((s) => ({ ...s, ...patch }))
                }
                aspectRatio={aspectRatio}
                onAspectRatioChange={setAspectRatio}
                currentTime={currentTime}
                duration={duration}
                onTimeUpdate={setCurrentTime}
                onDurationChange={setDuration}
                isTranscribing={isTranscribing}
              />
            </div>

            {/* RIGHT PANEL (Cols 9-12): Animated Templates & Typography/Color Customizer */}
            <div className="lg:col-span-3 bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between space-y-5">
              <div className="space-y-5">
                {/* Segmented Tab Control */}
                <div
                  className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-xl"
                  role="group"
                  aria-label="Style customization tabs"
                >
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab('style')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      activeStudioTab !== 'export'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Animated Styles
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab('export')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      activeStudioTab === 'export'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Fine-Tune & Export
                  </button>
                </div>

                {activeStudioTab !== 'export' ? (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      CaptionX Animated Templates
                    </p>
                    <div className="grid grid-cols-1 gap-2.5">
                      {(
                        Object.keys(
                          DEFAULT_STYLE_PRESETS
                        ) as CaptionStylePreset[]
                      ).map((key) => {
                        const item = DEFAULT_STYLE_PRESETS[key];
                        const isSelected = styleConfig.preset === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleApplyPreset(key)}
                            className={`text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-600/15'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                {item.name}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {item.tagline}
                              </p>
                            </div>
                            <span
                              style={{
                                color: item.config.activeWordColor,
                                backgroundColor:
                                  item.config.activeBgColor !== 'transparent'
                                    ? item.config.activeBgColor
                                    : '#0F172A',
                              }}
                              className="px-2.5 py-1 rounded-md text-[11px] font-black tracking-tight shrink-0"
                            >
                              WORD
                            </span>
                          </button>
                        );
                      })}
                    </div>

                     {/* Continuous Caption Height Pointer Slider Line (Right = Up, Left = Down) */}
                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <label htmlFor="quick-pointer-line">
                          Caption Height Pointer (कैप्शन हाइट)
                        </label>
                        <span className="font-mono tabular-nums font-bold text-blue-600">
                          {yPositionToSliderValue(styleConfig.yPosition)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-500">
                          नीचे
                        </span>
                        <input
                          id="quick-pointer-line"
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={yPositionToSliderValue(styleConfig.yPosition)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setStyleConfig((s) => ({
                              ...s,
                              yPosition: sliderValueToYPosition(val),
                            }));
                          }}
                          className="w-full accent-blue-600 cursor-ew-resize"
                        />
                        <span className="text-[10px] font-semibold text-slate-500">
                          ऊपर
                        </span>
                      </div>
                    </div>

                    {/* Max Words Per Line Quick Regrouper */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>Words Per Caption Line</span>
                        <span className="font-mono tabular-nums font-bold text-blue-600">
                          {styleConfig.maxWordsPerLine} words
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[2, 3, 4, 5, 6].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => handleRegroupWords(n)}
                            className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                              styleConfig.maxWordsPerLine === n
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {n}w
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="style-font-family"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Font Family
                      </label>
                      <select
                        id="style-font-family"
                        value={styleConfig.fontFamily}
                        onChange={(e) =>
                          setStyleConfig((s) => ({
                            ...s,
                            fontFamily:
                              e.target.value as CaptionStyleConfig['fontFamily'],
                          }))
                        }
                        className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg"
                      >
                        <option value="Plus Jakarta Sans">
                          Plus Jakarta Sans (Bold Geometric)
                        </option>
                        <option value="Arial Black">
                          Arial Black (Heavy Reels Display)
                        </option>
                        <option value="Fraunces">
                          Fraunces (Editorial Serif)
                        </option>
                        <option value="JetBrains Mono">
                          JetBrains Mono (Technical)
                        </option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <label htmlFor="style-font-size">Font Size</label>
                        <span className="font-mono tabular-nums">
                          {styleConfig.fontSize}px
                        </span>
                      </div>
                      <input
                        id="style-font-size"
                        type="range"
                        min={28}
                        max={76}
                        value={styleConfig.fontSize}
                        onChange={(e) =>
                          setStyleConfig((s) => ({
                            ...s,
                            fontSize: parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <label htmlFor="style-y-pos">
                          Caption Height Pointer (Left = नीचे · Right = ऊपर)
                        </label>
                        <span className="font-mono tabular-nums">
                          {yPositionToSliderValue(styleConfig.yPosition)}%
                        </span>
                      </div>
                      <input
                        id="style-y-pos"
                        type="range"
                        min={0}
                        max={100}
                        value={yPositionToSliderValue(styleConfig.yPosition)}
                        onChange={(e) =>
                          setStyleConfig((s) => ({
                            ...s,
                            yPosition: sliderValueToYPosition(
                              parseInt(e.target.value, 10)
                            ),
                          }))
                        }
                        className="w-full accent-blue-600 cursor-ew-resize"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="style-text-color"
                          className="block text-[11px] font-bold text-slate-700 mb-1"
                        >
                          Base Text Color
                        </label>
                        <input
                          id="style-text-color"
                          type="color"
                          value={
                            styleConfig.textColor.startsWith('#')
                              ? styleConfig.textColor
                              : '#FFFFFF'
                          }
                          onChange={(e) =>
                            setStyleConfig((s) => ({
                              ...s,
                              textColor: e.target.value,
                            }))
                          }
                          className="w-full h-9 rounded-lg border border-slate-200 cursor-pointer bg-white p-1"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="style-active-color"
                          className="block text-[11px] font-bold text-slate-700 mb-1"
                        >
                          Active Word Color
                        </label>
                        <input
                          id="style-active-color"
                          type="color"
                          value={
                            styleConfig.activeWordColor.startsWith('#')
                              ? styleConfig.activeWordColor
                              : '#FACC15'
                          }
                          onChange={(e) =>
                            setStyleConfig((s) => ({
                              ...s,
                              activeWordColor: e.target.value,
                            }))
                          }
                          className="w-full h-9 rounded-lg border border-slate-200 cursor-pointer bg-white p-1"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="text-xs font-semibold text-slate-700">
                        All-Caps Display
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setStyleConfig((s) => ({
                            ...s,
                            uppercase: !s.uppercase,
                          }))
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                          styleConfig.uppercase
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {styleConfig.uppercase ? 'UPPERCASE ON' : 'Normal Case'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* All-Formats Subtitle Export Box */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5">
                <p className="text-xs font-bold text-slate-900">
                  All Watermark-Free Subtitle Downloads
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['srt', 'vtt', 'ass', 'sbv', 'txt', 'json'] as const).map(
                    (fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        disabled={cues.length === 0}
                        onClick={() => handleDownloadSubtitleFile(fmt)}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white disabled:opacity-40 text-slate-800 text-xs font-mono font-bold uppercase transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>.{fmt}</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DARK NAVY SILENCE REMOVER SHOWCASE (Matching caption-x.com's Silence Remover visual style, wired to real Web Audio tool) */}
        <section
          id="silence-remover-section"
          className="scroll-mt-20 bg-slate-950 text-white py-20 px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 rounded-3xl border-2 border-emerald-500/70 bg-slate-900/90 p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="space-y-2">
                <p className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
                  WEB AUDIO RMS ENGINE · BEFORE SILENCE CUT
                </p>
                <div className="flex items-center gap-1.5 h-12">
                  {[
                    45, 80, 95, 65, 40, 8, 8, 8, 8, 55, 90, 100, 70, 8, 8, 8,
                    60, 85, 95, 50, 8, 8, 75, 90,
                  ].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className={`flex-1 rounded-full ${
                        h < 15 ? 'bg-slate-700 h-1.5' : 'bg-slate-400'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-mono uppercase tracking-widest text-emerald-400">
                  AFTER AUTOMATIC SILENCE REMOVAL
                </p>
                <div className="flex items-center gap-1.5 h-12">
                  {[
                    45, 80, 95, 65, 40, 55, 90, 100, 70, 60, 85, 95, 50, 75, 90,
                    65, 85, 95, 70, 60, 80, 90, 75, 85,
                  ].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className="flex-1 rounded-full bg-emerald-400"
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/30">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Zero Manual Timeline Scrubbing
                  </p>
                  <p className="text-xs text-slate-300">
                    Exports trimmed WAV audio or Premiere Pro / DaVinci Resolve
                    .EDL cut list
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Built-In Web Audio Utility
              </p>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08]">
                Silence Remover for{' '}
                <span
                  className="text-emerald-400 font-semibold italic block mt-1"
                  style={{ fontFamily: 'var(--font-fraunces), serif' }}
                >
                  Creators & Video Editors
                </span>
              </h2>
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                Remove dead air in one click. Drop any podcast, talking-head
                video, or voiceover recording into our real-time RMS audio
                analyzer to cut silent pauses and download a clean WAV or
                timeline cut list.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <a
                  href="#active-tool-workbench"
                  onClick={() => setSelectedToolId('silence-remover')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <Scissors className="w-4 h-4" />
                  <span>Open Free Silence Remover</span>
                </a>
                <a
                  href="#free-tools"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-slate-700 hover:border-slate-500 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Explore All Browser Tools →</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* FREE ONLINE SUBTITLE & AUDIO TOOLS HUB */}
        <section
          id="free-tools"
          className="scroll-mt-20 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        >
          <FreeToolsHub
            key={selectedToolId}
            initialTool={selectedToolId}
            onSendCuesToStudio={(incomingCues, label) => {
              setCues(incomingCues);
              if (incomingCues.length > 0) {
                const maxEnd = Math.max(...incomingCues.map((c) => c.end));
                setDuration(Math.max(duration, maxEnd + 1));
              }
              setTranscribeStatus(`Loaded ${incomingCues.length} cues from ${label}.`);
              document
                .getElementById('studio-workspace')
                ?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </section>

        {/* SUPPORTED LANGUAGES DIRECTORY (Including Hinglish, Hindi, Urdu, Tamil, Telugu, etc.) */}
        <section
          id="languages-section"
          className="scroll-mt-20 py-16 px-4 sm:px-6 lg:px-8 bg-slate-50 border-y border-slate-200"
        >
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Multilingual AI Transcription & Translation
                </p>
                <h2 className="text-3xl font-extrabold text-slate-900">
                  Supported Languages (Including Hinglish)
                </h2>
                <p className="text-sm text-slate-600">
                  Click any language below to pre-configure the Caption Studio
                  for that language or script.
                </p>
              </div>

              <input
                type="search"
                aria-label="Filter supported languages"
                value={langSearch}
                onChange={(e) => setLangSearch(e.target.value)}
                placeholder="Search language (e.g. Hinglish, Hindi, Urdu)…"
                className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl w-full md:w-72 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredLanguages.map((lang) => (
                <div
                  key={lang.code}
                  className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {lang.name}
                      </h3>
                      <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                    </div>
                    <p className="text-xs text-slate-500">
                      {lang.script} · {lang.region}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLanguage(lang.code);
                      document
                        .getElementById('studio-workspace')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-800 text-xs font-bold transition-colors text-center whitespace-nowrap"
                  >
                    Create {lang.name.split(' ')[0]} Captions →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Frequently Asked Questions
            </p>
            <h2 className="text-3xl font-extrabold text-slate-900">
              Everything about watermark-free captioning
            </h2>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl bg-white">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="p-5">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 text-left"
                  >
                    <span className="text-sm sm:text-base font-bold text-slate-900">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* CLEAN FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-12 px-6 border-t border-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="text-lg font-black tracking-tight text-white">
              CAPTION <span className="text-blue-500">X</span> FREE STUDIO
            </p>
            <p className="text-xs text-slate-400">
              Real-time browser auto-captioning, animated subtitles, silence
              remover, and format converters — 100% free with zero watermarks.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#studio-workspace" className="hover:text-white">
              Caption Studio
            </a>
            <a href="#free-tools" className="hover:text-white">
              Free Subtitle Tools
            </a>
            <a href="#silence-remover-section" className="hover:text-white">
              Silence Remover
            </a>
            <a href="#languages-section" className="hover:text-white">
              Supported Languages
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
