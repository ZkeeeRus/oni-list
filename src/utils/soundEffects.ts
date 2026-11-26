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

export function playRouletteResult(
  prefs: UserPreferences,
  mode: 'win' | 'eliminated'
): void {
  if (!prefs.soundEnabled || !prefs.rouletteSound) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes =
    mode === 'win'
      ? [523.25, 659.25, 783.99, 1046.5]
      : [440, 349.23, 261.63];

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = mode === 'win' ? 'triangle' : 'sawtooth';
    const t0 = now + idx * (mode === 'win' ? 0.075 : 0.09);
    const dur = mode === 'win' ? 0.28 : 0.18;
    osc.frequency.setValueAtTime(freq, t0);

    const vol = Math.max(0.02, prefs.soundVolume * (mode === 'win' ? 0.24 : 0.15));
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
