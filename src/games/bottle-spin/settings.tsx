import { useState } from "react";
import { Sparkles, Plus, Trash2, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameState } from "@/lib/game-types";
import type { PromptItem, PromptLevel } from "@/games/prompts/prompt-bank";
import type { BottleSpinSettings } from "./types";

interface BottleSpinSettingsProps {
  s: GameState;
  token: string;
  updateSettings: (params: {
    data: {
      sessionToken: string;
      code: string;
      bottleSpinSettings?: Partial<BottleSpinSettings>;
    };
  }) => Promise<unknown>;
  refresh: () => void;
}

export function BottleSpinSettingsView({
  s,
  token,
  updateSettings,
  refresh,
}: BottleSpinSettingsProps) {
  const isHost = s.me.isHost;
  const current = s.bottleSpin?.settings;
  const currentLevel = current?.promptLevel ?? "Chill";
  const customPrompts = current?.customPrompts ?? [];

  const [promptText, setPromptText] = useState("");
  const [promptType, setPromptType] = useState<"truth" | "dare">("truth");
  const [promptLevelChoice, setPromptLevelChoice] = useState<PromptLevel>("Chill");

  async function patch(patch: Partial<BottleSpinSettings>) {
    try {
      await updateSettings({
        data: {
          sessionToken: token,
          code: s.code,
          bottleSpinSettings: patch,
        },
      });
      refresh();
    } catch {
      /* ignore */
    }
  }

  function handleAddCustomPrompt() {
    if (!promptText.trim()) return;
    const newItem: PromptItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: promptType,
      level: promptLevelChoice,
      text: promptText.trim(),
    };
    const updated = [...customPrompts, newItem];
    void patch({ customPrompts: updated });
    setPromptText("");
  }

  function handleRemoveCustomPrompt(id: string) {
    const updated = customPrompts.filter((p) => p.id !== id);
    void patch({ customPrompts: updated });
  }

  const levels: ("Chill" | "Funny" | "Wild" | "All")[] = ["Chill", "Funny", "Wild", "All"];

  return (
    <div className="space-y-4">
      {/* Prompt Level Selection */}
      <div className="space-y-1.5">
        <label className="text-stencil flex items-center gap-1.5">
          <Flame className="size-3.5 text-amber-500" />
          Vibe / Intensity Level
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {levels.map((lvl) => {
            const active = currentLevel === lvl;
            return (
              <Button
                key={lvl}
                size="sm"
                variant={active ? "default" : "secondary"}
                disabled={!isHost}
                onClick={() => patch({ promptLevel: lvl })}
                className={`min-h-[42px] font-bold text-xs sm:text-sm ${
                  active ? "shadow-button ring-2 ring-primary/40" : ""
                }`}
              >
                {lvl === "Chill" && "🧊 "}
                {lvl === "Funny" && "😂 "}
                {lvl === "Wild" && "🔥 "}
                {lvl === "All" && "✨ "}
                {lvl}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Custom Prompts Section */}
      <div className="space-y-2 pt-1 border-t border-border/40">
        <label className="text-stencil flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-teal-500" />
          Room Custom Prompts ({customPrompts.length})
        </label>

        {isHost && (
          <div className="space-y-2 rounded-xl bg-card/60 p-3 border border-border/60">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add your own inside joke / prompt…"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomPrompt();
                  }
                }}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                size="sm"
                onClick={handleAddCustomPrompt}
                disabled={!promptText.trim()}
                className="shrink-0 min-h-[36px] font-bold text-xs"
              >
                <Plus className="size-3.5 mr-1" /> Add
              </Button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-muted-foreground">Type:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  checked={promptType === "truth"}
                  onChange={() => setPromptType("truth")}
                  className="accent-primary"
                />
                <span className="font-bold">Truth</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  checked={promptType === "dare"}
                  onChange={() => setPromptType("dare")}
                  className="accent-primary"
                />
                <span className="font-bold">Dare</span>
              </label>
            </div>
          </div>
        )}

        {customPrompts.length > 0 ? (
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {customPrompts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-card/40 px-2.5 py-1.5 border border-border/40 text-xs"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                      p.type === "truth"
                        ? "bg-teal-500/20 text-teal-600"
                        : "bg-amber-500/20 text-amber-600"
                    }`}
                  >
                    {p.type}
                  </span>
                  <span className="truncate text-foreground font-medium">{p.text}</span>
                </div>
                {isHost && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomPrompt(p.id)}
                    className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">
            No custom prompts added yet. Bundled prompt bank will be used!
          </p>
        )}
      </div>

      {!isHost && (
        <p className="text-[11px] text-muted-foreground italic text-center">
          Only the room host can edit match settings.
        </p>
      )}
    </div>
  );
}
