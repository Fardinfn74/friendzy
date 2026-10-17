import { Clock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameState } from "@/lib/game-types";
import type { WordDuelRoundsOption, WordDuelTimeOption } from "./types";

interface WordDuelSettingsProps {
  s: GameState;
  token: string;
  updateSettings: (params: {
    data: {
      sessionToken: string;
      code: string;
      wordDuelSettings: {
        rounds?: WordDuelRoundsOption;
        roundTime?: WordDuelTimeOption;
      };
    };
  }) => Promise<unknown>;
  refresh: () => void;
}

export function WordDuelSettingsView({ s, token, updateSettings, refresh }: WordDuelSettingsProps) {
  const isHost = s.me.isHost;
  const currentRounds: WordDuelRoundsOption = s.wordDuel?.settings?.rounds ?? 3;
  const currentTime: WordDuelTimeOption = s.wordDuel?.settings?.roundTime ?? 30;

  async function handleRoundsChange(r: WordDuelRoundsOption) {
    if (!isHost || r === currentRounds) return;
    try {
      await updateSettings({
        data: {
          sessionToken: token,
          code: s.code,
          wordDuelSettings: { rounds: r },
        },
      });
      refresh();
    } catch {
      /* ignore */
    }
  }

  async function handleTimeChange(t: WordDuelTimeOption) {
    if (!isHost || t === currentTime) return;
    try {
      await updateSettings({
        data: {
          sessionToken: token,
          code: s.code,
          wordDuelSettings: { roundTime: t },
        },
      });
      refresh();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4">
      {/* Rounds setting (Best of 3 / 5 / 7) */}
      <div className="space-y-1.5">
        <label className="text-stencil flex items-center gap-1.5">
          <Trophy className="size-3.5 text-primary" />
          <span>Match Length</span>
        </label>
        {isHost ? (
          <div className="grid grid-cols-3 gap-2">
            {([3, 5, 7] as const).map((r) => {
              const active = currentRounds === r;
              return (
                <Button
                  key={r}
                  type="button"
                  variant={active ? "default" : "secondary"}
                  size="sm"
                  onClick={() => handleRoundsChange(r)}
                  className={`min-h-[44px] font-display font-bold transition-transform active:scale-95 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-surface hover:bg-secondary border-2 border-border"
                  }`}
                >
                  Best of {r}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="tag-sticker inline-flex items-center gap-1.5">
            <Trophy className="size-3 text-primary" />
            <span>Best of {currentRounds}</span>
          </div>
        )}
      </div>

      {/* Round time setting (20 / 30 / 45s) */}
      <div className="space-y-1.5">
        <label className="text-stencil flex items-center gap-1.5">
          <Clock className="size-3.5 text-primary" />
          <span>Time Per Round</span>
        </label>
        {isHost ? (
          <div className="grid grid-cols-3 gap-2">
            {([20, 30, 45] as const).map((t) => {
              const active = currentTime === t;
              return (
                <Button
                  key={t}
                  type="button"
                  variant={active ? "default" : "secondary"}
                  size="sm"
                  onClick={() => handleTimeChange(t)}
                  className={`min-h-[44px] font-display font-bold transition-transform active:scale-95 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-surface hover:bg-secondary border-2 border-border"
                  }`}
                >
                  {t}s
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="tag-sticker inline-flex items-center gap-1.5">
            <Clock className="size-3 text-primary" />
            <span>{currentTime} seconds</span>
          </div>
        )}
      </div>
    </div>
  );
}
