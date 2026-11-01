import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  DEFAULT_DOODLE_RUSH_SETTINGS,
  type DoodleRushClientState,
  type DoodleRushGuess,
  type DoodleRushRound,
  type DoodleRushServerData,
  type DoodleRushSettings,
  type DrawStroke,
} from "./types";
import { pickDrawWord } from "./words.server";

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

const COUNTDOWN_MS = 3000;
/** How long the round summary stays up before the next drawing starts by itself. */
export const DOODLE_BETWEEN_ROUNDS_MS = 6000;
const SAFE_DB_ERROR = "Something went wrong on our side. Please try again.";

// Limits on what a drawing may contain, so nobody can fill the database with one huge request.
const MAX_STROKES = 400;
const MAX_POINTS_PER_STROKE = 1500;
const MAX_TOTAL_POINTS = 20000;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function fail(msg: string): never {
  throw new Error(msg);
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const maskFor = (word: string) =>
  word
    .trim()
    .toUpperCase()
    .split("")
    .map((c) => (c === " " ? " " : "_"))
    .join(" ");

/** "Ice  Cream!" and "icecream" count as the same answer. */
const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

// ── parse / save ──────────────────────────────────────────────────────────────
export function parseDoodleRushData(game: AnyGame): DoodleRushServerData {
  const raw = (game.game_settings ?? {}) as Record<string, unknown>;
  return {
    settings: (raw["doodleRushSettings"] as DoodleRushSettings) ?? DEFAULT_DOODLE_RUSH_SETTINGS,
    phase: (raw["doodleRushPhase"] as DoodleRushServerData["phase"]) ?? "lobby",
    currentRound: (raw["doodleRushRound"] as DoodleRushRound) ?? null,
    scores: (raw["doodleRushScores"] as Record<string, number>) ?? {},
    guesserScores: (raw["doodleRushGuesserScores"] as Record<string, number>) ?? {},
    drawerNames: (raw["doodleRushDrawerNames"] as Record<string, string>) ?? {},
    roundNumber: (raw["doodleRushRoundNumber"] as number) ?? 0,
    drawerOrder: (raw["doodleRushDrawerOrder"] as string[]) ?? [],
    drawerIndex: (raw["doodleRushDrawerIndex"] as number) ?? 0,
    usedWords: (raw["doodleRushUsedWords"] as string[]) ?? [],
    countdownEndsAt: (raw["doodleRushCountdownEndsAt"] as string) ?? null,
    nextAt: (raw["doodleRushNextAt"] as string) ?? null,
  };
}

async function saveDoodleRushData(gameId: string, data: Partial<DoodleRushServerData>) {
  const keys: Record<string, unknown> = {};
  if (data.settings !== undefined) keys["doodleRushSettings"] = data.settings;
  if (data.phase !== undefined) keys["doodleRushPhase"] = data.phase;
  if (data.currentRound !== undefined) keys["doodleRushRound"] = data.currentRound;
  if (data.scores !== undefined) keys["doodleRushScores"] = data.scores;
  if (data.guesserScores !== undefined) keys["doodleRushGuesserScores"] = data.guesserScores;
  if (data.drawerNames !== undefined) keys["doodleRushDrawerNames"] = data.drawerNames;
  if (data.roundNumber !== undefined) keys["doodleRushRoundNumber"] = data.roundNumber;
  if (data.drawerOrder !== undefined) keys["doodleRushDrawerOrder"] = data.drawerOrder;
  if (data.drawerIndex !== undefined) keys["doodleRushDrawerIndex"] = data.drawerIndex;
  if (data.usedWords !== undefined) keys["doodleRushUsedWords"] = data.usedWords;
  if (data.countdownEndsAt !== undefined) keys["doodleRushCountdownEndsAt"] = data.countdownEndsAt;
  if (data.nextAt !== undefined) keys["doodleRushNextAt"] = data.nextAt;

  const { data: current, error: readError } = await supabaseAdmin
    .from("games")
    .select("game_settings")
    .eq("id", gameId)
    .single();
  if (readError) fail(SAFE_DB_ERROR);
  const currentSettings = ((current as { game_settings?: Record<string, unknown> } | null)
    ?.game_settings ?? {}) as Record<string, unknown>;
  const { error } = await supabaseAdmin
    .from("games")
    .update({ game_settings: { ...currentSettings, ...keys } as unknown as Json })
    .eq("id", gameId);
  if (error) fail(SAFE_DB_ERROR);
}

// ── client state: the secret word only ever reaches the drawer (and everybody once the round is over) ──
export function buildDoodleRushClientState(
  data: DoodleRushServerData,
  callerProfileId: string,
): DoodleRushClientState {
  const isDrawer = data.currentRound?.drawerId === callerProfileId;
  const revealed = data.phase === "round_end" || data.phase === "game_over";
  let round: DoodleRushClientState["currentRound"] = null;
  if (data.currentRound) {
    round = {
      ...data.currentRound,
      word: isDrawer || revealed ? data.currentRound.word : null,
      revealedWord: revealed ? data.currentRound.word : null,
    };
  }
  return {
    phase: data.phase,
    settings: data.settings,
    currentRound: round,
    scores: data.scores,
    guesserScores: data.guesserScores,
    drawerNames: data.drawerNames,
    roundNumber: data.roundNumber,
    totalRounds: data.drawerOrder.length, // each player draws exactly once
    countdownEndsAt: data.countdownEndsAt,
    nextAt: data.phase === "round_end" ? data.nextAt : null,
    isDrawer,
  };
}

// ── canvas snapshots (kept in their own table so polling stays light) ─────────
export function sanitizeStrokes(input: unknown): DrawStroke[] {
  if (!Array.isArray(input)) fail("Invalid drawing.");
  if (input.length > MAX_STROKES) fail("That drawing is too big. Clear the board and keep going!");
  let total = 0;
  const out: DrawStroke[] = [];
  for (const raw of input) {
    const s = raw as Partial<DrawStroke> | null;
    if (!s || !Array.isArray(s.x) || !Array.isArray(s.y)) continue;
    const n = Math.min(s.x.length, s.y.length, MAX_POINTS_PER_STROKE);
    if (n < 2) continue;
    total += n;
    if (total > MAX_TOTAL_POINTS) fail("That drawing is too big. Clear the board and keep going!");
    const clamp = (v: unknown) =>
      Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 1000) / 1000;
    out.push({
      x: s.x.slice(0, n).map(clamp),
      y: s.y.slice(0, n).map(clamp),
      color: typeof s.color === "string" && HEX_COLOR.test(s.color) ? s.color : "#1a1a1a",
      size: Math.min(40, Math.max(1, Math.round(Number(s.size) || 8))),
      tool: s.tool === "eraser" ? "eraser" : "pen",
    });
  }
  return out;
}

export async function pushDoodleCanvas(
  game: AnyGame,
  profileId: string,
  strokesInput: unknown,
): Promise<{ seq: number }> {
  const data = parseDoodleRushData(game);
  const round = data.currentRound;
  if (data.phase !== "drawing" || !round) fail("Nothing is being drawn right now.");
  if (round.drawerId !== profileId) fail("Only the artist can draw.");
  const strokes = sanitizeStrokes(strokesInput);
  const seq = (round.canvasSeq ?? 0) + 1;

  const { error } = await supabaseAdmin.from("draw_canvas").upsert(
    {
      game_id: game.id,
      round_number: round.roundNumber,
      seq,
      strokes: strokes as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "game_id" },
  );
  if (error) {
    console.error("[doodle] canvas save failed", error.code, error.message);
    // 42P01 = table missing: the 0006 migration has not been run yet
    fail(
      error.code === "42P01"
        ? "Drawing sync needs a database update (run migration 0006)."
        : SAFE_DB_ERROR,
    );
  }
  await saveDoodleRushData(game.id, { currentRound: { ...round, canvasSeq: seq } });
  return { seq };
}

export async function getDoodleCanvas(
  game: AnyGame,
): Promise<{ seq: number; roundNumber: number; strokes: DrawStroke[] }> {
  const data = parseDoodleRushData(game);
  const round = data.currentRound;
  if (!round) return { seq: 0, roundNumber: 0, strokes: [] };
  const { data: row, error } = await supabaseAdmin
    .from("draw_canvas")
    .select("round_number, seq, strokes")
    .eq("game_id", game.id)
    .maybeSingle();
  if (error) {
    console.error("[doodle] canvas read failed", error.code, error.message);
    return { seq: 0, roundNumber: round.roundNumber, strokes: [] };
  }
  // A leftover picture from the previous round must never show up in this one.
  if (!row || row.round_number !== round.roundNumber)
    return { seq: 0, roundNumber: round.roundNumber, strokes: [] };
  return {
    seq: row.seq,
    roundNumber: row.round_number,
    strokes: (row.strokes as unknown as DrawStroke[]) ?? [],
  };
}

// ── actions ───────────────────────────────────────────────────────────────────
function newRound(
  roundNumber: number,
  drawerId: string,
  drawerName: string,
  word: string,
  settings: DoodleRushSettings,
  extraDelayMs: number,
): DoodleRushRound {
  return {
    roundNumber,
    drawerId,
    drawerName,
    word,
    revealedWord: null,
    wordLength: word.length,
    revealedIndices: [],
    wordMask: maskFor(word),
    latestCorrectGuesser: null,
    canvasSeq: 0,
    guesses: [],
    winnerIds: [],
    endsAt:
      settings.drawTime > 0
        ? new Date(Date.now() + extraDelayMs + settings.drawTime * 1000).toISOString()
        : null,
    ended: false,
  };
}

export async function startDoodleRushMatch(game: AnyGame, players: AnyPlayer[]): Promise<void> {
  if (players.length < 2) fail("Doodle Rush requires at least 2 players.");

  const raw = (game.game_settings ?? {}) as Record<string, unknown>;
  const drawTime = Number(raw["doodleRushDrawTime"] ?? DEFAULT_DOODLE_RUSH_SETTINGS.drawTime);
  const settings: DoodleRushSettings = {
    rounds: 1,
    drawTime:
      drawTime === 0 || (drawTime >= 30 && drawTime <= 180)
        ? drawTime
        : DEFAULT_DOODLE_RUSH_SETTINGS.drawTime,
  };

  const scores: Record<string, number> = {};
  const guesserScores: Record<string, number> = {};
  const drawerNames: Record<string, string> = {};
  for (const p of players) {
    scores[p.profile_id] = 0;
    guesserScores[p.profile_id] = 0;
    drawerNames[p.profile_id] = p.profiles?.display_name ?? "Player";
  }

  const drawerOrder = shuffle(players.map((p) => p.profile_id));
  const firstDrawerId = drawerOrder[0]!;
  const word = pickDrawWord([]);
  const round = newRound(
    1,
    firstDrawerId,
    drawerNames[firstDrawerId] ?? "Player",
    word,
    settings,
    COUNTDOWN_MS,
  );

  await supabaseAdmin.from("draw_canvas").delete().eq("game_id", game.id); // a rematch starts on a blank board
  await saveDoodleRushData(game.id, {
    settings,
    phase: "countdown",
    currentRound: round,
    scores,
    guesserScores,
    drawerNames,
    roundNumber: 1,
    drawerOrder,
    drawerIndex: 0,
    usedWords: [word],
    countdownEndsAt: new Date(Date.now() + COUNTDOWN_MS).toISOString(),
    nextAt: null,
  });
  await supabaseAdmin.from("games").update({ status: "playing" }).eq("id", game.id);
}

/** Ends the drawing: the word is revealed and the next drawing is scheduled. */
function closeRound(round: DoodleRushRound): Partial<DoodleRushServerData> {
  return {
    phase: "round_end",
    nextAt: new Date(Date.now() + DOODLE_BETWEEN_ROUNDS_MS).toISOString(),
    currentRound: { ...round, ended: true, revealedWord: round.word },
  };
}

export async function submitDoodleGuess(
  game: AnyGame,
  profileId: string,
  displayName: string,
  guessText: string,
  seatedPlayers: number,
): Promise<{ ok: boolean; correct: boolean; close?: boolean; error?: string }> {
  const data = parseDoodleRushData(game);
  const round = data.currentRound;
  if (data.phase !== "drawing" || !round)
    return { ok: false, correct: false, error: "Game not active." };
  if (!(profileId in data.scores))
    return { ok: false, correct: false, error: "You're not in this match." };
  if (round.drawerId === profileId) return { ok: false, correct: false, error: "You're drawing!" };
  if (round.winnerIds.includes(profileId))
    return { ok: false, correct: false, error: "You already guessed correctly!" };
  if (round.endsAt && Date.now() > Date.parse(round.endsAt))
    return { ok: false, correct: false, error: "Time's up!" };

  const text = guessText.trim().slice(0, 40);
  if (!text) return { ok: false, correct: false, error: "Type a guess first." };

  // slow down button-mashing
  const mine = [...round.guesses].reverse().find((g) => g.profileId === profileId);
  if (mine && Date.now() - Date.parse(mine.submittedAt) < 600) {
    return { ok: false, correct: false, error: "Easy! One guess at a time." };
  }

  const secret = (round.word ?? "").trim();
  const guessKey = normalise(text);
  const correct = guessKey.length > 0 && guessKey === normalise(secret);
  const close = !correct && guessKey.length >= 4 && withinOneEdit(guessKey, normalise(secret));

  // A correct answer is never written down as text: otherwise everyone after you could just copy it.
  const entry: DoodleRushGuess = {
    profileId,
    displayName,
    guess: correct ? "" : text,
    correct,
    submittedAt: new Date().toISOString(),
  };
  const guesses = [...round.guesses, entry].slice(-80);
  const winnerIds = correct ? [...round.winnerIds, profileId] : round.winnerIds;
  const scores = { ...data.scores };
  const guesserScores = { ...data.guesserScores };
  const revealedIndices = [...(round.revealedIndices ?? [])];
  let wordMask = round.wordMask ?? maskFor(secret);
  let latestCorrectGuesser = round.latestCorrectGuesser ?? null;

  if (correct) {
    // The artist earns a point for every player who gets the picture; the guesser's own tally goes up too.
    scores[round.drawerId] = (scores[round.drawerId] ?? 0) + 1;
    guesserScores[profileId] = (guesserScores[profileId] ?? 0) + 1;
    // Each correct guess reveals one more letter to the players still guessing.
    const upper = secret.toUpperCase();
    const hidden: number[] = [];
    for (let i = 0; i < upper.length; i++)
      if (upper[i] !== " " && !revealedIndices.includes(i)) hidden.push(i);
    if (hidden.length > 1) revealedIndices.push(hidden[Math.floor(Math.random() * hidden.length)]!);
    wordMask = upper
      .split("")
      .map((ch, i) => (ch === " " ? " " : revealedIndices.includes(i) ? ch : "_"))
      .join(" ");
    latestCorrectGuesser = { displayName, submittedAt: entry.submittedAt };
  }

  const guessersNeeded = Math.max(1, seatedPlayers - 1); // everyone except the artist
  const allGuessed = winnerIds.length >= guessersNeeded;
  const updated: DoodleRushRound = {
    ...round,
    guesses,
    winnerIds,
    revealedIndices,
    wordMask,
    latestCorrectGuesser,
  };
  await saveDoodleRushData(game.id, {
    currentRound: updated,
    scores,
    guesserScores,
    ...(allGuessed ? closeRound(updated) : {}),
  });
  return { ok: true, correct, ...(close ? { close: true } : {}) };
}

/** The artist (or the host) gives up on the drawing: nobody could get it. */
export async function endDoodleRound(game: AnyGame, profileId: string): Promise<void> {
  const data = parseDoodleRushData(game);
  const round = data.currentRound;
  if (data.phase !== "drawing" || !round) return;
  if (round.drawerId !== profileId && game.host_id !== profileId)
    fail("Only the artist or the host can skip this drawing.");
  await saveDoodleRushData(game.id, closeRound(round));
}

export async function advanceDoodleRound(game: AnyGame): Promise<void> {
  const data = parseDoodleRushData(game);
  if (data.phase !== "round_end") return; // already moved on (the timer got there first)
  const nextRoundNum = data.roundNumber + 1;

  if (nextRoundNum > data.drawerOrder.length) {
    await saveDoodleRushData(game.id, { phase: "game_over", nextAt: null });
    await supabaseAdmin.from("games").update({ status: "ended" }).eq("id", game.id);
    return;
  }

  const drawerIndex = data.drawerIndex + 1;
  const drawerId = data.drawerOrder[drawerIndex % data.drawerOrder.length]!;
  const word = pickDrawWord(data.usedWords);
  const round = newRound(
    nextRoundNum,
    drawerId,
    data.drawerNames?.[drawerId] ?? `Player ${drawerIndex + 1}`,
    word,
    data.settings,
    0,
  );
  await supabaseAdmin.from("draw_canvas").delete().eq("game_id", game.id); // fresh board for the next artist
  await saveDoodleRushData(game.id, {
    phase: "drawing",
    currentRound: round,
    roundNumber: nextRoundNum,
    drawerIndex,
    usedWords: [...data.usedWords, word],
    nextAt: null,
  });
}

/** Cheap check (no database): is a clock-driven change due? */
export function doodleRushTickDue(game: AnyGame, now = Date.now()): boolean {
  const d = parseDoodleRushData(game);
  if (d.phase === "countdown" && d.countdownEndsAt) return now >= Date.parse(d.countdownEndsAt);
  if (d.phase === "drawing" && d.currentRound?.endsAt)
    return now >= Date.parse(d.currentRound.endsAt);
  if (d.phase === "round_end" && d.nextAt) return now >= Date.parse(d.nextAt);
  return false;
}

/** Applies the due clock-driven change. Call it inside the room lock with a freshly loaded game. */
export async function tickDoodleRush(game: AnyGame): Promise<boolean> {
  const data = parseDoodleRushData(game);
  const now = Date.now();
  if (
    data.phase === "countdown" &&
    data.countdownEndsAt &&
    now >= Date.parse(data.countdownEndsAt)
  ) {
    await saveDoodleRushData(game.id, { phase: "drawing" });
    return true;
  }
  if (
    data.phase === "drawing" &&
    data.currentRound?.endsAt &&
    now >= Date.parse(data.currentRound.endsAt)
  ) {
    await saveDoodleRushData(game.id, closeRound(data.currentRound));
    return true;
  }
  if (data.phase === "round_end" && data.nextAt && now >= Date.parse(data.nextAt)) {
    await advanceDoodleRound(game);
    return true;
  }
  return false;
}

/** A player left mid-match. If they were the artist, skip their drawing; if only one player is left, finish. */
export async function handleDoodleRushPlayerLeft(
  game: AnyGame,
  leaverId: string,
  remainingIds: string[],
) {
  const data = parseDoodleRushData(game);
  if (data.phase === "game_over" || data.phase === "lobby") return;
  if (remainingIds.length < 2) {
    const round = data.currentRound;
    await saveDoodleRushData(game.id, {
      phase: "game_over",
      nextAt: null,
      ...(round ? { currentRound: { ...round, ended: true, revealedWord: round.word } } : {}),
    });
    await supabaseAdmin.from("games").update({ status: "ended" }).eq("id", game.id);
    return;
  }
  const round = data.currentRound;
  if (
    round &&
    round.drawerId === leaverId &&
    (data.phase === "drawing" || data.phase === "countdown")
  ) {
    await saveDoodleRushData(game.id, closeRound(round));
  }
}
