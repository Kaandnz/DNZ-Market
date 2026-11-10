/** Okutma sesi (bip) ve titreşim. Ses tercihi cihaza özeldir. */

const SOUND_KEY = "dnz.sound";
let ctx: AudioContext | null = null;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* gizli sekme vb. */
  }
}

export function soundEnabled(): boolean {
  return safeGet(SOUND_KEY) !== "off";
}

export function setSoundEnabled(on: boolean) {
  safeSet(SOUND_KEY, on ? "on" : "off");
}

/** iOS sesi ancak bir dokunuştan sonra açar; ilk dokunuşta ses motorunu hazırla. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* ses yoksa sorun değil */
  }
}

function tone(freq: number, ms: number, when = 0) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  const t = ctx.currentTime + when;
  gain.gain.setValueAtTime(0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000);
}

export function beepScan() {
  try {
    navigator.vibrate?.(40);
  } catch {
    /* yok */
  }
  if (soundEnabled()) tone(1800, 90);
}

export function beepSaved() {
  try {
    navigator.vibrate?.([30, 40, 30]);
  } catch {
    /* yok */
  }
  if (soundEnabled()) {
    tone(1200, 70);
    tone(1800, 90, 0.09);
  }
}

export function beepUnknown() {
  try {
    navigator.vibrate?.(120);
  } catch {
    /* yok */
  }
  if (soundEnabled()) tone(500, 160);
}

export const storage = { get: safeGet, set: safeSet };
