import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateWordDuelAttempt, SOLVABLE_LETTER_PAIRS } from "@/games/word-duel/dictionary.server";
import {
  DEFAULT_LETTER_BLITZ_SETTINGS,
  type LetterBlitzServerData,
  type LetterBlitzClientState,
  type LetterBlitzSettings,
  type LetterBlitzRound,
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

// ── helpers ───────────────────────────────────────────────────────────────────
function pickLetterPair(usedPairs: Array<[string, string]>): [string, string] {
  // Only select pairs that have at least 15 valid English words in the dictionary.
  // This guarantees a 100% chance for players to make words, excluding impossible pairs like U&V, P&Q, etc.
  const available = SOLVABLE_LETTER_PAIRS.filter(
    (p) =>
      !usedPairs.some(
        (u) =>
          (u[0] === p[0] && u[1] === p[1]) || (u[0] === p[1] && u[1] === p[0]),
      ),
  );
  const pool = available.length > 0 ? available : SOLVABLE_LETTER_PAIRS;
  const chosen = pool[Math.floor(Math.random() * pool.length)]!;
  // Randomize which letter appears first and second for variety
  return Math.random() > 0.5 ? [chosen[0]!, chosen[1]!] : [chosen[1]!, chosen[0]!];
}

function fail(msg: string): never {
  throw new Error(msg);
}

// ── parse/save ────────────────────────────────────────────────────────────────
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

  // Fetch current settings and merge
  const { data: current } = await (supabaseAdmin as any)
    .from("games")
    .select("game_settings")
    .eq("id", gameId)
    .single();

  const currentSettings = ((current as any)?.game_settings ?? {}) as Record<string, unknown>;
  const merged = { ...currentSettings, ...keys };
  const { error } = await (supabaseAdmin as any)
    .from("games")
    .update({ game_settings: merged })
    .eq("id", gameId);

  if (error) throw new Error(error.message);
}

// ── client state projection ───────────────────────────────────────────────────
export function buildLetterBlitzClientState(
  data: LetterBlitzServerData,
): LetterBlitzClientState {
  return {
    phase: data.phase,
    settings: data.settings,
    currentRound: data.currentRound,
    scores: data.scores,
    roundNumber: data.roundNumber,
    totalRounds: data.settings.rounds,
    countdownEndsAt: data.countdownEndsAt,
  };
}

// ── actions ───────────────────────────────────────────────────────────────────
export async function startLetterBlitzMatch(
  game: AnyGame,
  players: AnyPlayer[],
) {
  if (players.length < 2) fail("Letter Blitz requires at least 2 players.");
  if (!players.every((p) => p.profiles)) fail("All players need a profile.");

  const raw = (game.game_settings ?? {}) as Record<string, unknown>;
  const settings: LetterBlitzSettings = {
    rounds: Number(raw["letterBlitzRounds"] ?? DEFAULT_LETTER_BLITZ_SETTINGS.rounds),
    roundTime: Number(raw["letterBlitzRoundTime"] ?? DEFAULT_LETTER_BLITZ_SETTINGS.roundTime),
  };

  const initScores: Record<string, number> = {};
  for (const p of players) initScores[p.profile_id] = 0;

  // Start countdown (3 seconds before first round)
  const countdownEndsAt = new Date(Date.now() + 3000).toISOString();

  const letterPair = pickLetterPair([]);
  const round: LetterBlitzRound = {
    roundNumber: 1,
    letters: letterPair,
    guesses: [],
    endsAt: new Date(Date.now() + 3000 + settings.roundTime * 1000).toISOString(),
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
  });

  await supabaseAdmin
    .from("games")
    .update({ status: "playing" })
    .eq("id", game.id);
}

export async function submitLetterBlitzGuess(
  game: AnyGame,
  profileId: string,
  displayName: string,
  word: string,
): Promise<{ ok: boolean; rank: number | null; error?: string }> {
  const data = parseLetterBlitzData(game);
  if (data.phase !== "round_active") return { ok: false, rank: null, error: "Round not active." };

  const round = data.currentRound;
  if (!round) return { ok: false, rank: null, error: "No active round." };

  const [l1, l2] = round.letters;
  const validation = validateWordDuelAttempt(word, l1, l2);
  if (!validation.valid) {
    return { ok: false, rank: null, error: validation.reason ?? "Invalid word." };
  }
  const cleanWord = validation.normalizedWord!.toUpperCase();

  // Check not already guessed by this player
  const alreadyGuessed = round.guesses.find((g) => g.profileId === profileId && g.accepted);
  if (alreadyGuessed) return { ok: false, rank: null, error: "You already submitted a valid word." };

  // Check for duplicate word in this round
  const duplicate = round.guesses.find((g) => g.word.toUpperCase() === cleanWord && g.accepted);
  if (duplicate) return { ok: false, rank: null, error: `"${cleanWord}" was already claimed by another player!` };

  // Rank = number of previously accepted guesses + 1
  const acceptedCount = round.guesses.filter((g) => g.accepted).length;
  const rank = acceptedCount + 1;

  // Points: 1st = 3pts, 2nd = 2pts, 3rd+ = 1pt
  const points = rank === 1 ? 3 : rank === 2 ? 2 : 1;

  const newGuess = {
    profileId,
    displayName,
    word: cleanWord,
    accepted: true,
    rank,
    submittedAt: new Date().toISOString(),
  };

  const updatedRound: LetterBlitzRound = {
    ...round,
    guesses: [...round.guesses, newGuess],
  };

  const updatedScores = { ...data.scores, [profileId]: (data.scores[profileId] ?? 0) + points };

  await saveLetterBlitzData(game.id, {
    currentRound: updatedRound,
    scores: updatedScores,
  });

  return { ok: true, rank };
}

export async function advanceLetterBlitzRound(game: AnyGame): Promise<void> {
  const data = parseLetterBlitzData(game);
  const nextRoundNum = data.roundNumber + 1;

  if (nextRoundNum > data.settings.rounds) {
    // Game over
    await saveLetterBlitzData(game.id, { phase: "game_over" });
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
  });
}

export async function tickLetterBlitz(game: AnyGame): Promise<void> {
  const data = parseLetterBlitzData(game);
  const now = Date.now();

  if (data.phase === "countdown" && data.countdownEndsAt) {
    if (now >= new Date(data.countdownEndsAt).getTime()) {
      await saveLetterBlitzData(game.id, { phase: "round_active" });
    }
  } else if (data.phase === "round_active" && data.roundEndsAt) {
    if (now >= new Date(data.roundEndsAt).getTime()) {
      await saveLetterBlitzData(game.id, { phase: "round_end" });
    }
  }
}
