import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maxImposters, type GameState } from "@/lib/game-types";
import { generateThemeWordFn, updateSettingsFn } from "@/lib/game.functions";

export function ImposterSettings({
  s,
  token,
  refresh,
  runAction,
}: {
  s: GameState;
  token: string;
  refresh: () => void;
  runAction: (fn: () => Promise<unknown>, after?: () => void) => Promise<void>;
}) {
  const settings = useServerFn(updateSettingsFn);
  const gen = useServerFn(generateThemeWordFn);
  const [theme, setTheme] = useState("");
  const [themeBusy, setThemeBusy] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);

  const players = s.players.filter((p) => !p.leftGame);
  const cap = maxImposters(players.length);

  return (
    <section className="play-panel space-y-4 p-5 text-foreground">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <span>🕵️</span> Imposter Game Settings
        </h2>
        {!s.me.isHost && (
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            Host Only
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">Difficulty</span>
        <div className="flex gap-1">
          {(["easy", "medium", "hard"] as const).map((d) => (
            <Button
              key={d}
              disabled={!s.me.isHost}
              onClick={() =>
                runAction(
                  () => settings({ data: { sessionToken: token, code: s.code, difficulty: d } }),
                  refresh,
                )
              }
              size="sm"
              variant={s.difficulty === d ? "default" : "secondary"}
              className="capitalize"
            >
              {d}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">Mode</span>
        <div className="flex gap-1">
          {(["classic", "double"] as const).map((m) => (
            <Button
              key={m}
              disabled={!s.me.isHost}
              onClick={() =>
                runAction(
                  () => settings({ data: { sessionToken: token, code: s.code, mode: m } }),
                  refresh,
                )
              }
              size="sm"
              variant={s.mode === m ? "default" : "secondary"}
            >
              {m === "classic" ? "Classic" : "Double Agent"}
            </Button>
          ))}
        </div>
      </div>

      {s.mode === "double" && (
        <p className="rounded-lg bg-accent/20 p-2 text-xs text-muted-foreground border border-border">
          🕵️ <b>Double Agent</b>: Imposters receive a decoy word and don't know they are imposters!
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">Imposters</span>
        <div className="flex gap-1">
          {[1, 2, 3].map((n) => (
            <Button
              key={n}
              disabled={!s.me.isHost || n > cap}
              onClick={() =>
                runAction(
                  () => settings({ data: { sessionToken: token, code: s.code, imposterCount: n } }),
                  refresh,
                )
              }
              size="sm"
              variant={s.imposterCount === n ? "destructive" : "secondary"}
              className="disabled:opacity-30"
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      {s.me.isHost ? (
        <form
          className="space-y-2 border-t border-border pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (theme.trim().length < 2) return;
            setThemeBusy(true);
            setThemeError(null);
            try {
              const res = await gen({
                data: { sessionToken: token, code: s.code, theme: theme.trim() },
              });
              if (
                res &&
                typeof res === "object" &&
                "error" in res &&
                typeof res.error === "string"
              ) {
                setThemeError(res.error);
              } else {
                setTheme("");
                refresh();
              }
            } catch (err) {
              setThemeError(err instanceof Error ? err.message : "Failed to generate word");
            } finally {
              setThemeBusy(false);
            }
          }}
        >
          <label htmlFor="ai-theme" className="block text-sm font-medium">
            ✨ Custom AI Theme Word{" "}
            <span className="text-xs text-muted-foreground">(optional)</span>
          </label>
          <div className="flex gap-2">
            <Input
              id="ai-theme"
              value={theme}
              maxLength={60}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. superhero movies, camping, 90s snacks"
            />
            <Button type="submit" size="sm" disabled={themeBusy || theme.trim().length < 2}>
              {themeBusy ? "Thinking…" : "Generate"}
            </Button>
          </div>
          {s.aiTheme ? (
            <p className="text-xs text-crew">
              Secret word ready for theme “{s.aiTheme}” — it stays hidden until the round starts!
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Leave empty to pick words from the built-in bank.
            </p>
          )}
          {themeError && <p className="text-xs text-destructive">{themeError}</p>}
        </form>
      ) : (
        s.aiTheme && (
          <p className="text-xs text-muted-foreground border-t border-border pt-2">
            ✨ AI theme word for this game: <b className="text-ember">{s.aiTheme}</b>
          </p>
        )
      )}
    </section>
  );
}
