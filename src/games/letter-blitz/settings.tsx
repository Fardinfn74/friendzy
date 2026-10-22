import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateSettingsFn } from "@/lib/game.functions";
import { useServerFn } from "@tanstack/react-start";
import type { GameState } from "@/lib/game-types";

interface LetterBlitzSettingsProps {
  s: GameState;
  token: string;
}

const ROUND_OPTIONS = [3, 5, 7] as const;
const TIME_OPTIONS = [30, 45, 60] as const;

export function LetterBlitzSettingsView({ s, token }: LetterBlitzSettingsProps) {
  const updateSettings = useServerFn(updateSettingsFn);
  const settings = s.gameSettings;
  const [saving, setSaving] = useState(false);

  const currentRounds = Number(settings?.letterBlitzRounds ?? 5);
  const currentTime = Number(settings?.letterBlitzRoundTime ?? 45);

  async function handleChange(key: string, value: number) {
    if (!s.me.isHost) return;
    setSaving(true);
    try {
      await updateSettings({
        data: {
          sessionToken: token,
          code: s.code,
          letterBlitzSettings: {
            rounds: key === "letterBlitzRounds" ? value : currentRounds,
            roundTime: key === "letterBlitzRoundTime" ? value : currentTime,
          },
        },
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Rounds */}
      <div className="space-y-2">
        <p className="font-display font-bold text-sm">Rounds</p>
        <div className="flex gap-2">
          {ROUND_OPTIONS.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={currentRounds === n ? "default" : "secondary"}
              onClick={() => handleChange("letterBlitzRounds", n)}
              disabled={!s.me.isHost || saving}
              className="flex-1"
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      {/* Round time */}
      <div className="space-y-2">
        <p className="font-display font-bold text-sm">Time per Round</p>
        <div className="flex gap-2">
          {TIME_OPTIONS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={currentTime === t ? "default" : "secondary"}
              onClick={() => handleChange("letterBlitzRoundTime", t)}
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
