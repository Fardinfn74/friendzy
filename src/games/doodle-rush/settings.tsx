import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateSettingsFn } from "@/lib/game.functions";
import { useServerFn } from "@tanstack/react-start";
import type { GameState } from "@/lib/game-types";

interface DoodleRushSettingsProps {
  s: GameState;
  token: string;
}

const TIME_OPTIONS = [60, 80, 120] as const;

export function DoodleRushSettingsView({ s, token }: DoodleRushSettingsProps) {
  const updateSettings = useServerFn(updateSettingsFn);
  const settings = (s.gameSettings ?? {}) as Record<string, unknown>;
  const [saving, setSaving] = useState(false);

  const currentTime = Number(settings["doodleRushDrawTime"] ?? 80);

  async function handleTimeChange(value: number) {
    if (!s.me.isHost) return;
    setSaving(true);
    try {
      await updateSettings({
        data: {
          sessionToken: token,
          code: s.code,
          doodleRushSettings: {
            rounds: 1,
            drawTime: value,
          },
        },
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5 p-3.5 rounded-2xl bg-secondary/40 border border-border/50">
        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-sm">Total Drawing Rounds</span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            {s.players.length} {s.players.length === 1 ? "Round" : "Rounds"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
          Every player gets exactly 1 chance to draw their secret word while others guess. Winner is crowned The Great Artist!
        </p>
      </div>

      <div className="space-y-2">
        <p className="font-display font-bold text-sm">Draw Time</p>
        <div className="flex gap-2">
          {TIME_OPTIONS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={currentTime === t ? "default" : "secondary"}
              onClick={() => handleTimeChange(t)}
              disabled={!s.me.isHost || saving}
              className="flex-1"
            >
              {t}s
            </Button>
          ))}
        </div>
      </div>

      {!s.me.isHost && (
        <p className="text-xs text-muted-foreground text-center">Only the host can change settings.</p>
      )}
    </div>
  );
}
