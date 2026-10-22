import { QRCodeSVG } from "qrcode.react";
import { LogOut, Copy, Share2, Check } from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { RuleBook, SoundToggle } from "@/components/game-extras";
import { play } from "@/lib/sounds";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/hooks/use-player";
import { supabase } from "@/integrations/supabase/client";
import { avatarEmoji, MIN_PLAYERS, type GameState, type PublicPlayer } from "@/lib/game-types";
import { PlayerAvatar } from "@/components/player-avatar";
import {
  getStateFn,
  joinGameFn,
  kickPlayerFn,
  leaveGameFn,
  setReadyFn,
  startGameFn,
  updateSettingsFn,
} from "@/lib/game.functions";
import { getGameById } from "@/games/registry";
import { ImposterGame } from "@/games/imposter";
import { ImposterSettings } from "@/games/imposter/settings";
import { WordDuelGame } from "@/games/word-duel";
import { WordDuelSettingsView } from "@/games/word-duel/settings";
import { NumberGuessGame } from "@/games/number-guess";
import { NumberGuessSettingsView } from "@/games/number-guess/settings";
import { BottleSpinGame } from "@/games/bottle-spin";
import { BottleSpinSettingsView } from "@/games/bottle-spin/settings";
import { TruthOrDareGame } from "@/games/truth-or-dare";
import { TruthOrDareSettingsView } from "@/games/truth-or-dare/settings";
import { ChessGame } from "@/games/chess";
import { ChessSettingsView } from "@/games/chess/settings";
import { LudoGame } from "@/games/ludo";
import { LudoSettingsView } from "@/games/ludo/settings";
import { CarromGame } from "@/games/carrom";
import { CarromSettingsView } from "@/games/carrom/settings";
import { LetterBlitzGame } from "@/games/letter-blitz";
import { LetterBlitzSettingsView } from "@/games/letter-blitz/settings";
import { DoodleRushGame } from "@/games/doodle-rush";
import { DoodleRushSettingsView } from "@/games/doodle-rush/settings";

/** True when the next state change is caused by a clock (countdown, deadline, animation end), not by a player's action. */
function isClockDriven(s: GameState): boolean {
  const t = s.gameType ?? "imposter";
  if (t === "imposter") return s.status === "hint" || s.status === "voting" || s.status === "resolved";
  if (t === "word-duel") return s.wordDuel?.phase === "countdown" || s.wordDuel?.phase === "word";
  if (t === "number-guess") return s.numberGuess?.phase === "countdown";
  if (t === "bottle-spin") return s.bottleSpin?.phase === "spinning";
  if (t === "chess") return Boolean(s.chess?.settings?.timedMode) && s.chess?.phase === "playing";
  if (t === "letter-blitz") return s.letterBlitz?.phase === "countdown" || s.letterBlitz?.phase === "round_active";
  if (t === "doodle-rush") return s.doodleRush?.phase === "countdown" || s.doodleRush?.phase === "drawing";
  return false;
}

export const Route = createFileRoute("/game/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — FRIENDZY` },
      {
        name: "description",
        content: "Play multiplayer party and board games with friends on FRIENDZY.",
      },
      { property: "og:title", content: `Room ${params.code} — FRIENDZY` },
      { property: "og:description", content: "Join this game room on FRIENDZY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GamePage,
});

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setError(null);
    setBusy(true);
    try {
      const res = await fn();
      if (res && typeof res === "object" && "error" in res && typeof res.error === "string") {
        setError(res.error);
        return;
      }
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, run };
}

function GamePage() {
  const { code } = Route.useParams();
  const { player, ready, hasProfile } = usePlayer();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getState = useServerFn(getStateFn);
  const join = useServerFn(joinGameFn);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !player) return;
    if (!hasProfile) {
      navigate({ to: "/" });
      return;
    }
    join({ data: { sessionToken: player.sessionToken, code } })
      .then((res) => {
        // A failed join comes back as { error }, not as an exception.
        if (res && typeof res === "object" && "error" in res && typeof res.error === "string") {
          setJoinError(res.error);
          return;
        }
        setJoined(true);
      })
      .catch((e) => setJoinError(e instanceof Error ? e.message : "Couldn't join."));
  }, [ready, player?.sessionToken, code]);

  // Live push: the server announces every change on a Realtime channel, so a move shows up on the other
  // phones immediately. Polling stays on as a safety net and is only relaxed once a push has really arrived.
  const [pushWorks, setPushWorks] = useState(false);
  useEffect(() => {
    if (!ready || !joined) return;
    const channel = supabase.channel(`room:${code.trim().toUpperCase()}`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    channel
      .on("broadcast", { event: "tick" }, () => {
        setPushWorks(true);
        if (timer) return; // coalesce bursts of changes into one refresh
        timer = setTimeout(() => {
          timer = undefined;
          void qc.invalidateQueries({ queryKey: ["game", code] });
        }, 30);
      })
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [ready, joined, code, qc]);

  const q = useQuery<GameState>({
    queryKey: ["game", code],
    queryFn: () => {
      if (!player) throw new Error("No player session");
      return getState({ data: { sessionToken: player.sessionToken, code } });
    },
    // Wait until our seat exists, otherwise the first poll races the join call.
    enabled: Boolean(ready && player && joined),
    refetchInterval: (query) => {
      const s = query.state.data as GameState | undefined;
      if (!s) return 1000;
      if (s.status === "ended") return pushWorks ? 5000 : 2000;
      // Clock-driven moments (countdowns, deadlines) are never announced by a push: keep polling fast.
      if (isClockDriven(s)) return 700;
      // Turn-based moments are pushed. Once pushes are proven to arrive, polling is just a safety net.
      return pushWorks ? 3000 : s.status === "hint" ? 700 : 1000;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["game", code] });

  // One shared action runner: show the server's message instead of failing silently.
  const runAction = async (fn: () => Promise<unknown>, after?: () => void) => {
    try {
      const res = await fn();
      // Server actions report failures as { ok: false, error } instead of throwing.
      if (res && typeof res === "object" && "error" in res && typeof res.error === "string") {
        toast.error(res.error);
        return;
      }
      after?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  };
  const prev = useRef<{ status?: string; myTurn?: boolean; turn?: string | null }>({});
  const d = q.data;

  useEffect(() => {
    // Keep the phone screen awake during a game.
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (type: string) => Promise<{ release: () => Promise<void> }> };
        };
        lock = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {
        /* unsupported */
      }
    };
    void req();
    const onVis = () => {
      if (document.visibilityState === "visible") void req();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    if (!d) return;
    try {
      localStorage.setItem("friendzy.room", d.code);
      localStorage.setItem("imposta.room", d.code);
    } catch {
      /* ignore */
    }
    const p = prev.current;
    if (p.status && p.status !== d.status) {
      if (d.status === "hint") play("turn");
      else if (d.status === "voting") play("vote");
      else if (d.status === "resolved") play("reveal");
      else if (d.status === "ended") play("win");
    } else if (d.status === "hint" && d.me.isMyTurn && !p.myTurn) {
      play("turn");
    } else if (d.status === "hint" && d.currentTurnProfileId && d.currentTurnProfileId !== p.turn) {
      play("clue");
    }
    prev.current = { status: d.status, myTurn: d.me.isMyTurn, turn: d.currentTurnProfileId };
  }, [d]);

  if (!ready) {
    return (
      <Shell>
        <Center title="Loading player…" />
      </Shell>
    );
  }

  if (joinError && !q.data) {
    return (
      <Shell>
        <Center title="Room not found" body={joinError} />
      </Shell>
    );
  }

  if (q.error) {
    return (
      <Shell>
        <Center
          title="Game error"
          body={q.error instanceof Error ? q.error.message : "Couldn't reach the game."}
        />
      </Shell>
    );
  }

  if (!q.data || !player) {
    return (
      <Shell>
        <Center title="Connecting to room…" />
      </Shell>
    );
  }

  const s = q.data;
  const token = player.sessionToken;
  const currentGame = getGameById(s.gameType ?? "imposter");

  return (
    <Shell>
      <TopBar s={s} token={token} />
      {s.status === "lobby" ? (
        <Lobby s={s} token={token} refresh={refresh} />
      ) : s.gameType === "word-duel" ? (
        <WordDuelGame
          s={s}
          token={token}
          refresh={refresh}
          runAction={runAction}
        />
      ) : s.gameType === "number-guess" ? (
        <NumberGuessGame
          s={s}
          token={token}
          refresh={refresh}
          runAction={runAction}
        />
      ) : s.gameType === "bottle-spin" ? (
        <BottleSpinGame
          s={s}
          token={token}
          refresh={refresh}
          runAction={runAction}
        />
      ) : s.gameType === "truth-or-dare" ? (
        <TruthOrDareGame
          s={s}
          token={token}
          refresh={refresh}
          runAction={runAction}
        />
      ) : s.gameType === "chess" ? (
        <ChessGame
          s={s}
          token={token}
          refresh={refresh}
          runAction={runAction}
        />
      ) : s.gameType === "ludo" ? (
        <LudoGame
          s={s}
          token={token}
          refresh={refresh}
          runAction={runAction}
        />
      ) : s.gameType === "carrom" ? (
        <CarromGame
          s={s}
          token={token}
          refresh={refresh}
          runAction={runAction}
        />
      ) : s.gameType === "letter-blitz" ? (
        <LetterBlitzGame
          s={s}
          token={token}
          refresh={refresh}
          runAction={runAction}
        />
      ) : s.gameType === "doodle-rush" ? (
        <DoodleRushGame
          s={s}
          token={token}
          refresh={refresh}
          runAction={runAction}
        />
      ) : (
        <ImposterGame
          s={s}
          token={token}
          refresh={refresh}
          runAction={runAction}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="game-table min-h-screen px-3 py-4 text-foreground sm:px-6 sm:py-8">
      <div className="game-board mx-auto max-w-xl space-y-5">
        <div className="relative z-10 space-y-5">{children}</div>
      </div>
    </main>
  );
}

function Center({ title, body }: { title: string; body?: string }) {
  return (
    <div className="play-panel space-y-4 p-8 text-center">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      {body && <p className="text-muted-foreground">{body}</p>}
      <Link
        to="/"
        className="clay-button inline-flex min-h-[52px] items-center justify-center rounded-xl bg-primary px-6 py-2.5 font-display text-lg text-primary-foreground shadow-button"
      >
        Back to Hub
      </Link>
    </div>
  );
}

function TopBar({ s, token }: { s: GameState; token: string }) {
  const leave = useServerFn(leaveGameFn);
  const navigate = useNavigate();
  const game = getGameById(s.gameType ?? "imposter");

  return (
    <div className="flex items-center justify-between gap-2 border-b-2 border-border/40 pb-3">
      <Link
        to="/"
        className="flex items-center gap-1.5 font-display text-xl tracking-tight sm:text-2xl"
      >
        <span className="text-xl">
          <img
            src="/stickers/mark-dice.svg"
            alt=""
            width={22}
            height={22}
            className="inline-block size-[22px] select-none drop-shadow-sm"
          />
        </span>
        <span className="text-primary font-black">[FRIENDZY]</span>
      </Link>
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <span className="code-ticket px-2.5 py-1 font-display text-sm tracking-[0.18em] sm:text-base border-2 border-border rounded-lg bg-card">
          {s.code}
        </span>
        <RuleBook />
        <SoundToggle />
        <ThemeToggle />
        <Button
          onClick={async () => {
            if (s.status !== "lobby" && !confirm("Leave this game? You'll be eliminated.")) return;
            await leave({ data: { sessionToken: token, code: s.code } }).catch(() => {});
            try {
              localStorage.removeItem("friendzy.room");
              localStorage.removeItem("imposta.room");
            } catch {
              /* ignore */
            }
            navigate({ to: "/" });
          }}
          variant="ghost"
          size="sm"
          className="px-2 sm:px-3 text-destructive"
          aria-label="Leave room"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline ml-1 font-bold">Leave</span>
        </Button>
      </div>
    </div>
  );
}

function PlayerChip({ p, children }: { p: PublicPlayer; children?: React.ReactNode }) {
  return (
    <div
      className={`player-piece flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 border-border bg-card/80 ${p.isEliminated || p.leftGame ? "opacity-40" : ""}`}
    >
      <PlayerAvatar id={p.avatarId} size={30} className="shrink-0" />
      <span className="flex-1 truncate font-bold text-sm">
        {p.displayName}{" "}
        {p.isHost && (
          <span className="ml-1 inline-flex items-center rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-500 border border-amber-400/40">
            👑 HOST
          </span>
        )}
        {p.isEliminated && <span className="ml-1 text-xs text-muted-foreground">(out)</span>}
      </span>
      {children}
    </div>
  );
}

function Lobby({ s, token, refresh }: { s: GameState; token: string; refresh: () => void }) {
  const setReady = useServerFn(setReadyFn);
  const start = useServerFn(startGameFn);
  const kick = useServerFn(kickPlayerFn);
  const updateSettings = useServerFn(updateSettingsFn);
  const a = useAction();
  const [copied, setCopied] = useState(false);
  const players = s.players.filter((p) => !p.leftGame);
  const allReady = players.every((p) => p.isReady);
  const link = typeof window !== "undefined" ? `${window.location.origin}/game/${s.code}` : "";
  const game = getGameById(s.gameType ?? "imposter");

  const copyCode = () => {
    navigator.clipboard?.writeText(s.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 animate-rise">
      {/* Game Banner Header */}
      <div className="flex items-center justify-between rounded-2xl border-3 border-border bg-secondary/80 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-border shadow-sm p-1.5 ${game?.accentBg ?? "bg-muted"}`}
          >
            <img
              src={game?.stickerUrl ?? "/stickers/mark-dice.svg"}
              alt={game?.name ?? "Game"}
              width={36}
              height={36}
              className="size-9 select-none drop-shadow-sm"
            />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {game?.name ?? "Game Room"}
            </h1>
            <p className="text-xs text-muted-foreground">{game?.tagline}</p>
          </div>
        </div>
        <span className="rounded-full bg-accent/30 px-3 py-1 font-display text-xs text-accent-foreground border border-border">
          {game?.playerCountLabel ?? "3–12 players"}
        </span>
      </div>

      {/* Room Code Ticket & Share Card */}
      <section className="play-panel space-y-4 p-5 text-center">
        <p className="text-stencil text-xs uppercase tracking-wider text-muted-foreground font-bold">
          Invite Friends with Room Code
        </p>
        <div className="flex items-center justify-center gap-2">
          <p className="room-code font-display text-5xl sm:text-6xl tracking-[0.2em] text-primary">
            {s.code}
          </p>
        </div>

        {link && (
          <div className="mx-auto w-fit rounded-2xl bg-card p-4 shadow-sm border-2 border-border">
            <QRCodeSVG
              value={link}
              size={136}
              bgColor="transparent"
              fgColor="currentColor"
              className="text-foreground"
              aria-label="Scan QR code to join"
            />
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={copyCode} className="min-h-[44px]">
            {copied ? (
              <Check className="size-4 mr-1 text-teal-600" />
            ) : (
              <Copy className="size-4 mr-1" />
            )}
            {copied ? "Copied!" : "Copy Code"}
          </Button>

          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button
              size="sm"
              variant="secondary"
              className="min-h-[44px]"
              onClick={() =>
                navigator
                  .share({
                    title: `Play ${game?.name ?? "Game"} on FRIENDZY`,
                    text: `Join my ${game?.name ?? "game"} room on FRIENDZY! Room code: ${s.code}`,
                    url: link,
                  })
                  .catch(() => {})
              }
            >
              <Share2 className="size-4 mr-1" />
              Share Room
            </Button>
          )}
        </div>
      </section>

      {/* Players Grid */}
      <section className="play-panel space-y-3 p-5">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <h2 className="font-display font-semibold text-lg">
            Players ({players.length}/{s.maxPlayers})
          </h2>
          <span className="text-xs font-semibold text-muted-foreground">
            {players.filter((p) => p.isReady).length} ready
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <PlayerChip key={p.profileId} p={p}>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  p.isReady
                    ? "bg-teal-500/20 text-teal-600 border border-teal-500/40"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {p.isReady ? "READY" : "WAITING"}
              </span>
              {s.me.isHost && p.profileId !== s.me.profileId && (
                <Button
                  onClick={() =>
                    a.run(
                      () =>
                        kick({
                          data: { sessionToken: token, code: s.code, targetProfileId: p.profileId },
                        }),
                      refresh,
                    )
                  }
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 text-destructive hover:bg-destructive/10"
                  title="Kick player"
                >
                  ✕
                </Button>
              )}
            </PlayerChip>
          ))}
        </div>
      </section>

      {/* Game-Specific Settings Panel */}
      {s.gameType === "word-duel" ? (
        <section className="play-panel space-y-4 p-5 shadow-panel">
          <h2 className="font-display font-semibold text-lg border-b border-border/40 pb-2">
            Match Settings
          </h2>
          <WordDuelSettingsView
            s={s}
            token={token}
            updateSettings={updateSettings}
            refresh={refresh}
          />
        </section>
      ) : s.gameType === "number-guess" ? (
        <section className="play-panel space-y-4 p-5 shadow-panel">
          <h2 className="font-display font-semibold text-lg border-b border-border/40 pb-2">
            Match Settings
          </h2>
          <NumberGuessSettingsView
            s={s}
            token={token}
            updateSettings={updateSettings}
            refresh={refresh}
          />
        </section>
      ) : s.gameType === "bottle-spin" ? (
        <section className="play-panel space-y-4 p-5 shadow-panel">
          <h2 className="font-display font-semibold text-lg border-b border-border/40 pb-2">
            Match Settings
          </h2>
          <BottleSpinSettingsView
            s={s}
            token={token}
            updateSettings={updateSettings}
            refresh={refresh}
          />
        </section>
      ) : s.gameType === "truth-or-dare" ? (
        <section className="play-panel space-y-4 p-5 shadow-panel">
          <h2 className="font-display font-semibold text-lg border-b border-border/40 pb-2">
            Match Settings
          </h2>
          <TruthOrDareSettingsView
            s={s}
            token={token}
            updateSettings={updateSettings}
            refresh={refresh}
          />
        </section>
      ) : s.gameType === "chess" ? (
        <section className="play-panel space-y-4 p-5 shadow-panel">
          <h2 className="font-display font-semibold text-lg border-b border-border/40 pb-2">
            Match Settings
          </h2>
          <ChessSettingsView
            s={s}
            token={token}
            updateSettings={updateSettings}
            refresh={refresh}
          />
        </section>
      ) : s.gameType === "ludo" ? (
        <section className="play-panel space-y-4 p-5 shadow-panel">
          <h2 className="font-display font-semibold text-lg border-b border-border/40 pb-2">
            Match Settings
          </h2>
          <LudoSettingsView s={s} token={token} updateSettings={updateSettings} refresh={refresh} />
        </section>
      ) : s.gameType === "carrom" ? (
        <section className="play-panel space-y-4 p-5 shadow-panel">
          <h2 className="font-display font-semibold text-lg border-b border-border/40 pb-2">
            Match Settings
          </h2>
          <CarromSettingsView
            s={s}
            token={token}
            updateSettings={updateSettings}
            refresh={refresh}
          />
        </section>
      ) : s.gameType === "letter-blitz" ? (
        <section className="play-panel space-y-4 p-5 shadow-panel">
          <h2 className="font-display font-semibold text-lg border-b border-border/40 pb-2">
            Match Settings
          </h2>
          <LetterBlitzSettingsView s={s} token={token} />
        </section>
      ) : s.gameType === "doodle-rush" ? (
        <section className="play-panel space-y-4 p-5 shadow-panel">
          <h2 className="font-display font-semibold text-lg border-b border-border/40 pb-2">
            Match Settings
          </h2>
          <DoodleRushSettingsView s={s} token={token} />
        </section>
      ) : (
        <ImposterSettings s={s} token={token} refresh={refresh} runAction={a.run} />
      )}

      {/* Primary Action Dock */}
      <div className="space-y-3 pt-2">
        <div className="flex gap-3">
          <Button
            className={`min-h-[56px] flex-1 font-display text-lg tracking-wide shadow-button ${
              s.me.isReady
                ? "bg-secondary text-secondary-foreground"
                : "bg-primary text-primary-foreground"
            }`}
            disabled={a.busy}
            onClick={() =>
              a.run(
                () =>
                  setReady({ data: { sessionToken: token, code: s.code, ready: !s.me.isReady } }),
                refresh,
              )
            }
          >
            {s.me.isReady ? "✕ Cancel Ready" : "✓ I'm Ready"}
          </Button>

          {s.me.isHost && (
            <Button
              className="min-h-[56px] flex-1 font-display text-lg tracking-wide bg-primary text-primary-foreground shadow-button disabled:opacity-50"
              disabled={a.busy || !allReady || players.length < (game?.minPlayers ?? MIN_PLAYERS)}
              onClick={() =>
                a.run(() => start({ data: { sessionToken: token, code: s.code } }), refresh)
              }
            >
              🚀 Start Game
            </Button>
          )}
        </div>

        {s.me.isHost && players.length < (game?.minPlayers ?? MIN_PLAYERS) && (
          <p className="text-center text-xs text-muted-foreground font-semibold">
            Need at least {game?.minPlayers ?? MIN_PLAYERS} players to start.
          </p>
        )}
        {a.error && <p className="text-center text-sm font-bold text-destructive">{a.error}</p>}
      </div>
    </div>
  );
}
