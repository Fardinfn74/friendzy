import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccount } from "@/hooks/use-account";
import { avatarEmoji, type GameState, type PublicPlayer } from "@/lib/game-types";
import { PlayerAvatar, Emoji } from "@/components/player-avatar";
import { play } from "@/lib/sounds";
import { confirmCardFn, playAgainFn, submitHintFn, submitVoteFn } from "@/lib/game.functions";

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return now;
}

function secondsLeft(deadline: string | null, now: number) {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
}

function Btn(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost" | "danger";
  },
) {
  const { variant = "primary", className = "", ...rest } = props;
  const styles = {
    primary: "bg-primary text-primary-foreground",
    ghost: "bg-secondary text-secondary-foreground",
    danger: "bg-imposter text-imposter-foreground",
  }[variant];
  return (
    <Button
      {...rest}
      className={`min-h-[52px] px-4 py-3 font-display text-lg ${styles} ${className}`}
    />
  );
}

function PlayerChip({ p, children }: { p: PublicPlayer; children?: React.ReactNode }) {
  return (
    <div
      className={`player-piece flex items-center gap-3 px-3 py-2 ${p.isEliminated || p.leftGame ? "opacity-40" : ""}`}
    >
      <PlayerAvatar id={p.avatarId} size={30} className="shrink-0" />
      <span className="flex-1 truncate font-medium">
        {p.displayName} {p.isHost && <span className="text-xs text-ember font-bold">HOST</span>}
        {p.isEliminated && <span className="ml-1 text-xs text-muted-foreground">out</span>}
      </span>
      {children}
    </div>
  );
}

export function RoleCard({ s }: { s: GameState }) {
  const c = s.myCard;
  const { account } = useAccount();
  if (!c) return null;
  const imp = c.role === "imposter";
  const skin = account?.equippedSkin ?? "classic";
  return (
    <div
      className={`role-card animate-flip ${imp ? "role-card-imposter" : "role-card-crew"} ${skin !== "classic" ? skin : ""}`}
    >
      <div className="role-card-inner">
        <div className="role-serial">IMPOSTA · R{s.roundNumber.toString().padStart(2, "0")}</div>
        <div className="role-emblem" aria-hidden="true">
          {imp ? "🕵️" : "🔎"}
        </div>
        <p className={`font-display text-3xl ${imp ? "text-imposter" : "text-crew"}`}>
          {imp ? "You are the imposter" : "You are crew"}
        </p>
        {imp ? (
          <p className="mt-4 text-muted-foreground">
            You don't know the word. Blend in with your clues.
          </p>
        ) : (
          <>
            <p className="category-ticket mt-3 inline-block text-xs font-bold uppercase">
              {c.category}
            </p>
            <p className="mt-3 font-display text-5xl">{c.word}</p>
          </>
        )}
        <div className="role-card-dots" aria-hidden="true">
          •••
        </div>
      </div>
    </div>
  );
}

export function RevealScreen({
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
  const confirm = useServerFn(confirmCardFn);
  const [show, setShow] = useState(false);
  const alive = s.players.filter((p) => !p.isEliminated && !p.leftGame);
  const seen = alive.filter((p) => p.cardSeen).length;

  return (
    <div className="space-y-5 text-center animate-rise">
      <h2 className="font-display text-2xl font-bold">Your Secret Role Card</h2>
      <p className="text-sm text-muted-foreground">Keep your screen hidden from friends nearby.</p>
      {show ? (
        <RoleCard s={s} />
      ) : (
        <Button
          onClick={() => {
            setShow(true);
            play("reveal");
          }}
          variant="secondary"
          className="card-back w-full min-h-80 flex-col font-display text-3xl"
        >
          <span className="mystery-mark text-6xl">🕵️</span>
          <span className="mt-2">Tap to reveal</span>
          <small className="font-sans text-xs uppercase text-muted-foreground mt-1">
            Keep it secret
          </small>
        </Button>
      )}
      {show && !s.me.cardSeen && (
        <Btn
          className="w-full min-h-[56px]"
          onClick={() =>
            runAction(() => confirm({ data: { sessionToken: token, code: s.code } }), refresh)
          }
        >
          Got it, I'm ready
        </Btn>
      )}
      <p className="text-sm text-muted-foreground">
        {seen}/{alive.length} players ready
      </p>
    </div>
  );
}

export function RoundScreen({
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
  const now = useNow();
  const [peek, setPeek] = useState(false);
  const byId = new Map(s.players.map((p) => [p.profileId, p]));
  const current = s.currentTurnProfileId ? byId.get(s.currentTurnProfileId) : null;
  const deadline =
    s.status === "hint" ? s.turnDeadline : s.status === "voting" ? s.voteDeadline : s.resolveUntil;
  const left = secondsLeft(deadline, now);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Round {s.roundNumber} ·{" "}
          {s.status === "hint" ? "Clues" : s.status === "voting" ? "Vote" : "Result"}
        </span>
        {left !== null && (
          <span className="font-display text-2xl font-bold text-ember">{left}s</span>
        )}
      </div>

      <Button
        onClick={() => setPeek((v) => !v)}
        variant="link"
        className="w-full text-sm text-muted-foreground"
      >
        {peek ? "Hide my card" : "Peek at my card"}
      </Button>
      {peek && <RoleCard s={s} />}

      {s.status === "hint" && (
        <div className="play-panel p-4 text-center">
          {s.me.isMyTurn ? (
            <HintInput s={s} token={token} refresh={refresh} runAction={runAction} />
          ) : (
            <p className="flex items-center justify-center gap-2">
              <PlayerAvatar id={current?.avatarId} size={28} />
              <span>
                <b>{current?.displayName ?? "…"}</b> is giving a clue
              </span>
            </p>
          )}
          {s.me.isEliminated && (
            <p className="mt-2 text-sm text-muted-foreground">You're out — watch and enjoy.</p>
          )}
        </div>
      )}

      {s.status === "voting" && (
        <VotingSection s={s} token={token} refresh={refresh} runAction={runAction} />
      )}

      {s.status === "resolved" && (
        <div className="play-panel result-burst animate-rise p-6 text-center">
          {s.lastEliminated.profileId ? (
            <>
              <div className="flex justify-center mb-2">
                <PlayerAvatar id={byId.get(s.lastEliminated.profileId)?.avatarId} size={64} />
              </div>
              <p className="mt-2 font-display text-xl font-bold">
                {byId.get(s.lastEliminated.profileId)?.displayName} was voted out
              </p>
              <p
                className={
                  s.lastEliminated.wasImposter ? "text-crew font-bold" : "text-imposter font-bold"
                }
              >
                {s.lastEliminated.wasImposter ? "…and was an imposter!" : "…and was innocent."}
              </p>
            </>
          ) : (
            <p className="font-display text-xl">
              {s.lastEliminated.note ?? "No one was voted out."}
            </p>
          )}
        </div>
      )}

      <section className="play-panel space-y-2 p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Clues Log
        </h3>
        {s.hints.length === 0 && <p className="text-sm text-muted-foreground">No clues yet.</p>}
        {[...s.hints].reverse().map((h, i) => {
          const p = byId.get(h.profileId);
          return (
            <div
              key={i}
              className="flex items-center gap-2 text-sm border-b border-border/30 pb-1.5 last:border-none"
            >
              <span className="text-xs text-muted-foreground">R{h.roundNumber}</span>
              <PlayerAvatar id={p?.avatarId} size={22} />
              <b>{p?.displayName}</b>
              <span className={h.skipped ? "italic text-muted-foreground" : ""}>
                {h.skipped ? "stayed silent" : h.message}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function HintInput({
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
  const submit = useServerFn(submitHintFn);
  const [msg, setMsg] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!msg.trim()) return;
        runAction(
          () => submit({ data: { sessionToken: token, code: s.code, message: msg.trim() } }),
          () => {
            setMsg("");
            refresh();
          },
        );
      }}
    >
      <p className="font-display font-semibold text-ember text-lg">Your turn — give a clue!</p>
      <div className="flex gap-2">
        <Input
          autoFocus
          value={msg}
          maxLength={80}
          onChange={(e) => setMsg(e.target.value)}
          className="w-full text-base"
          placeholder="One word or short phrase"
        />
        <Btn disabled={!msg.trim()}>Send</Btn>
      </div>
    </form>
  );
}

function VotingSection({
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
  const vote = useServerFn(submitVoteFn);
  const [picked, setPicked] = useState<string[]>([]);
  const candidates = s.players.filter(
    (p) => !p.isEliminated && !p.leftGame && p.profileId !== s.me.profileId,
  );

  if (s.me.isEliminated) {
    return (
      <p className="play-panel p-4 text-center text-muted-foreground">
        Voting in progress… ({s.votesCast}/{s.votesNeeded} voted)
      </p>
    );
  }

  function toggle(id: string) {
    setPicked((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length >= s.suspectsAllowed
          ? [...cur.slice(1), id]
          : [...cur, id],
    );
  }

  const send = (replay: boolean) =>
    runAction(
      () =>
        vote({
          data: { sessionToken: token, code: s.code, targetIds: replay ? [] : picked, replay },
        }),
      refresh,
    );

  return (
    <section className="play-panel space-y-3 p-4">
      <p className="text-center font-medium">
        Pick {s.suspectsAllowed > 1 ? `up to ${s.suspectsAllowed} suspects` : "your suspect"} ·{" "}
        {s.votesCast}/{s.votesNeeded} voted
      </p>
      {candidates.map((p) => (
        <Button
          key={p.profileId}
          variant="ghost"
          onClick={() => {
            play("pick");
            toggle(p.profileId);
          }}
          className={`block h-auto w-full p-0 text-left ${picked.includes(p.profileId) ? "suspect-picked" : ""}`}
        >
          <PlayerChip p={p}>
            <span
              className={
                picked.includes(p.profileId) ? "text-imposter font-bold" : "text-muted-foreground"
              }
            >
              {picked.includes(p.profileId) ? "Suspect" : ""}
            </span>
          </PlayerChip>
        </Button>
      ))}
      <Btn
        variant="danger"
        className="w-full min-h-[56px]"
        disabled={picked.length === 0}
        onClick={() => send(false)}
      >
        {s.me.hasVoted ? "Change vote" : "Cast vote"}
      </Btn>
      {s.replayAvailable && (
        <Btn variant="ghost" className="w-full min-h-[50px]" onClick={() => send(true)}>
          Another clue round instead
        </Btn>
      )}
      {s.me.hasVoted && (
        <p className="text-center text-sm text-crew font-semibold">
          Vote recorded — you can change it until time runs out.
        </p>
      )}
    </section>
  );
}

export function EndedScreen({
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
  const again = useServerFn(playAgainFn);
  const crew = s.winner === "crew";
  return (
    <div className="space-y-5 text-center animate-rise">
      <div
        className={`play-panel victory-panel p-8 ring-2 ${crew ? "ring-crew" : "ring-imposter"}`}
      >
        <p className={`font-display text-4xl font-bold ${crew ? "text-crew" : "text-imposter"}`}>
          {crew ? "Crew wins! 🎉" : s.winner === "imposters" ? "Imposters win! 🕵️" : "Game over"}
        </p>
        {s.revealedWord && (
          <p className="mt-3 text-muted-foreground">
            The secret word was <b className="text-foreground">{s.revealedWord}</b> (
            {s.revealedCategory})
            {s.revealedDecoy && (
              <>
                {" "}
                · imposters had decoy <b className="text-foreground">{s.revealedDecoy}</b>
              </>
            )}
          </p>
        )}
      </div>
      <section className="play-panel space-y-2 p-4 text-left">
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Player Identities
        </h3>
        {s.players.map((p) => (
          <PlayerChip key={p.profileId} p={{ ...p, isEliminated: false, leftGame: false }}>
            <span className={p.isImposter ? "text-imposter font-bold" : "text-crew font-bold"}>
              {p.isImposter ? "Imposter" : "Crew"}
            </span>
          </PlayerChip>
        ))}
      </section>
      {s.me.isHost ? (
        <Btn
          className="w-full min-h-[56px]"
          onClick={() =>
            runAction(() => again({ data: { sessionToken: token, code: s.code } }), refresh)
          }
        >
          Play again
        </Btn>
      ) : (
        <p className="text-muted-foreground font-medium">
          Waiting for the host to start another game…
        </p>
      )}
    </div>
  );
}

export function ImposterGame({
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
  if (s.status === "reveal") {
    return <RevealScreen s={s} token={token} refresh={refresh} runAction={runAction} />;
  }
  if (s.status === "hint" || s.status === "voting" || s.status === "resolved") {
    return <RoundScreen s={s} token={token} refresh={refresh} runAction={runAction} />;
  }
  if (s.status === "ended") {
    return <EndedScreen s={s} token={token} refresh={refresh} runAction={runAction} />;
  }
  return null;
}
