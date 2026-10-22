import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DRAW_WORDS,
  DEFAULT_DOODLE_RUSH_SETTINGS,
  type DoodleRushServerData,
  type DoodleRushClientState,
  type DoodleRushSettings,
  type DoodleRushRound,
  type DrawStroke,
  type DoodleRushGuess,
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
function fail(msg: string): never {
  throw new Error(msg);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function pickWord(usedWords: string[]): string {
  const available = DRAW_WORDS.filter((w) => !usedWords.includes(w));
  const pool = available.length > 0 ? available : DRAW_WORDS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

// ── parse/save ────────────────────────────────────────────────────────────────
export function parseDoodleRushData(game: AnyGame): DoodleRushServerData {
  const raw = game.game_settings ?? {};
  return {
    settings: (raw.doodleRushSettings as DoodleRushSettings) ?? DEFAULT_DOODLE_RUSH_SETTINGS,
    phase: (raw.doodleRushPhase as DoodleRushServerData["phase"]) ?? "lobby",
    currentRound: (raw.doodleRushRound as DoodleRushRound) ?? null,
    scores: (raw.doodleRushScores as Record<string, number>) ?? {},
    roundNumber: (raw.doodleRushRoundNumber as number) ?? 0,
    drawerOrder: (raw.doodleRushDrawerOrder as string[]) ?? [],
    drawerIndex: (raw.doodleRushDrawerIndex as number) ?? 0,
    usedWords: (raw.doodleRushUsedWords as string[]) ?? [],
    countdownEndsAt: (raw.doodleRushCountdownEndsAt as string) ?? null,
  };
}

async function saveDoodleRushData(gameId: string, data: Partial<DoodleRushServerData>) {
  const { data: current } = await supabaseAdmin
    .from("games")
    .select("game_settings")
    .eq("id", gameId)
    .single();

  const keys: Record<string, unknown> = {};
  if (data.settings !== undefined) keys.doodleRushSettings = data.settings;
  if (data.phase !== undefined) keys.doodleRushPhase = data.phase;
  if (data.currentRound !== undefined) keys.doodleRushRound = data.currentRound;
  if (data.scores !== undefined) keys.doodleRushScores = data.scores;
  if (data.roundNumber !== undefined) keys.doodleRushRoundNumber = data.roundNumber;
  if (data.drawerOrder !== undefined) keys.doodleRushDrawerOrder = data.drawerOrder;
  if (data.drawerIndex !== undefined) keys.doodleRushDrawerIndex = data.drawerIndex;
  if (data.usedWords !== undefined) keys.doodleRushUsedWords = data.usedWords;
  if (data.countdownEndsAt !== undefined) keys.doodleRushCountdownEndsAt = data.countdownEndsAt;

  const merged = { ...(current?.game_settings ?? {}), ...keys };
  const { error } = await supabaseAdmin
    .from("games")
    .update({ game_settings: merged })
    .eq("id", gameId);
  if (error) throw new Error(error.message);
}

// ── client state (hides secret word from non-drawers) ─────────────────────────
export function buildDoodleRushClientState(
  data: DoodleRushServerData,
  callerProfileId: string,
): DoodleRushClientState {
  const isDrawer = data.currentRound?.drawerId === callerProfileId;
  let round: DoodleRushClientState["currentRound"] = null;
  if (data.currentRound) {
    round = {
      ...data.currentRound,
      // Only drawer sees the word while round is active; everyone sees revealedWord after
      word:
        data.phase === "drawing" && !isDrawer
          ? null
          : data.currentRound.word,
    };
  }
  return {
    phase: data.phase,
    settings: data.settings,
    currentRound: round,
    scores: data.scores,
    roundNumber: data.roundNumber,
    totalRounds: data.settings.rounds * data.drawerOrder.length,
    countdownEndsAt: data.countdownEndsAt,
    isDrawer,
  };
}

// ── actions ───────────────────────────────────────────────────────────────────
export async function startDoodleRushMatch(
  game: AnyGame,
  players: AnyPlayer[],
): Promise<void> {
  if (players.length < 2) fail("Doodle Rush requires at least 2 players.");

  const raw = game.game_settings ?? {};
  const settings: DoodleRushSettings = {
    rounds: Number(raw.doodleRushRounds ?? DEFAULT_DOODLE_RUSH_SETTINGS.rounds),
    drawTime: Number(raw.doodleRushDrawTime ?? DEFAULT_DOODLE_RUSH_SETTINGS.drawTime),
  };

  const initScores: Record<string, number> = {};
  for (const p of players) initScores[p.profile_id] = 0;

  const drawerOrder = shuffle(players.map((p) => p.profile_id));
  const firstDrawer = players.find((p) => p.profile_id === drawerOrder[0]!);
  const word = pickWord([]);
  const countdownEndsAt = new Date(Date.now() + 3000).toISOString();

  const round: DoodleRushRound = {
    roundNumber: 1,
    drawerId: drawerOrder[0]!,
    drawerName: firstDrawer?.profiles?.display_name ?? "Unknown",
    word,
    revealedWord: null,
    strokes: [],
    guesses: [],
    winnerIds: [],
    endsAt: new Date(Date.now() + 3000 + settings.drawTime * 1000).toISOString(),
    ended: false,
  };

  await saveDoodleRushData(game.id, {
    settings,
    phase: "countdown",
    currentRound: round,
    scores: initScores,
    roundNumber: 1,
    drawerOrder,
    drawerIndex: 0,
    usedWords: [word],
    countdownEndsAt,
  });

  await supabaseAdmin.from("games").update({ status: "playing" }).eq("id", game.id);
}

export async function submitDoodleStroke(
  game: AnyGame,
  profileId: string,
  stroke: DrawStroke,
): Promise<void> {
  const data = parseDoodleRushData(game);
  if (data.phase !== "drawing") return;
  if (data.currentRound?.drawerId !== profileId) return;

  const updatedStrokes = [...(data.currentRound?.strokes ?? []), stroke];
  const updatedRound: DoodleRushRound = {
    ...data.currentRound!,
    strokes: updatedStrokes,
  };
  await saveDoodleRushData(game.id, { currentRound: updatedRound });
}

export async function clearDoodleCanvas(game: AnyGame, profileId: string): Promise<void> {
  const data = parseDoodleRushData(game);
  if (data.phase !== "drawing") return;
  if (data.currentRound?.drawerId !== profileId) return;

  const updatedRound: DoodleRushRound = {
    ...data.currentRound!,
    strokes: [],
  };
  await saveDoodleRushData(game.id, { currentRound: updatedRound });
}

export async function submitDoodleGuess(
  game: AnyGame,
  profileId: string,
  displayName: string,
  guessText: string,
): Promise<{ ok: boolean; correct: boolean; error?: string }> {
  const data = parseDoodleRushData(game);
  if (data.phase !== "drawing") return { ok: false, correct: false, error: "Game not active." };

  const round = data.currentRound;
  if (!round) return { ok: false, correct: false, error: "No active round." };
  if (round.drawerId === profileId) return { ok: false, correct: false, error: "You're drawing!" };

  const alreadyCorrect = round.winnerIds.includes(profileId);
  if (alreadyCorrect) return { ok: false, correct: false, error: "You already guessed correctly!" };

  const correct = guessText.trim().toLowerCase() === (round.word ?? "").toLowerCase();
  const newGuess: DoodleRushGuess = {
    profileId,
    displayName,
    guess: guessText.trim(),
    correct,
    submittedAt: new Date().toISOString(),
  };

  const updatedGuesses = [...round.guesses, newGuess];
  let updatedWinners = [...round.winnerIds];
  let updatedScores = { ...data.scores };

  if (correct) {
    updatedWinners.push(profileId);
    // Points: 1st correct = 4pts, subsequent = 2pts. Drawer gets 1pt per correct guesser.
    const pts = updatedWinners.length === 1 ? 4 : 2;
    updatedScores[profileId] = (updatedScores[profileId] ?? 0) + pts;
    updatedScores[round.drawerId] = (updatedScores[round.drawerId] ?? 0) + 1;
  }

  const totalGuessers = Object.keys(data.scores).length - 1; // exclude drawer
  const allGuessed = updatedWinners.length >= totalGuessers;

  const updatedRound: DoodleRushRound = {
    ...round,
    guesses: updatedGuesses,
    winnerIds: updatedWinners,
    ended: allGuessed,
    revealedWord: allGuessed ? round.word : null,
  };

  await saveDoodleRushData(game.id, {
    currentRound: updatedRound,
    scores: updatedScores,
    ...(allGuessed ? { phase: "round_end" } : {}),
  });

  return { ok: true, correct };
}

export async function advanceDoodleRound(game: AnyGame): Promise<void> {
  const data = parseDoodleRushData(game);
  const nextIndex = data.drawerIndex + 1;
  const totalTurns = data.settings.rounds * data.drawerOrder.length;
  const nextRoundNum = data.roundNumber + 1;

  if (nextRoundNum > totalTurns) {
    // Reveal final word then game over
    const updatedRound: DoodleRushRound = {
      ...data.currentRound!,
      revealedWord: data.currentRound?.word ?? null,
    };
    await saveDoodleRushData(game.id, {
      phase: "game_over",
      currentRound: updatedRound,
    });
    await supabaseAdmin.from("games").update({ status: "ended" }).eq("id", game.id);
    return;
  }

  const drawerIndex = nextIndex % data.drawerOrder.length;
  const drawerId = data.drawerOrder[drawerIndex]!;

  const word = pickWord(data.usedWords);

  // Find drawer name from game — we pass all players in game_settings context
  const round: DoodleRushRound = {
    roundNumber: nextRoundNum,
    drawerId,
    drawerName: `Player ${drawerIndex + 1}`,
    word,
    revealedWord: null,
    strokes: [],
    guesses: [],
    winnerIds: [],
    endsAt: new Date(Date.now() + data.settings.drawTime * 1000).toISOString(),
    ended: false,
  };

  await saveDoodleRushData(game.id, {
    phase: "drawing",
    currentRound: round,
    roundNumber: nextRoundNum,
    drawerIndex,
    usedWords: [...data.usedWords, word],
  });
}

export async function tickDoodleRush(game: AnyGame): Promise<void> {
  const data = parseDoodleRushData(game);
  const now = Date.now();

  if (data.phase === "countdown" && data.countdownEndsAt) {
    if (now >= new Date(data.countdownEndsAt).getTime()) {
      await saveDoodleRushData(game.id, { phase: "drawing" });
    }
  } else if (data.phase === "drawing" && data.currentRound?.endsAt) {
    if (now >= new Date(data.currentRound.endsAt).getTime()) {
      const revealedRound: DoodleRushRound = {
        ...data.currentRound,
        ended: true,
        revealedWord: data.currentRound.word,
      };
      await saveDoodleRushData(game.id, {
        phase: "round_end",
        currentRound: revealedRound,
      });
    }
  }
}
