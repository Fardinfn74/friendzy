import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  exampleWordsFor,
  playableLetterPairs,
  validateWordDuelAttempt,
} from "@/games/word-duel/dictionary.server";
import {
  DEFAULT_LETTER_BLITZ_SETTINGS,
  type LetterBlitzClientState,
  type LetterBlitzRound,
  type LetterBlitzServerData,
  type LetterBlitzSettings,
} from "./types";

type AnyGame = {
  id: string;
  code: string;
  host_id: string;
  status: string;
  game_type?: string | null;
  game_settings?: Record<string, unknown> | null;
};

type AnyPlayer = {
  id: string;
  profile_id: string;
  is_host: boolean;
  profiles: { display_name: string; avatar_id: string } | null;
};

/** How long the round summary stays up before the next round starts by itself. */
export const BETWEEN_ROUNDS_MS = 7000;
const COUNTDOWN_MS = 3000;

function fail(msg: string): never {
  throw new Error(msg);
}

/** Letter pairs that have plenty of real answers, never repeating one inside a match. */
function pickLetterPair(usedPairs: Array<[string, string]>): [string, string] {
  const all = playableLetterPairs();
  const fresh = all.filter((p) => !usedPairs.some((u) => u[0] === p[0] && u[1] === p[1]));
  const pool = fresh.length > 0 ? fresh : all;
  const [a, b] = pool[Math.floor(Math.random() * pool.length)]!;
  // show the pair in a random order so "A … T" and "T … A" both come up
  return Math.random() < 0.5 ? [a, b] : [b, a];
}

// ── parse / save ──────────────────────────────────────────────────────────────
export function parseLetterBlitzData(game: AnyGame): LetterBlitzServerData {
  const raw = (game.game_settings ?? {}) as Record<string, unknown>;
  return {
    settings: (raw["letterBlitzSettings"] as LetterBlitzSettings) ?? DEFAULT_LETTER_BLITZ_SETTINGS,
    phase: (raw["letterBlitzPhase"] as LetterBlitzServerData["phase"]) ?? "lobby",
    currentRound: (raw["letterBlitzRound"] as LetterBlitzRound) ?? null,
    scores: (raw["letterBlitzScores"] as Record<string, number>) ?? {},
    roundNumber: (raw["letterBlitzRoundNumber"] as number) ?? 0,
    usedLetterPairs: (raw["letterBlitzUsedPairs"] as Array<[string, string]>) ?? [],
    roundEndsAt: (raw["letterBlitzRoundEndsAt"] as string) ?? null,
    countdownEndsAt: (raw["letterBlitzCountdownEndsAt"] as string) ?? null,
    nextAt: (raw["letterBlitzNextAt"] as string) ?? null,
  };
}

async function saveLetterBlitzData(gameId: string, data: Partial<LetterBlitzServerData>) {
  const keys: Record<string, unknown> = {};
  if (data.settings !== undefined) keys["letterBlitzSettings"] = data.settings;
  if (data.phase !== undefined) keys["letterBlitzPhase"] = data.phase;
  if (data.currentRound !== undefined) keys["letterBlitzRound"] = data.currentRound;
  if (data.scores !== undefined) keys["letterBlitzScores"] = data.scores;
  if (data.roundNumber !== undefined) keys["letterBlitzRoundNumber"] = data.roundNumber;
  if (data.usedLetterPairs !== undefined) keys["letterBlitzUsedPairs"] = data.usedLetterPairs;
  if (data.roundEndsAt !== undefined) keys["letterBlitzRoundEndsAt"] = data.roundEndsAt;
  if (data.countdownEndsAt !== undefined) keys["letterBlitzCountdownEndsAt"] = data.countdownEndsAt;
  if (data.nextAt !== undefined) keys["letterBlitzNextAt"] = data.nextAt;

  const { data: current, error: readError } = await supabaseAdmin
    .from("games")
    .select("game_settings")
    .eq("id", gameId)
    .single();
  if (readError) fail("Something went wrong on our side. Please try again.");
  const currentSettings = ((current as { game_settings?: Record<string, unknown> } | null)
    ?.game_settings ?? {}) as Record<string, unknown>;
  const { error } = await supabaseAdmin
    .from("games")
    .update({ game_settings: { ...currentSettings, ...keys } as unknown as Json })
    .eq("id", gameId);
  if (error) fail("Something went wrong on our side. Please try again.");
}

// ── client state projection ───────────────────────────────────────────────────
export function buildLetterBlitzClientState(data: LetterBlitzServerData): LetterBlitzClientState {
  const over = data.phase === "round_end" || data.phase === "game_over";
  let round: LetterBlitzRound | null = data.currentRound;
  if (round && !over) {
    const { examples: _hidden, ...withoutAnswers } = round; // don't hand out answers mid-round
    round = withoutAnswers;
  }
  return {
    phase: data.phase,
    settings: data.settings,
    currentRound: round,
    scores: data.scores,
    roundNumber: data.roundNumber,
    totalRounds: data.settings.rounds,
    countdownEndsAt: data.countdownEndsAt,
    nextAt: data.phase === "round_end" ? data.nextAt : null,
  };
}

// ── actions ───────────────────────────────────────────────────────────────────
export async function startLetterBlitzMatch(game: AnyGame, players: AnyPlayer[]) {
  if (players.length < 2) fail("Letter Blitz requires at least 2 players.");
  if (!players.every((p) => p.profiles)) fail("All players need a profile.");
  const raw = (game.game_settings ?? {}) as Record<string, unknown>;
  const settings: LetterBlitzSettings = {
    rounds: Number(raw["letterBlitzRounds"] ?? DEFAULT_LETTER_BLITZ_SETTINGS.rounds),
    roundTime: Number(raw["letterBlitzRoundTime"] ?? DEFAULT_LETTER_BLITZ_SETTINGS.roundTime),
  };
  const initScores: Record<string, number> = {};
  for (const p of players) initScores[p.profile_id] = 0;

  const countdownEndsAt = new Date(Date.now() + COUNTDOWN_MS).toISOString();
  const letterPair = pickLetterPair([]);
  const round: LetterBlitzRound = {
    roundNumber: 1,
    letters: letterPair,
    guesses: [],
    endsAt: new Date(Date.now() + COUNTDOWN_MS + settings.roundTime * 1000).toISOString(),
    winnerId: null,
  };
  await saveLetterBlitzData(game.id, {
    settings,
    phase: "countdown",
    currentRound: round,
    scores: initScores,
    roundNumber: 1,
    usedLetterPairs: [letterPair],
    roundEndsAt: round.endsAt,
    countdownEndsAt,
    nextAt: null,
  });
  await supabaseAdmin.from("games").update({ status: "playing" }).eq("id", game.id);
}

/** Ends the round: real answers are revealed and the next round is scheduled. */
function closeRound(data: LetterBlitzServerData): Partial<LetterBlitzServerData> {
  const round = data.currentRound;
  return {
    phase: "round_end",
    nextAt: new Date(Date.now() + BETWEEN_ROUNDS_MS).toISOString(),
    ...(round
      ? {
          currentRound: { ...round, examples: exampleWordsFor(round.letters[0], round.letters[1]) },
        }
      : {}),
  };
}

export async function submitLetterBlitzGuess(
  game: AnyGame,
  profileId: string,
  displayName: string,
  word: string,
  seatedPlayers: number,
): Promise<{ ok: boolean; rank: number | null; error?: string }> {
  const data = parseLetterBlitzData(game);
  const round = data.currentRound;
  if (data.phase !== "round_active" || !round)
    return { ok: false, rank: null, error: "Round not active." };
  if (round.endsAt && Date.now() > new Date(round.endsAt).getTime()) {
    return { ok: false, rank: null, error: "Time's up!" };
  }
  if (!(profileId in data.scores))
    return { ok: false, rank: null, error: "You're not in this match." };

  const [l1, l2] = round.letters;
  const validation = validateWordDuelAttempt(word, l1, l2);
  if (!validation.valid)
    return { ok: false, rank: null, error: validation.reason ?? "Invalid word." };
  const cleanWord = validation.normalizedWord!.toUpperCase();

  if (round.guesses.some((g) => g.profileId === profileId && g.accepted)) {
    return { ok: false, rank: null, error: "You already submitted a valid word." };
  }
  if (round.guesses.some((g) => g.word.toUpperCase() === cleanWord && g.accepted)) {
    return {
      ok: false,
      rank: null,
      error: `"${cleanWord}" was already claimed by another player!`,
    };
  }

  const rank = round.guesses.filter((g) => g.accepted).length + 1;
  const points = rank === 1 ? 3 : rank === 2 ? 2 : 1; // 1st 3 pts, 2nd 2 pts, everyone else 1 pt
  const updatedRound: LetterBlitzRound = {
    ...round,
    winnerId: round.winnerId ?? profileId,
    guesses: [
      ...round.guesses,
      {
        profileId,
        displayName,
        word: cleanWord,
        accepted: true,
        rank,
        submittedAt: new Date().toISOString(),
      },
    ],
  };
  const scores = { ...data.scores, [profileId]: (data.scores[profileId] ?? 0) + points };

  // Everybody found a word: no reason to wait for the clock.
  const answered = updatedRound.guesses.filter((g) => g.accepted).length;
  const everyoneDone = answered >= Math.max(2, seatedPlayers);
  await saveLetterBlitzData(game.id, {
    currentRound: updatedRound,
    scores,
    ...(everyoneDone ? closeRound({ ...data, currentRound: updatedRound }) : {}),
  });
  return { ok: true, rank };
}

export async function advanceLetterBlitzRound(game: AnyGame): Promise<void> {
  const data = parseLetterBlitzData(game);
  if (data.phase !== "round_end") return; // already moved on (a second click or the timer got there first)
  const nextRoundNum = data.roundNumber + 1;
  if (nextRoundNum > data.settings.rounds) {
    await saveLetterBlitzData(game.id, { phase: "game_over", nextAt: null });
    await supabaseAdmin.from("games").update({ status: "ended" }).eq("id", game.id);
    return;
  }
  const letterPair = pickLetterPair(data.usedLetterPairs);
  const round: LetterBlitzRound = {
    roundNumber: nextRoundNum,
    letters: letterPair,
    guesses: [],
    endsAt: new Date(Date.now() + data.settings.roundTime * 1000).toISOString(),
    winnerId: null,
  };
  await saveLetterBlitzData(game.id, {
    phase: "round_active",
    currentRound: round,
    roundNumber: nextRoundNum,
    usedLetterPairs: [...data.usedLetterPairs, letterPair],
    roundEndsAt: round.endsAt,
    nextAt: null,
  });
}

/** Cheap check (no database): is a clock-driven change due? Lets pollers skip the lock when nothing is due. */
export function letterBlitzTickDue(game: AnyGame, now = Date.now()): boolean {
  const d = parseLetterBlitzData(game);
  if (d.phase === "countdown" && d.countdownEndsAt) return now >= Date.parse(d.countdownEndsAt);
  if (d.phase === "round_active" && d.roundEndsAt) return now >= Date.parse(d.roundEndsAt);
  if (d.phase === "round_end" && d.nextAt) return now >= Date.parse(d.nextAt);
  return false;
}

/** Applies the due clock-driven change. Call it inside the room lock with a freshly loaded game. */
export async function tickLetterBlitz(game: AnyGame): Promise<boolean> {
  const data = parseLetterBlitzData(game);
  const now = Date.now();
  if (
    data.phase === "countdown" &&
    data.countdownEndsAt &&
    now >= Date.parse(data.countdownEndsAt)
  ) {
    await saveLetterBlitzData(game.id, { phase: "round_active" });
    return true;
  }
  if (data.phase === "round_active" && data.roundEndsAt && now >= Date.parse(data.roundEndsAt)) {
    await saveLetterBlitzData(game.id, closeRound(data));
    return true;
  }
  if (data.phase === "round_end" && data.nextAt && now >= Date.parse(data.nextAt)) {
    await advanceLetterBlitzRound(game);
    return true;
  }
  return false;
}
