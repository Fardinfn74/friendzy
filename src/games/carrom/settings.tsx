import { Target, Trophy } from "lucide-react";
import type { GameState } from "@/lib/game-types";
import type { CarromSettings } from "./types";

interface CarromSettingsProps {
  s: GameState;
  token: string;
  updateSettings: (params: {
    data: {
      sessionToken: string;
      code: string;
      carromSettings?: Partial<CarromSettings>;
    };
  }) => Promise<unknown>;
  refresh: () => void;
}

export function CarromSettingsView({ s, token, updateSettings, refresh }: CarromSettingsProps) {
  const isHost = s.me.isHost;
  const currentMode = s.carrom?.settings?.boardMode ?? "fast";
  const currentTarget = s.carrom?.settings?.targetScore ?? 15;

  const handleUpdate = async (patch: Partial<CarromSettings>) => {
    await updateSettings({
      data: {
        sessionToken: token,
        code: s.code,
        carromSettings: patch,
      },
    });
    refresh();
  };

  return (
    <div className="space-y-4">
      {/* Board Mode */}
      <div className="space-y-2">
        <label className="text-sm font-semibold flex items-center gap-1.5 text-foreground/80">
          <Target className="w-4 h-4 text-primary" />
          Coin Setup
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { mode: "fast", label: "Fast (9 Coins)", sub: "4 White, 4 Black, 1 Queen" },
            { mode: "classic", label: "Classic (19 Coins)", sub: "9 White, 9 Black, 1 Queen" },
          ].map(({ mode, label, sub }) => (
            <button
              key={mode}
              type="button"
              disabled={!isHost}
              onClick={() => {
                void handleUpdate({ boardMode: mode as "fast" | "classic" });
              }}
              className={`p-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center ${
                currentMode === mode
                  ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]"
                  : "bg-background/60 hover:bg-muted text-foreground border-border/60"
              } ${!isHost ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span className="text-sm">{label}</span>
              <span className="text-[10px] opacity-80 mt-0.5">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Target Score */}
      <div className="space-y-2">
        <label className="text-sm font-semibold flex items-center gap-1.5 text-foreground/80">
          <Trophy className="w-4 h-4 text-amber-500" />
          Target Score to Win
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { score: 15, label: "15 Points", sub: "Quick Match" },
            { score: 25, label: "25 Points", sub: "Championship" },
          ].map(({ score, label, sub }) => (
            <button
              key={score}
              type="button"
              disabled={!isHost}
              onClick={() => {
                void handleUpdate({ targetScore: score as 15 | 25 });
              }}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center ${
                currentTarget === score
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

      {!isHost && (
        <p className="text-xs text-muted-foreground text-center italic">
          Only the host can modify Carrom match settings.
        </p>
      )}
    </div>
  );
}
