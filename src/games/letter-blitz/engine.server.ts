import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  LETTERS,
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
  const allPairs: Array<[string, string]> = [];
  for (let i = 0; i < LETTERS.length; i++) {
    for (let j = i + 1; j < LETTERS.length; j++) {
      allPairs.push([LETTERS[i]!, LETTERS[j]!]);
    }
  }
  const available = allPairs.filter(
    (p) => !usedPairs.some((u) => u[0] === p[0] && u[1] === p[1]),
  );
  const pool = available.length > 0 ? available : allPairs;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function fail(msg: string): never {
  throw new Error(msg);
}

// ── parse/save ────────────────────────────────────────────────────────────────
export function parseLetterBlitzData(game: AnyGame): LetterBlitzServerData {
  const raw = game.game_settings ?? {};
  return {
    settings: (raw.letterBlitzSettings as LetterBlitzSettings) ?? DEFAULT_LETTER_BLITZ_SETTINGS,
    phase: (raw.letterBlitzPhase as LetterBlitzServerData["phase"]) ?? "lobby",
    currentRound: (raw.letterBlitzRound as LetterBlitzRound) ?? null,
    scores: (raw.letterBlitzScores as Record<string, number>) ?? {},
    roundNumber: (raw.letterBlitzRoundNumber as number) ?? 0,
    usedLetterPairs: (raw.letterBlitzUsedPairs as Array<[string, string]>) ?? [],
    roundEndsAt: (raw.letterBlitzRoundEndsAt as string) ?? null,
    countdownEndsAt: (raw.letterBlitzCountdownEndsAt as string) ?? null,
  };
}

async function saveLetterBlitzData(gameId: string, data: Partial<LetterBlitzServerData>) {
  const { error } = await supabaseAdmin
    .from("games")
    .update({
      game_settings: supabaseAdmin.rpc as unknown as Record<string, unknown>,
    })
    .eq("id", gameId);

  // Use a proper merge approach via raw update with jsonb merge
  const keys: Record<string, unknown> = {};
  if (data.settings !== undefined) keys.letterBlitzSettings = data.settings;
  if (data.phase !== undefined) keys.letterBlitzPhase = data.phase;
  if (data.currentRound !== undefined) keys.letterBlitzRound = data.currentRound;
  if (data.scores !== undefined) keys.letterBlitzScores = data.scores;
  if (data.roundNumber !== undefined) keys.letterBlitzRoundNumber = data.roundNumber;
  if (data.usedLetterPairs !== undefined) keys.letterBlitzUsedPairs = data.usedLetterPairs;
  if (data.roundEndsAt !== undefined) keys.letterBlitzRoundEndsAt = data.roundEndsAt;
  if (data.countdownEndsAt !== undefined) keys.letterBlitzCountdownEndsAt = data.countdownEndsAt;

  // Fetch current settings and merge
  const { data: current } = await supabaseAdmin
    .from("games")
    .select("game_settings")
    .eq("id", gameId)
    .single();

  const merged = { ...(current?.game_settings ?? {}), ...keys };
  const { error: err2 } = await supabaseAdmin
    .from("games")
    .update({ game_settings: merged })
    .eq("id", gameId);

  if (err2) throw new Error(err2.message);
  void error; // suppress unused
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

  const raw = game.game_settings ?? {};
  const settings: LetterBlitzSettings = {
    rounds: Number(raw.letterBlitzRounds ?? DEFAULT_LETTER_BLITZ_SETTINGS.rounds),
    roundTime: Number(raw.letterBlitzRoundTime ?? DEFAULT_LETTER_BLITZ_SETTINGS.roundTime),
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

  // Validate word contains both letters
  const w = word.trim().toUpperCase();
  const [l1, l2] = round.letters;
  if (!w || w.length < 2) return { ok: false, rank: null, error: "Word too short." };
  if (!w.includes(l1!) || !w.includes(l2!))
    return { ok: false, rank: null, error: `Word must contain both letters: ${l1} and ${l2}` };

  // Check not already guessed by this player
  const alreadyGuessed = round.guesses.find((g) => g.profileId === profileId && g.accepted);
  if (alreadyGuessed) return { ok: false, rank: null, error: "You already submitted a valid word." };

  // Check for duplicate word
  const duplicate = round.guesses.find((g) => g.word.toUpperCase() === w && g.accepted);
  if (duplicate) return { ok: false, rank: null, error: "That word was already used!" };

  // Rank = number of previously accepted guesses + 1
  const acceptedCount = round.guesses.filter((g) => g.accepted).length;
  const rank = acceptedCount + 1;

  // Points: 1st = 3pts, 2nd = 2pts, 3rd+ = 1pt
  const points = rank === 1 ? 3 : rank === 2 ? 2 : 1;

  const newGuess = {
    profileId,
    displayName,
    word: word.trim(),
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
