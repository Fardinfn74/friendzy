import { Clock, Zap } from "lucide-react";
import type { GameState } from "@/lib/game-types";
import type { ChessSettings } from "./types";

interface ChessSettingsProps {
  s: GameState;
  token: string;
  updateSettings: (params: {
    data: {
      sessionToken: string;
      code: string;
      chessSettings?: Partial<ChessSettings>;
    };
  }) => Promise<unknown>;
  refresh: () => void;
}

export function ChessSettingsView({ s, token, updateSettings, refresh }: ChessSettingsProps) {
  const isHost = s.me.isHost;
  const currentTimed = s.chess?.settings?.timedMode ?? true;
  const currentTime = s.chess?.settings?.timePerSide ?? 300;
  const currentInc = s.chess?.settings?.incrementSeconds ?? 5;

  const handleUpdate = async (patch: Partial<ChessSettings>) => {
    await updateSettings({
      data: {
        sessionToken: token,
        code: s.code,
        chessSettings: patch,
      },
    });
    refresh();
  };

  return (
    <div className="space-y-4">
      {/* Clock Mode Toggle */}
      <div className="space-y-2">
        <label className="text-sm font-semibold flex items-center gap-1.5 text-foreground/80">
          <Clock className="w-4 h-4 text-primary" />
          Timed Clock
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { val: true, label: "Timed (Blitz/Rapid)" },
            { val: false, label: "Untimed (Casual)" },
          ].map(({ val, label }) => (
            <button
              key={String(val)}
              type="button"
              disabled={!isHost}
              onClick={() => {
                void handleUpdate({ timedMode: val });
              }}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                currentTimed === val
                  ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]"
                  : "bg-background/60 hover:bg-muted text-foreground border-border/60"
              } ${!isHost ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {currentTimed && (
        <>
          {/* Time Per Side */}
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-1.5 text-foreground/80">
              <Clock className="w-4 h-4 text-amber-500" />
              Time per Player
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { time: 60, label: "1 min", sub: "Bullet" },
                { time: 180, label: "3 min", sub: "Blitz" },
                { time: 300, label: "5 min", sub: "Rapid" },
                { time: 600, label: "10 min", sub: "Classic" },
              ].map(({ time, label, sub }) => (
                <button
                  key={time}
                  type="button"
                  disabled={!isHost}
                  onClick={() => {
                    void handleUpdate({ timePerSide: time as 60 | 180 | 300 | 600 });
                  }}
                  className={`p-2 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center ${
                    currentTime === time
                      ? "bg-amber-500 text-white border-amber-600 shadow-sm scale-[1.02]"
                      : "bg-background/60 hover:bg-muted text-foreground border-border/60"
                  } ${!isHost ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span>{label}</span>
                  <span className="text-[10px] opacity-80">{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Increment per Move */}
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-1.5 text-foreground/80">
              <Zap className="w-4 h-4 text-emerald-500" />
              Bonus per Move (Increment)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { inc: 0, label: "+0s (No delay)" },
                { inc: 3, label: "+3s per move" },
                { inc: 5, label: "+5s per move" },
              ].map(({ inc, label }) => (
                <button
                  key={inc}
                  type="button"
                  disabled={!isHost}
                  onClick={() => {
                    void handleUpdate({ incrementSeconds: inc as 0 | 3 | 5 });
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                    currentInc === inc
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-sm scale-[1.02]"
                      : "bg-background/60 hover:bg-muted text-foreground border-border/60"
                  } ${!isHost ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {!isHost && (
        <p className="text-xs text-muted-foreground text-center italic">
          Only the host can modify chess clock settings.
        </p>
      )}
    </div>
  );
}
