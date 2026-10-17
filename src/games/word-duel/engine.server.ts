import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateWordDuelAttempt } from "./dictionary.server";
import type {
  WordDuelClientState,
  WordDuelRoundHistory,
  WordDuelServerData,
  WordDuelSettings,
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

export const DEFAULT_WORD_DUEL_SETTINGS: WordDuelSettings = {
  rounds: 3,
  roundTime: 30,
};

export function getDefaultServerData(
  customSettings?: Partial<WordDuelSettings>,
): WordDuelServerData {
  const settings: WordDuelSettings = {
    rounds:
      customSettings?.rounds === 5 || customSettings?.rounds === 7 ? customSettings.rounds : 3,
    roundTime:
      customSettings?.roundTime === 20 || customSettings?.roundTime === 45
        ? customSettings.roundTime
        : 30,
  };

  return {
    settings,
    phase: "pick",
    currentRound: 1,
    scores: {},
    picks: {},
    revealedLetters: null,
    letterOwners: {},
    countdownEndsAt: null,
    roundDeadline: null,
    roundWinnerId: null,
    winningWord: null,
    history: [],
    matchWinnerId: null,
  };
}

export function parseWordDuelData(game: AnyGame): WordDuelServerData {
  const raw = game.game_settings?.["wordDuel"] as Partial<WordDuelServerData> | undefined;
  if (!raw) return getDefaultServerData();

  return {
    settings: {
      rounds: raw.settings?.rounds === 5 || raw.settings?.rounds === 7 ? raw.settings.rounds : 3,
      roundTime:
        raw.settings?.roundTime === 20 || raw.settings?.roundTime === 45
          ? raw.settings.roundTime
          : 30,
    },
    phase: raw.phase ?? "pick",
    currentRound: raw.currentRound ?? 1,
    scores: raw.scores ?? {},
    picks: raw.picks ?? {},
    revealedLetters: raw.revealedLetters ?? null,
    letterOwners: raw.letterOwners ?? {},
    countdownEndsAt: raw.countdownEndsAt ?? null,
    roundDeadline: raw.roundDeadline ?? null,
    roundWinnerId: raw.roundWinnerId ?? null,
    winningWord: raw.winningWord ?? null,
    history: raw.history ?? [],
    matchWinnerId: raw.matchWinnerId ?? null,
  };
}

export async function saveWordDuelData(gameId: string, data: WordDuelServerData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentGame } = await (supabaseAdmin.from("games") as any)
    .select("game_settings")
    .eq("id", gameId)
    .single();

  const currentSettings = (currentGame?.["game_settings"] as Record<string, unknown>) || {};
  const updatedSettings = {
    ...currentSettings,
    wordDuel: data,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({ game_settings: updatedSettings })
    .eq("id", gameId);
}

/**
 * Initializes and starts a Word Duel match for 2 players
 */
export async function startWordDuelMatch(game: AnyGame, players: AnyPlayer[]) {
  const currentSettings = game.game_settings?.["wordDuel"] as
    { settings?: Partial<WordDuelSettings> } | undefined;
  const data = getDefaultServerData(currentSettings?.settings);

  // Initialize scores for both players
  for (const p of players) {
    data.scores[p.profile_id] = 0;
  }

  // Update game status to "hint" (active playing state recognized across the system)
  // and store initialized WordDuel match data
  const updatedSettings = {
    ...(game.game_settings || {}),
    wordDuel: data,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({
      status: "hint",
      game_settings: updatedSettings,
    })
    .eq("id", game.id);
}

/**
 * Player secretly sends ONE letter (A-Z) during pick phase
 */
export async function sendWordDuelLetter(
  game: AnyGame,
  players: AnyPlayer[],
  profileId: string,
  rawLetter: string,
) {
  const data = parseWordDuelData(game);
  if (data.phase !== "pick") {
    throw new Error("Cannot pick a letter right now.");
  }

  const letter = rawLetter.trim().toUpperCase();
  if (!/^[A-Z]$/.test(letter)) {
    throw new Error("Must be a single letter from A to Z.");
  }

  // Once sent, cannot be changed
  if (data.picks[profileId]) {
    throw new Error("You already locked in your letter.");
  }

  data.picks[profileId] = letter;

  // Check if both players have sent their letters
  const activePlayers = players.slice(0, 2);
  const allPicked =
    activePlayers.length === 2 && activePlayers.every((p) => Boolean(data.picks[p.profile_id]));

  if (allPicked) {
    const p1 = activePlayers[0];
    const p2 = activePlayers[1];
    if (p1 && p2) {
      const letter1 = data.picks[p1.profile_id] ?? "A";
      const letter2 = data.picks[p2.profile_id] ?? "T";

      data.revealedLetters = [letter1, letter2];
      data.letterOwners = {
        [letter1]: p1.profile_id,
        [letter2]: p2.profile_id,
      };
      data.phase = "countdown";
      data.countdownEndsAt = Date.now() + 3500; // 3-second countdown buffer
    }
  }

  await saveWordDuelData(game.id, data);
  return data;
}

/**
 * Validates and records word submission during word phase
 */
export async function submitWordDuelWord(
  game: AnyGame,
  profileId: string,
  rawWord: string,
): Promise<{ ok: boolean; reason?: string; winningWord?: string }> {
  const data = parseWordDuelData(game);

  // Synchronize state if needed
  if (data.phase === "countdown" && data.countdownEndsAt && Date.now() >= data.countdownEndsAt) {
    data.phase = "word";
    data.roundDeadline = Date.now() + data.settings.roundTime * 1000;
  }

  if (data.phase !== "word") {
    return { ok: false, reason: "The round is not in the word phase." };
  }

  if (data.roundWinnerId) {
    return { ok: false, reason: "Too late! Round has already been claimed." };
  }

  if (data.roundDeadline && Date.now() > data.roundDeadline) {
    data.phase = "round_ended";
    data.roundWinnerId = "draw";
    data.winningWord = null;
    await saveWordDuelData(game.id, data);
    return { ok: false, reason: "Time expired! Round ended in a draw." };
  }

  if (!data.revealedLetters || data.revealedLetters.length < 2) {
    return { ok: false, reason: "Letters are not revealed yet." };
  }

  const validation = validateWordDuelAttempt(
    rawWord,
    data.revealedLetters[0],
    data.revealedLetters[1],
  );

  if (!validation.valid) {
    return { ok: false, reason: validation.reason ?? "Invalid word" };
  }

  const winningWord = validation.normalizedWord!;
  data.roundWinnerId = profileId;
  data.winningWord = winningWord;
  data.scores[profileId] = (data.scores[profileId] || 0) + 1;

  const roundHistory: WordDuelRoundHistory = {
    round: data.currentRound,
    letters: data.revealedLetters,
    winnerId: profileId,
    winningWord,
    scores: { ...data.scores },
  };
  data.history.push(roundHistory);

  const targetWins = Math.ceil(data.settings.rounds / 2);
  if (data.scores[profileId] >= targetWins) {
    data.phase = "match_ended";
    data.matchWinnerId = profileId;
  } else {
    data.phase = "round_ended";
  }

  await saveWordDuelData(game.id, data);
  return { ok: true, winningWord };
}

/**
 * Advances to the next round of Word Duel
 */
export async function advanceWordDuelRound(game: AnyGame) {
  const data = parseWordDuelData(game);
  if (data.phase !== "round_ended") return data;

  data.currentRound += 1;
  data.phase = "pick";
  data.picks = {};
  data.revealedLetters = null;
  data.letterOwners = {};
  data.countdownEndsAt = null;
  data.roundDeadline = null;
  data.roundWinnerId = null;
  data.winningWord = null;

  await saveWordDuelData(game.id, data);
  return data;
}

/**
 * Resets match for a Rematch
 */
export async function rematchWordDuel(game: AnyGame, players: AnyPlayer[]) {
  const currentSettings = game.game_settings?.["wordDuel"] as
    { settings?: Partial<WordDuelSettings> } | undefined;
  const data = getDefaultServerData(currentSettings?.settings);

  for (const p of players) {
    data.scores[p.profile_id] = 0;
  }

  await saveWordDuelData(game.id, data);
  return data;
}

/**
 * Synchronizes server state and builds sanitized client state
 */
export async function syncWordDuelState(
  game: AnyGame,
  players: AnyPlayer[],
  myProfileId: string,
): Promise<WordDuelClientState> {
  const data = parseWordDuelData(game);
  let changed = false;

  // Check countdown completion
  if (data.phase === "countdown" && data.countdownEndsAt && Date.now() >= data.countdownEndsAt) {
    data.phase = "word";
    data.roundDeadline = Date.now() + data.settings.roundTime * 1000;
    changed = true;
  }

  // Check timer expiry during word phase
  if (data.phase === "word" && data.roundDeadline && Date.now() >= data.roundDeadline) {
    data.phase = "round_ended";
    data.roundWinnerId = "draw";
    data.winningWord = null;
    data.history.push({
      round: data.currentRound,
      letters: data.revealedLetters ?? ["?", "?"],
      winnerId: null,
      winningWord: null,
      scores: { ...data.scores },
    });
    changed = true;
  }

  if (changed) {
    await saveWordDuelData(game.id, data);
  }

  const activePlayers = players.slice(0, 2);
  const opponent = activePlayers.find((p) => p.profile_id !== myProfileId);
  const myPick = data.picks[myProfileId] ?? null;
  const opponentLocked = Boolean(opponent && data.picks[opponent.profile_id]);
  const targetWins = Math.ceil(data.settings.rounds / 2);

  return {
    settings: data.settings,
    phase: data.phase,
    currentRound: data.currentRound,
    maxRounds: data.settings.rounds,
    targetWins,
    roundTime: data.settings.roundTime,
    scores: data.scores,
    myPick,
    hasPicked: Boolean(myPick),
    opponentLocked,
    revealedLetters: data.phase === "pick" ? null : data.revealedLetters,
    letterOwners: data.phase === "pick" ? {} : data.letterOwners,
    countdownEndsAt: data.countdownEndsAt,
    roundDeadline: data.roundDeadline,
    roundWinnerId: data.roundWinnerId,
    winningWord: data.winningWord,
    history: data.history,
    matchWinnerId: data.matchWinnerId,
  };
}
