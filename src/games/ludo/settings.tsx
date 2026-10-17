import { Dices, Sparkles } from "lucide-react";
import type { GameState } from "@/lib/game-types";
import type { LudoSettings } from "./types";

interface LudoSettingsProps {
  s: GameState;
  token: string;
  updateSettings: (params: {
    data: {
      sessionToken: string;
      code: string;
      ludoSettings?: Partial<LudoSettings>;
    };
  }) => Promise<unknown>;
  refresh: () => void;
}

export function LudoSettingsView({ s, token, updateSettings, refresh }: LudoSettingsProps) {
  const isHost = s.me.isHost;
  const currentTokens = s.ludo?.settings?.tokensPerPlayer ?? 4;

  const handleUpdate = async (patch: Partial<LudoSettings>) => {
    await updateSettings({
      data: {
        sessionToken: token,
        code: s.code,
        ludoSettings: patch,
      },
    });
    refresh();
  };

  return (
    <div className="space-y-4">
      {/* Tokens Mode */}
      <div className="space-y-2">
        <label className="text-sm font-semibold flex items-center gap-1.5 text-foreground/80">
          <Dices className="w-4 h-4 text-primary" />
          Tokens Per Player
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { tokens: 2, label: "2 Tokens", sub: "Fast Match (5-8m)" },
            { tokens: 4, label: "4 Tokens", sub: "Classic Race" },
          ].map(({ tokens, label, sub }) => (
            <button
              key={tokens}
              type="button"
              disabled={!isHost}
              onClick={() => {
                void handleUpdate({ tokensPerPlayer: tokens as 2 | 4 });
              }}
              className={`p-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center ${
                currentTokens === tokens
                  ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]"
                  : "bg-background/60 hover:bg-muted text-foreground border-border/60"
              } ${!isHost ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-center gap-1 text-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{label}</span>
              </div>
              <span className="text-[10px] opacity-80 mt-0.5">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {!isHost && (
        <p className="text-xs text-muted-foreground text-center italic">
          Only the host can modify Ludo settings.
        </p>
      )}
    </div>
  );
}
