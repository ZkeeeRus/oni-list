import { UserPreferences } from './preferences';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playUiClick(prefs: UserPreferences): void {
  if (!prefs.soundEnabled || !prefs.uiSound) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(260, now + 0.035);

  const vol = Math.max(0.02, prefs.soundVolume * 0.14);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.045);
}

export function playRouletteTick(
  prefs: UserPreferences,
  speedRatio = 0.5,
  isPullback = false
): void {
  if (!prefs.soundEnabled || !prefs.rouletteSound) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  const clamped = Math.max(0, Math.min(1, speedRatio));
  const baseFreq = isPullback ? 430 : 455 + clamped * 245;
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(185, now + 0.028);

  const volScale = isPullback ? 0.14 : 0.16 + clamped * 0.08;
  const vol = Math.max(0.02, prefs.soundVolume * volScale);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.035);
}

// Звук натяжения и упругого отпускания резинки при старте рулетки
export function playRouletteSlingshot(
  prefs: UserPreferences,
  pullDurationSec: number
): void {
  if (!prefs.soundEnabled || !prefs.rouletteSound) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const pullDur = Math.max(0.16, Math.min(0.6, pullDurationSec));
  const vol = Math.max(0.02, prefs.soundVolume * 0.18);

  // 1. Мягкое натяжение резинки
  const stretchOsc = ctx.createOscillator();
  const stretchFilter = ctx.createBiquadFilter();
  const stretchGain = ctx.createGain();
  stretchOsc.type = 'triangle';
  stretchOsc.frequency.setValueAtTime(105, now);
  stretchOsc.frequency.exponentialRampToValueAtTime(185, now + pullDur * 0.92);

  stretchFilter.type = 'lowpass';
  stretchFilter.frequency.setValueAtTime(420, now);

  stretchGain.gain.setValueAtTime(0.001, now);
  stretchGain.gain.linearRampToValueAtTime(vol * 0.75, now + pullDur * 0.55);
  stretchGain.gain.exponentialRampToValueAtTime(0.001, now + pullDur);

  stretchOsc.connect(stretchFilter);
  stretchFilter.connect(stretchGain);
  stretchGain.connect(ctx.destination);
  stretchOsc.start(now);
  stretchOsc.stop(now + pullDur + 0.01);

  // 2. Упругий щелчок-выпуск резинки
  const snapTime = now + pullDur;
  const snapOsc = ctx.createOscillator();
  const snapGain = ctx.createGain();
  snapOsc.type = 'sine';
  snapOsc.frequency.setValueAtTime(180, snapTime);
  snapOsc.frequency.exponentialRampToValueAtTime(340, snapTime + 0.045);
  snapOsc.frequency.exponentialRampToValueAtTime(125, snapTime + 0.13);

  snapGain.gain.setValueAtTime(vol, snapTime);
  snapGain.gain.exponentialRampToValueAtTime(0.001, snapTime + 0.14);

  snapOsc.connect(snapGain);
  snapGain.connect(ctx.destination);
  snapOsc.start(snapTime);
  snapOsc.stop(snapTime + 0.15);
}

// Мягкий звук схлопывания выбывших копий и стягивания соседних карточек
export function playEliminationCollapse(prefs: UserPreferences): void {
  if (!prefs.soundEnabled || !prefs.rouletteSound) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = Math.max(0.02, prefs.soundVolume * 0.22);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(250, now);
  osc.frequency.exponentialRampToValueAtTime(78, now + 0.24);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.28);
}

// Хруст/взрыв при уничтожении карточки на выбывании
export function playEliminationBlast(prefs: UserPreferences): void {
  if (!prefs.soundEnabled || !prefs.rouletteSound) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const dur = 0.42;
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.8);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1100, now);
  filter.frequency.exponentialRampToValueAtTime(140, now + dur);

  const gain = ctx.createGain();
  const vol = Math.max(0.03, prefs.soundVolume * 0.34);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + dur);

  // Низкий удар
  const boom = ctx.createOscillator();
  const boomGain = ctx.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(150, now);
  boom.frequency.exponentialRampToValueAtTime(38, now + 0.32);
  boomGain.gain.setValueAtTime(vol * 0.9, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
  boom.connect(boomGain);
  boomGain.connect(ctx.destination);
  boom.start(now);
  boom.stop(now + 0.35);
}

export function playRouletteResult(
  prefs: UserPreferences,
  mode: 'win' | 'eliminated'
): void {
  if (!prefs.soundEnabled || !prefs.rouletteSound) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (mode === 'eliminated') {
    playEliminationBlast(prefs);
    return;
  }

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const t0 = now + idx * 0.075;
    const dur = 0.28;
    osc.frequency.setValueAtTime(freq, t0);

    const vol = Math.max(0.02, prefs.soundVolume * 0.24);
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  });
}

export function playBellJingle(prefs: UserPreferences): void {
  if (!prefs.soundEnabled || !prefs.uiSound) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bells = [1046.5, 1318.5, 1567.98, 2093.0];
  bells.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const t0 = now + i * 0.065;
    osc.frequency.setValueAtTime(freq, t0);

    const vol = Math.max(0.02, prefs.soundVolume * 0.18);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.38);
  });
}

// Звук лопнувшей и перегоревшей гирлянды (хлопок + звон осколков стекла + падение питания)
export function playGarlandShatter(prefs: UserPreferences): void {
  if (!prefs.soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = Math.max(0.04, prefs.soundVolume * 0.36);

  // 1. Хлопок перегорания и треск
  const popDur = 0.28;
  const bufLen = Math.floor(ctx.sampleRate * popDur);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2.2);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1900, now);
  bp.Q.setValueAtTime(1.1, now);

  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(vol, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + popDur);

  noise.connect(bp);
  bp.connect(nGain);
  nGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + popDur);

  // 2. Звон разлетающегося стекла лампочек
  const glassFreqs = [3150, 4180, 2680, 3690, 4820, 2940];
  glassFreqs.forEach((f, idx) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    const t0 = now + 0.02 + idx * 0.032;
    osc.frequency.setValueAtTime(f, t0);
    osc.frequency.exponentialRampToValueAtTime(f * 0.72, t0 + 0.09);
    g.gain.setValueAtTime(vol * 0.42, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.11);
  });

  // 3. Короткое гудение потухшего трансформатора
  const zap = ctx.createOscillator();
  const zGain = ctx.createGain();
  zap.type = 'sawtooth';
  zap.frequency.setValueAtTime(210, now);
  zap.frequency.exponentialRampToValueAtTime(42, now + 0.32);
  zGain.gain.setValueAtTime(vol * 0.55, now);
  zGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
  zap.connect(zGain);
  zGain.connect(ctx.destination);
  zap.start(now);
  zap.stop(now + 0.35);
}

// Короткий треск одиночной электрической искры при клике по сломанной гирлянде
export function playGarlandSpark(prefs: UserPreferences): void {
  if (!prefs.soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = Math.max(0.03, prefs.soundVolume * 0.25);

  const dur = 0.09;
  const bufLen = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    ch[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buf;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(2200, now);

  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(vol, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  noise.connect(hp);
  hp.connect(nGain);
  nGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + dur);

  const zap = ctx.createOscillator();
  const zGain = ctx.createGain();
  zap.type = 'sawtooth';
  zap.frequency.setValueAtTime(1650, now);
  zap.frequency.exponentialRampToValueAtTime(340, now + 0.065);
  zGain.gain.setValueAtTime(vol * 0.48, now);
  zGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  zap.connect(zGain);
  zGain.connect(ctx.destination);
  zap.start(now);
  zap.stop(now + 0.075);
}

// Звук починки и зажигания гирлянды (по пасхалке ZkeeeRus)
export function playGarlandRepair(prefs: UserPreferences): void {
  if (!prefs.soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = Math.max(0.03, prefs.soundVolume * 0.24);
  const notes = [392.0, 523.25, 659.25, 783.99, 1046.5, 1318.5];

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    const t0 = now + i * 0.055;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  });
}
