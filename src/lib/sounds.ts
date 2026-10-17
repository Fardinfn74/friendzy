// Tiny Web Audio synth for playful game sounds. Mute preference persists in localStorage.
const KEY = "imposta.muted";
let ctx: AudioContext | null = null;
const listeners = new Set<(m: boolean) => void>();

export function isMuted() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(KEY) === "1";
}

export function setMuted(m: boolean) {
  localStorage.setItem(KEY, m ? "1" : "0");
  listeners.forEach((l) => l(m));
}

export function onMuteChange(l: (m: boolean) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

type Note = [freq: number, start: number, dur: number, type?: OscillatorType];

const SOUNDS: Record<string, Note[]> = {
  turn: [
    [660, 0, 0.12, "square"],
    [880, 0.12, 0.18, "square"],
  ],
  clue: [
    [520, 0, 0.08, "triangle"],
    [780, 0.07, 0.1, "triangle"],
  ],
  vote: [
    [392, 0, 0.14, "sawtooth"],
    [330, 0.15, 0.14, "sawtooth"],
    [262, 0.3, 0.25, "sawtooth"],
  ],
  pick: [[300, 0, 0.06, "square"]],
  reveal: [
    [523, 0, 0.1, "triangle"],
    [659, 0.09, 0.1, "triangle"],
    [784, 0.18, 0.1, "triangle"],
    [1047, 0.27, 0.3, "triangle"],
  ],
  win: [
    [523, 0, 0.12],
    [659, 0.12, 0.12],
    [784, 0.24, 0.12],
    [1047, 0.36, 0.4],
  ],
};

export function play(name: keyof typeof SOUNDS) {
  if (typeof window === "undefined" || isMuted()) return;
  buzz(name);
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    for (const [f, s, d, type = "sine"] of SOUNDS[name]!) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + s);
      g.gain.exponentialRampToValueAtTime(0.12, now + s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + s + d);
      o.connect(g).connect(ctx.destination);
      o.start(now + s);
      o.stop(now + s + d + 0.02);
    }
  } catch {
    /* audio unavailable */
  }
}

const BUZZ: Record<string, number | number[]> = {
  turn: [80, 60, 120],
  vote: [60, 40, 60],
  reveal: 40,
  win: [100, 50, 100, 50, 200],
  pick: 15,
  clue: 20,
};
/** Phone vibration, follows the same mute setting. */
export function buzz(name: string) {
  if (typeof navigator === "undefined" || isMuted() || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(BUZZ[name] ?? 20);
  } catch {
    /* ignore */
  }
}
