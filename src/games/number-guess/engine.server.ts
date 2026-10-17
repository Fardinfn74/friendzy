import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  NumberGuessClientState,
  NumberGuessRange,
  NumberGuessRoundHistory,
  NumberGuessRoundsOption,
  NumberGuessServerData,
  NumberGuessSettings,
} from "./types";

type AnyPlayer = {
  id: string;
  profile_id: string;
  is_host: boolean;
  profiles: { display_name: string; avatar_id: string } | null;
};

type AnyGame = {
  id: string;
  code: string;
  host_id: string;
  status: string;
  game_type?: string | null;
  game_settings?: Record<string, unknown> | null;
};

export const DEFAULT_NUMBER_GUESS_SETTINGS: NumberGuessSettings = {
  range: "1-100",
  hints: true,
  rounds: 3,
};

/** Cooldown between guess attempts in ms */
const GUESS_COOLDOWN_MS = 1500;

function rangeMax(range: NumberGuessRange): number {
  if (range === "1-50") return 50;
  if (range === "1-500") return 500;
  return 100;
}

export function getDefaultServerData(
  customSettings?: Partial<NumberGuessSettings>,
): NumberGuessServerData {
  const range: NumberGuessRange =
    customSettings?.range === "1-50" || customSettings?.range === "1-500"
      ? customSettings.range
      : "1-100";
  const rounds: NumberGuessRoundsOption = customSettings?.rounds === 5 ? 5 : 3;
  const hints: boolean = customSettings?.hints !== false;

  return {
    settings: { range, hints, rounds },
    phase: "pick",
    currentRound: 1,
    secrets: {},
    locked: {},
    countdownEndsAt: null,
    guessHistory: {},
    roundWonAt: null,
    roundWinnerId: null,
    scores: {},
    history: [],
    matchWinnerId: null,
  };
}

export function parseNumberGuessData(game: AnyGame): NumberGuessServerData {
  const raw = game.game_settings?.["numberGuess"] as Partial<NumberGuessServerData> | undefined;
  if (!raw) return getDefaultServerData();

  const range: NumberGuessRange =
    raw.settings?.range === "1-50" || raw.settings?.range === "1-500"
      ? raw.settings.range
      : "1-100";
  const rounds: NumberGuessRoundsOption = raw.settings?.rounds === 5 ? 5 : 3;
  const hints: boolean = raw.settings?.hints !== false;

  return {
    settings: { range, hints, rounds },
    phase: raw.phase ?? "pick",
    currentRound: raw.currentRound ?? 1,
    secrets: raw.secrets ?? {},
    locked: raw.locked ?? {},
    countdownEndsAt: raw.countdownEndsAt ?? null,
    guessHistory: raw.guessHistory ?? {},
    roundWonAt: raw.roundWonAt ?? null,
    roundWinnerId: raw.roundWinnerId ?? null,
    scores: raw.scores ?? {},
    history: raw.history ?? [],
    matchWinnerId: raw.matchWinnerId ?? null,
  };
}

export async function saveNumberGuessData(gameId: string, data: NumberGuessServerData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentGame } = await (supabaseAdmin.from("games") as any)
    .select("game_settings")
    .eq("id", gameId)
    .single();

  const currentSettings = (currentGame?.["game_settings"] as Record<string, unknown>) || {};
  const updatedSettings = {
    ...currentSettings,
    numberGuess: data,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({ game_settings: updatedSettings })
    .eq("id", gameId);
}

/**
 * Starts a Number Guess match.
 */
export async function startNumberGuessMatch(game: AnyGame, players: AnyPlayer[]) {
  const currentSettings = game.game_settings?.["numberGuess"] as
    { settings?: Partial<NumberGuessSettings> } | undefined;
  const data = getDefaultServerData(currentSettings?.settings);

  for (const p of players) {
    data.scores[p.profile_id] = 0;
    data.guessHistory[p.profile_id] = {};
  }

  const updatedSettings = {
    ...(game.game_settings || {}),
    numberGuess: data,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({
      status: "hint", // active playing state
      game_settings: updatedSettings,
    })
    .eq("id", game.id);
}

/**
 * Player secretly locks in their number.
 */
export async function lockNumberGuessSecret(
  game: AnyGame,
  players: AnyPlayer[],
  profileId: string,
  rawNumber: number,
) {
  const data = parseNumberGuessData(game);
  if (data.phase !== "pick") {
    throw new Error("Secret pick phase is over.");
  }
  if (data.locked[profileId]) {
    throw new Error("You already locked in your number.");
  }

  const max = rangeMax(data.settings.range);
  const n = Math.round(rawNumber);
  if (!Number.isFinite(n) || n < 1 || n > max) {
    throw new Error(`Number must be between 1 and ${max}.`);
  }

  data.secrets[profileId] = n;
  data.locked[profileId] = true;

  // Initialize guess history for this player
  if (!data.guessHistory[profileId]) {
    data.guessHistory[profileId] = {};
  }

  const activePlayers = players.filter((p) => !("left_game" in p));
  const allLocked =
    activePlayers.length >= 2 && activePlayers.every((p) => Boolean(data.locked[p.profile_id]));

  if (allLocked) {
    data.phase = "countdown";
    data.countdownEndsAt = Date.now() + 3500;
  }

  await saveNumberGuessData(game.id, data);
  return data;
}

/**
 * Real-time guess: guesser picks a target and submits a number.
 * Returns whether correct, and a private hint if hints are on.
 */
export async function submitNumberGuess(
  game: AnyGame,
  profileId: string,
  targetId: string,
  rawGuess: number,
): Promise<{
  ok: boolean;
  correct?: boolean;
  hint?: "higher" | "lower" | null;
  reason?: string;
}> {
  const data = parseNumberGuessData(game);

  // Transition countdown -> guess if needed
  if (data.phase === "countdown" && data.countdownEndsAt && Date.now() >= data.countdownEndsAt) {
    data.phase = "guess";
  }

  if (data.phase !== "guess") {
    return { ok: false, reason: "Guessing is not open yet." };
  }

  if (data.roundWinnerId) {
    return { ok: false, reason: "Round already ended." };
  }

  if (profileId === targetId) {
    return { ok: false, reason: "You can't guess your own number." };
  }

  if (!data.locked[targetId]) {
    return { ok: false, reason: "That player hasn't locked in yet." };
  }

  const max = rangeMax(data.settings.range);
  const guess = Math.round(rawGuess);
  if (!Number.isFinite(guess) || guess < 1 || guess > max) {
    return { ok: false, reason: `Guess must be between 1 and ${max}.` };
  }

  // Enforce cooldown: check last guess this guesser made against this target
  if (!data.guessHistory[profileId]) {
    data.guessHistory[profileId] = {};
  }
  const myGuessesAgainstTarget = data.guessHistory[profileId]![targetId] ?? [];

  // Store guess timestamps separately for cooldown (we only store the number list for history)
  // We use a trick: attach timestamps on a parallel key in guessHistory
  const cooldownKey = `${profileId}__cd__${targetId}`;
  if (!data.guessHistory[cooldownKey]) {
    data.guessHistory[cooldownKey] = {};
  }
  const lastTsArr = data.guessHistory[cooldownKey]!["ts"] ?? [];
  const lastTs = lastTsArr[lastTsArr.length - 1];
  if (lastTs && Date.now() - lastTs < GUESS_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "Wait a moment before guessing again.",
    };
  }

  // Record timestamp
  data.guessHistory[cooldownKey]!["ts"] = [...lastTsArr, Date.now()];

  const secret = data.secrets[targetId];
  if (secret === undefined) {
    return { ok: false, reason: "Target has no secret number." };
  }

  const correct = guess === secret;

  // Record the guess in history
  data.guessHistory[profileId]![targetId] = [...myGuessesAgainstTarget, guess];

  if (correct) {
    data.roundWinnerId = profileId;
    data.roundWonAt = Date.now();
    data.scores[profileId] = (data.scores[profileId] ?? 0) + 1;

    const roundHistory: NumberGuessRoundHistory = {
      round: data.currentRound,
      range: data.settings.range,
      secrets: { ...data.secrets },
      winnerId: profileId,
      scores: { ...data.scores },
    };
    data.history.push(roundHistory);

    const targetWins = Math.ceil(data.settings.rounds / 2);
    if ((data.scores[profileId] ?? 0) >= targetWins) {
      data.phase = "match_ended";
      data.matchWinnerId = profileId;
    } else {
      data.phase = "round_ended";
    }

    await saveNumberGuessData(game.id, data);
    return { ok: true, correct: true, hint: null };
  }

  // Not correct
  let hint: "higher" | "lower" | null = null;
  if (data.settings.hints) {
    hint = guess < secret ? "higher" : "lower";
  }

  await saveNumberGuessData(game.id, data);
  return { ok: true, correct: false, hint };
}

/**
 * Advances to the next round.
 */
export async function advanceNumberGuessRound(game: AnyGame) {
  const data = parseNumberGuessData(game);
  if (data.phase !== "round_ended") return data;

  data.currentRound += 1;
  data.phase = "pick";
  data.secrets = {};
  data.locked = {};
  data.countdownEndsAt = null;
  data.guessHistory = {};
  data.roundWinnerId = null;
  data.roundWonAt = null;

  await saveNumberGuessData(game.id, data);
  return data;
}

/**
 * Resets the match for a rematch.
 */
export async function rematchNumberGuess(game: AnyGame, players: AnyPlayer[]) {
  const currentSettings = game.game_settings?.["numberGuess"] as
    { settings?: Partial<NumberGuessSettings> } | undefined;
  const data = getDefaultServerData(currentSettings?.settings);

  for (const p of players) {
    data.scores[p.profile_id] = 0;
    data.guessHistory[p.profile_id] = {};
  }

  await saveNumberGuessData(game.id, data);
  return data;
}

/**
 * Builds a sanitized client state: secrets are NEVER sent during guess phase.
 */
export async function syncNumberGuessState(
  game: AnyGame,
  players: AnyPlayer[],
  myProfileId: string,
): Promise<NumberGuessClientState> {
  const data = parseNumberGuessData(game);
  let changed = false;

  // Transition countdown -> guess if deadline passed
  if (data.phase === "countdown" && data.countdownEndsAt && Date.now() >= data.countdownEndsAt) {
    data.phase = "guess";
    changed = true;
  }

  if (changed) {
    await saveNumberGuessData(game.id, data);
  }

  const targetWins = Math.ceil(data.settings.rounds / 2);

  // Build my guess history (numbers only) from guessHistory
  const myGuesses: Record<string, number[]> = {};
  const myHints: Record<string, "higher" | "lower" | null> = {};
  for (const p of players) {
    const targetId = p.profile_id;
    if (targetId === myProfileId) continue;
    const guessesAgainst = data.guessHistory[myProfileId]?.[targetId] ?? [];
    myGuesses[targetId] = guessesAgainst;

    // Derive hint from last guess vs secret (only if round is still active and hints on)
    if (data.settings.hints && guessesAgainst.length > 0 && data.phase === "guess") {
      const lastGuess = guessesAgainst[guessesAgainst.length - 1]!;
      const secret = data.secrets[targetId];
      if (secret !== undefined) {
        myHints[targetId] = lastGuess < secret ? "higher" : "lower";
      } else {
        myHints[targetId] = null;
      }
    } else {
      myHints[targetId] = null;
    }
  }

  // Only reveal secrets after the round has ended
  const revealedSecrets =
    data.phase === "round_ended" || data.phase === "match_ended" ? { ...data.secrets } : null;

  return {
    settings: data.settings,
    phase: data.phase,
    currentRound: data.currentRound,
    maxRounds: data.settings.rounds,
    targetWins,
    locked: { ...data.locked },
    countdownEndsAt: data.countdownEndsAt,
    myGuesses,
    myHints,
    scores: { ...data.scores },
    roundWinnerId: data.roundWinnerId,
    revealedSecrets,
    history: data.history,
    matchWinnerId: data.matchWinnerId,
  };
}
