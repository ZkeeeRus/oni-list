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

export function playRouletteTick(prefs: UserPreferences, progress = 0.5): void {
  if (!prefs.soundEnabled || !prefs.rouletteSound) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  const baseFreq = 680 - progress * 220;
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(190, now + 0.028);

  const vol = Math.max(0.02, prefs.soundVolume * 0.22);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.035);
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
