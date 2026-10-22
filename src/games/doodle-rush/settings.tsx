import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateSettingsFn } from "@/lib/game.functions";
import { useServerFn } from "@tanstack/react-start";
import type { GameState } from "@/lib/game-types";

interface DoodleRushSettingsProps {
  s: GameState;
  token: string;
}

const ROUND_OPTIONS = [2, 3, 5] as const;
const TIME_OPTIONS = [60, 80, 120] as const;

export function DoodleRushSettingsView({ s, token }: DoodleRushSettingsProps) {
  const updateSettings = useServerFn(updateSettingsFn);
  const settings = s.gameSettings;
  const [saving, setSaving] = useState(false);

  const currentRounds = Number(settings?.doodleRushRounds ?? 3);
  const currentTime = Number(settings?.doodleRushDrawTime ?? 80);

  async function handleChange(key: string, value: number) {
    if (!s.me.isHost) return;
    setSaving(true);
    try {
      await updateSettings({
        data: {
          sessionToken: token,
          code: s.code,
          doodleRushSettings: {
            rounds: key === "doodleRushRounds" ? value : currentRounds,
            drawTime: key === "doodleRushDrawTime" ? value : currentTime,
          },
        },
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="font-display font-bold text-sm">Rounds per Player</p>
        <div className="flex gap-2">
          {ROUND_OPTIONS.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={currentRounds === n ? "default" : "secondary"}
              onClick={() => handleChange("doodleRushRounds", n)}
              disabled={!s.me.isHost || saving}
              className="flex-1"
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-display font-bold text-sm">Draw Time</p>
        <div className="flex gap-2">
          {TIME_OPTIONS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={currentTime === t ? "default" : "secondary"}
              onClick={() => handleChange("doodleRushDrawTime", t)}
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
