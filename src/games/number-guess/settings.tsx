import { Hash, Lightbulb, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameState } from "@/lib/game-types";
import type { NumberGuessRange, NumberGuessRoundsOption } from "./types";

interface NumberGuessSettingsProps {
  s: GameState;
  token: string;
  updateSettings: (params: {
    data: {
      sessionToken: string;
      code: string;
      numberGuessSettings: {
        range?: NumberGuessRange;
        hints?: boolean;
        rounds?: NumberGuessRoundsOption;
      };
    };
  }) => Promise<unknown>;
  refresh: () => void;
}

export function NumberGuessSettingsView({
  s,
  token,
  updateSettings,
  refresh,
}: NumberGuessSettingsProps) {
  const isHost = s.me.isHost;
  const current = s.numberGuess?.settings;
  const currentRange: NumberGuessRange = current?.range ?? "1-100";
  const currentHints: boolean = current?.hints !== false;
  const currentRounds: NumberGuessRoundsOption = current?.rounds === 5 ? 5 : 3;

  async function patch(patch: {
    range?: NumberGuessRange;
    hints?: boolean;
    rounds?: NumberGuessRoundsOption;
  }) {
    try {
      await updateSettings({
        data: {
          sessionToken: token,
          code: s.code,
          numberGuessSettings: patch,
        },
      });
      refresh();
    } catch {
      /* ignore */
    }
  }

  const ranges: NumberGuessRange[] = ["1-50", "1-100", "1-500"];

  return (
    <div className="space-y-4">
      {/* Number Range */}
      <div className="space-y-1.5">
        <label className="text-stencil flex items-center gap-1.5">
          <Hash className="size-3.5 text-primary" />
          <span>Number Range</span>
        </label>
        {isHost ? (
          <div className="grid grid-cols-3 gap-2">
            {ranges.map((r) => {
              const active = currentRange === r;
              return (
                <Button
                  key={r}
                  type="button"
                  variant={active ? "default" : "secondary"}
                  size="sm"
                  onClick={() => patch({ range: r })}
                  className={`min-h-[44px] font-display font-bold transition-transform active:scale-95 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-surface hover:bg-secondary border-2 border-border"
                  }`}
                >
                  {r}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="tag-sticker inline-flex items-center gap-1.5">
            <Hash className="size-3 text-primary" />
            <span>{currentRange}</span>
          </div>
        )}
      </div>

      {/* Rounds */}
      <div className="space-y-1.5">
        <label className="text-stencil flex items-center gap-1.5">
          <Trophy className="size-3.5 text-primary" />
          <span>Match Length</span>
        </label>
        {isHost ? (
          <div className="grid grid-cols-2 gap-2">
            {([3, 5] as const).map((r) => {
              const active = currentRounds === r;
              return (
                <Button
                  key={r}
                  type="button"
                  variant={active ? "default" : "secondary"}
                  size="sm"
                  onClick={() => patch({ rounds: r })}
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

      {/* Hints toggle */}
      <div className="space-y-1.5">
        <label className="text-stencil flex items-center gap-1.5">
          <Lightbulb className="size-3.5 text-primary" />
          <span>Hints (Higher / Lower)</span>
        </label>
        {isHost ? (
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { label: "On", value: true },
                { label: "Off", value: false },
              ] as const
            ).map(({ label, value }) => {
              const active = currentHints === value;
              return (
                <Button
                  key={label}
                  type="button"
                  variant={active ? "default" : "secondary"}
                  size="sm"
                  onClick={() => patch({ hints: value })}
                  className={`min-h-[44px] font-display font-bold transition-transform active:scale-95 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-surface hover:bg-secondary border-2 border-border"
                  }`}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="tag-sticker inline-flex items-center gap-1.5">
            <Lightbulb className="size-3 text-primary" />
            <span>Hints {currentHints ? "On" : "Off"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
