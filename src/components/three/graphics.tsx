import { Component, useEffect, useState, type ReactNode } from "react";

export type GraphicsMode = "3d" | "2d";
const STORAGE_KEY = "friendzy.graphics";

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function looksLowEnd(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2;
}

/**
 * 3D / 2D choice shared by Chess, Ludo and Carrom. Starts as 2D (the server has no WebGL), then switches to 3D
 * on devices that support it unless the player picked 2D before. Very weak phones default to 2D.
 */
export function useGraphicsMode() {
  const [mode, setModeState] = useState<GraphicsMode>("2d");
  const [canUse3D, setCanUse3D] = useState(false);

  useEffect(() => {
    const ok = detectWebGL();
    setCanUse3D(ok);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage blocked */
    }
    const wants3D = saved ? saved === "3d" : !looksLowEnd();
    setModeState(ok && wants3D ? "3d" : "2d");
  }, []);

  const setMode = (m: GraphicsMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* storage blocked */
    }
  };
  return { mode, setMode, canUse3D };
}

export function GraphicsToggle({
  mode,
  setMode,
  canUse3D,
}: {
  mode: GraphicsMode;
  setMode: (m: GraphicsMode) => void;
  canUse3D: boolean;
}) {
  if (!canUse3D) return null;
  return (
    <div
      className="inline-flex overflow-hidden rounded-full border-2 border-foreground/70 text-xs font-extrabold"
      role="group"
      aria-label="Graphics"
    >
      {(["3d", "2d"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          className={`px-3 py-1 uppercase transition-colors ${
            mode === m ? "bg-foreground text-background" : "bg-background/60 text-foreground"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

/** If the 3D view crashes (e.g. the browser loses its WebGL context) fall back to the 2D board instead of a blank screen. */
export class Boundary3D extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
