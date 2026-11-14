import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSrtTime,
  formatVttTime,
  parseTimecodeToSeconds,
  parseSubtitleFile,
  exportToSrt,
  exportToVtt,
  shiftCuesTiming,
  mergeSubtitleLists,
  regroupCuesByMaxWords,
  removeFillerWordsFromCues,
  calculateSubtitleMetrics,
  sliderValueToYPosition,
  yPositionToSliderValue,
  buildContinuousCuesFromWhisper,
  transliterateDevanagariToHinglish,
  getWhisperIsoLanguageCode,
  applyProofreadOrTranslatedCues,
  patchWebmDurationBytes,
} from './subtitles';

test('caption pointer slider moves captions UP when sliding right and DOWN when sliding left', () => {
  assert.equal(sliderValueToYPosition(0), 90);
  assert.equal(sliderValueToYPosition(50), 50);
  assert.equal(sliderValueToYPosition(100), 10);
  assert.equal(yPositionToSliderValue(90), 0);
  assert.equal(yPositionToSliderValue(50), 50);
  assert.equal(yPositionToSliderValue(10), 100);
});

test('recovers missing middle segments from Whisper and bridges micro-gaps for continuous voiceover', () => {
  const rawWords = [
    { word: 'Toh', start: 0.0, end: 0.5 },
    { word: 'dosto', start: 0.5, end: 1.5 },
    { word: 'bilkul', start: 4.2, end: 4.8 },
    { word: 'sahi', start: 4.8, end: 5.5 },
  ];
  const rawSegments = [
    { text: 'Toh dosto', start: 0.0, end: 1.5 },
    { text: 'aaj hum baat karenge', start: 2.0, end: 4.0 },
    { text: 'bilkul sahi', start: 4.2, end: 5.5 },
  ];

  const cues = buildContinuousCuesFromWhisper(rawWords, rawSegments, 4);
  const fullText = cues.map((c) => c.text).join(' ');
  assert.ok(fullText.includes('aaj hum baat karenge'));
  for (let i = 0; i < cues.length - 1; i++) {
    assert.equal(cues[i].end, cues[i + 1].start);
  }
});

test('maps Hinglish and Hindi to Whisper ISO code hi and transliterates Devanagari with accurate spelling and medial schwa deletion', () => {
  assert.equal(getWhisperIsoLanguageCode('hinglish'), 'hi');
  assert.equal(getWhisperIsoLanguageCode('Hindi (हिन्दी)'), 'hi');
  const roman = transliterateDevanagariToHinglish(
    'आज हम बात करेंगे चलते चलते स्पेलिंग मिस्टेक्स और कैप्शन के बारे में'
  );
  assert.ok(!/[\u0900-\u097F]/.test(roman));
  assert.ok(roman.toLowerCase().includes('aaj'));
  assert.ok(roman.toLowerCase().includes('baat'));
  assert.ok(roman.toLowerCase().includes('chalte'));
  assert.ok(roman.toLowerCase().includes('spelling mistakes'));
  assert.ok(roman.toLowerCase().includes('caption'));
});

test('applyProofreadOrTranslatedCues preserves 100% of cues and word timings even if LLM drops an index', () => {
  const original = parseSubtitleFile(
    `1\n00:00:00,000 --> 00:00:02,000\nआज हम बात करेंगे\n\n2\n00:00:02,200 --> 00:00:04,500\nवीडियो चलते चलते कैप्शन\n\n3\n00:00:04,700 --> 00:00:07,000\nस्पेलिंग मिस्टेक्स फिक्स`
  );
  // Simulate LLM returning index 0 and index 2, but missing index 1
  const result = applyProofreadOrTranslatedCues(
    original,
    [
      { index: 0, text: 'Aaj hum baat karenge' },
      { index: 2, text: 'Spelling mistakes fix' },
    ],
    true
  );
  assert.equal(result.length, 3);
  assert.equal(result[0].text, 'Aaj hum baat karenge');
  assert.ok(result[1].text.toLowerCase().includes('video chalte chalte caption'));
  assert.equal(result[2].text, 'Spelling mistakes fix');
  assert.equal(result[0].end, result[1].start);
  assert.equal(result[1].end, result[2].start);
});

test('patchWebmDurationBytes injects IEEE-754 float64 Duration (0x4489) into streaming WebM header so phones do not show 0:00', () => {
  // Minimal valid EBML + Segment + Info (TimecodeScale=1000000) + Cluster header without Duration
  const rawWebm = new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x86, 0x81, 0x01, // EBML header
    0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, // Segment (unknown streaming size)
    0x15, 0x49, 0xa9, 0x66, 0x87, // Info element (7 bytes body)
    0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40, // TimecodeScale = 1,000,000
    0x1f, 0x43, 0xb6, 0x75, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x05, // Cluster
    0xe7, 0x81, 0x00, 0xa3, 0x80,
  ]);

  const patched = patchWebmDurationBytes(rawWebm, 15400); // 15.4 seconds
  assert.ok(patched.length > rawWebm.length);

  // Locate 0x44 0x89 0x88 and verify the 8-byte float64 value equals 15400
  let foundDuration = -1;
  for (let i = 0; i <= patched.length - 11; i++) {
    if (patched[i] === 0x44 && patched[i + 1] === 0x89 && patched[i + 2] === 0x88) {
      const view = new DataView(
        patched.buffer,
        patched.byteOffset + i + 3,
        8
      );
      foundDuration = view.getFloat64(0, false);
      break;
    }
  }
  assert.equal(foundDuration, 15400);
});

test('formats and parses SRT and VTT timecodes accurately', () => {
  assert.equal(formatSrtTime(0), '00:00:00,000');
  assert.equal(formatSrtTime(65.432), '00:01:05,432');
  assert.equal(formatVttTime(3661.5), '01:01:01.500');
  assert.equal(parseTimecodeToSeconds('00:01:05,432'), 65.432);
  assert.equal(parseTimecodeToSeconds('01:01:01.500'), 3661.5);
});

test('parses SRT content into cues with word-level timings and exports back cleanly', () => {
  const sampleSrt = `1
00:00:01,000 --> 00:00:03,000
Welcome to CaptionX Free Studio

2
00:00:03,500 --> 00:00:06,000
Export captioned videos with zero watermark`;

  const cues = parseSubtitleFile(sampleSrt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 1);
  assert.equal(cues[0].end, 3);
  assert.equal(cues[0].words.length, 5);
  assert.equal(cues[0].words[0].word, 'Welcome');
  assert.equal(cues[0].words[4].end, 3);

  const reExported = exportToSrt(cues);
  assert.ok(reExported.includes('00:00:01,000 --> 00:00:03,000'));
  const vtt = exportToVtt(cues);
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.ok(vtt.includes('00:00:01.000 --> 00:00:03.000'));
});

test('shifts and merges subtitle timelines deterministically', () => {
  const first = parseSubtitleFile(`1\n00:00:00,000 --> 00:00:02,000\nFirst line`);
  const second = parseSubtitleFile(`1\n00:00:00,000 --> 00:00:02,000\nSecond line`);

  const shifted = shiftCuesTiming(first, 1.5);
  assert.equal(shifted[0].start, 1.5);
  assert.equal(shifted[0].end, 3.5);

  const merged = mergeSubtitleLists(first, second, 'append-after-first', 0.5);
  assert.equal(merged.length, 2);
  assert.equal(merged[1].start, 2.5);
  assert.equal(merged[1].end, 4.5);
});

test('regroups cues by max words per line and strips filler words', () => {
  const cues = parseSubtitleFile(
    `1\n00:00:00,000 --> 00:00:04,000\nUm this is a six word sentence uh right here`
  );
  const { cues: cleaned, removedCount } = removeFillerWordsFromCues(cues);
  assert.equal(removedCount, 2);
  assert.equal(cleaned[0].text, 'this is a six word sentence right here');

  const regrouped = regroupCuesByMaxWords(cleaned, 3);
  assert.equal(regrouped.length, 3);
  assert.equal(regrouped[0].words.length, 3);
});

test('calculates real-time subtitle reading speed metrics', () => {
  const cues = parseSubtitleFile(
    `1\n00:00:00,000 --> 00:00:02,000\nShort line here`
  );
  const metrics = calculateSubtitleMetrics(cues);
  assert.equal(metrics.cueCount, 1);
  assert.equal(metrics.totalWords, 3);
  assert.equal(metrics.totalCharacters, 15);
  assert.equal(metrics.avgCps, 7.5);
});

import { detectSilencesFromSamples, encodeTrimmedWav } from './audio-silence';

test('detects silent intervals in raw audio samples and encodes trimmed WAV', () => {
  const sampleRate = 1000;
  // 3 seconds total: 0-1s loud (0.5), 1-2s silent (0.0), 2-3s loud (0.5)
  const samples = new Float32Array(3000);
  for (let i = 0; i < 1000; i++) samples[i] = 0.5;
  for (let i = 1000; i < 2000; i++) samples[i] = 0.0;
  for (let i = 2000; i < 3000; i++) samples[i] = 0.5;

  const result = detectSilencesFromSamples(samples, sampleRate, -30, 0.4, 0.02);
  assert.equal(result.silentRegions.length, 1);
  assert.ok(result.totalSilenceRemovedSeconds > 0.8);
  assert.equal(result.keptRegions.length, 2);

  const wavBytes = encodeTrimmedWav(samples, sampleRate, result.keptRegions);
  // RIFF header is 44 bytes + ~2040 samples * 2 bytes
  assert.ok(wavBytes.byteLength > 44 && wavBytes.byteLength < 6000);
});

import { safeParseResponseJson } from './utils';

test('safeParseResponseJson gracefully handles HTML error pages without throwing Unexpected token <', async () => {
  const htmlResponse = new Response('<!DOCTYPE html><html><body>413 Request Entity Too Large</body></html>', {
    status: 413,
    headers: { 'Content-Type': 'text/html' },
  });
  const parsedHtml = await safeParseResponseJson<{ error?: string }>(htmlResponse);
  assert.ok(parsedHtml.error && parsedHtml.error.includes('too large'));

  const validJsonResponse = new Response(JSON.stringify({ ok: true, count: 3 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  const parsedJson = await safeParseResponseJson<{ ok: boolean; count: number }>(validJsonResponse);
  assert.equal(parsedJson.ok, true);
  assert.equal(parsedJson.count, 3);
});

import { DEFAULT_STYLE_PRESETS } from './subtitles';

test('DEFAULT_STYLE_PRESETS provides 20 After Effects, Behind-Building Depth, and Viral styles', () => {
  const keys = Object.keys(DEFAULT_STYLE_PRESETS);
  assert.equal(keys.length, 20);
  assert.equal(DEFAULT_STYLE_PRESETS['ae-behind-building'].config.depthBehindSubject, true);
  assert.equal(DEFAULT_STYLE_PRESETS['ae-behind-building'].config.crossDirection, 'left-to-right');
  assert.equal(DEFAULT_STYLE_PRESETS['ae-skyline-rise'].config.depthBehindSubject, true);
  assert.equal(DEFAULT_STYLE_PRESETS['ae-skyline-rise'].config.crossDirection, 'rise-up');
});
