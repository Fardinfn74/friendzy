import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withRoomLock } from "./room-lock.server";
import { notifyRoom } from "./room-notify.server";
import {
  HINT_SECONDS,
  MAX_PLAYERS,
  MAX_REPLAY_STREAK,
  MIN_PLAYERS,
  RESOLVE_SECONDS,
  VOTE_SECONDS,
  maxImposters,
  type Difficulty,
  type GameState,
  type GameStatus,
} from "./game-types";

type GameRow = {
  id: string;
  code: string;
  host_id: string;
  status: string;
  difficulty: string;
  imposter_count: number;
  max_players: number;
  category: string | null;
  secret_word: string | null;
  ai_theme?: string | null;
  ai_word?: string | null;
  game_mode?: string;
  decoy_word?: string | null;
  ai_category?: string | null;
  round_number: number;
  current_turn_profile_id: string | null;
  turn_deadline: string | null;
  vote_deadline: string | null;
  replay_streak: number;
  last_eliminated_id: string | null;
  last_eliminated_was_imposter: boolean | null;
  last_resolution_note: string | null;
  resolve_until: string | null;
  pending_status: string | null;
  winner: string | null;
  game_type?: string | null;
  game_settings?: Record<string, unknown> | null;
};

type PlayerRow = {
  id: string;
  game_id: string;
  profile_id: string;
  is_host: boolean;
  is_imposter: boolean;
  is_ready: boolean;
  is_eliminated: boolean;
  left_game: boolean;
  card_seen: boolean;
  turn_order: number | null;
  joined_at: string;
  last_seen_at?: string | null;
  profiles: { display_name: string; avatar_id: string } | null;
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class GameError extends Error {}

function fail(message: string): never {
  throw new GameError(message);
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function inSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function alive(players: PlayerRow[]) {
  return players.filter((p) => !p.is_eliminated && !p.left_game);
}

function present(players: PlayerRow[]) {
  return players.filter((p) => !p.left_game);
}

type ProfileRow = { id: string; display_name: string; avatar_id: string };
const profileCache = new Map<string, { value: ProfileRow; expires: number }>();
const PROFILE_TTL_MS = 5 * 60_000;

export async function resolveProfile(sessionToken: string) {
  // Looked up on every poll by every player, so keep it in memory for a few minutes.
  const hit = profileCache.get(sessionToken);
  if (hit && hit.expires > Date.now()) return hit.value;
  // Use SECURITY DEFINER RPC to bypass RLS — works with publishable key too.
  const { data, error } = await supabaseAdmin.rpc("rpc_get_profile", {
    p_session_token: sessionToken,
  });
  if (error) fail(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) fail("We couldn't find your player profile — pick a name again.");
  if (profileCache.size > 5000) profileCache.clear();
  profileCache.set(sessionToken, { value: row as ProfileRow, expires: Date.now() + PROFILE_TTL_MS });
  return row as ProfileRow;
}

export async function upsertProfile(input: {
  sessionToken: string;
  displayName: string;
  avatarId: string;
}) {
  const displayName = input.displayName.trim().slice(0, 16);
  if (displayName.length < 2) fail("Your name needs at least 2 characters.");
  profileCache.delete(input.sessionToken);
  // Use SECURITY DEFINER RPC to bypass RLS — works with publishable key too.
  const { data, error } = await supabaseAdmin.rpc("rpc_upsert_profile", {
    p_session_token: input.sessionToken,
    p_display_name: displayName,
    p_avatar_id: input.avatarId,
  });
  if (error) fail(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) fail("Profile save failed — please try again.");
  return row as { id: string; display_name: string; avatar_id: string };
}

async function loadGameByCode(code: string) {
  const { data, error } = await supabaseAdmin
    .from("games")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .maybeSingle();
  if (error) fail(error.message);
  if (!data) fail("No game found with that code.");
  return data as GameRow;
}

async function loadPlayers(gameId: string) {
  const { data, error } = await supabaseAdmin
    .from("game_players")
    .select("*, profiles(display_name, avatar_id)")
    .eq("game_id", gameId)
    .order("joined_at", { ascending: true });
  if (error) fail(error.message);
  return (data ?? []) as PlayerRow[];
}

type HintLite = { profile_id: string; round_number: number; message: string; skipped: boolean };
type VoteLite = { voter_id: string };

async function loadHintRows(gameId: string): Promise<HintLite[]> {
  const { data } = await supabaseAdmin
    .from("hints")
    .select("profile_id, round_number, message, skipped")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });
  return (data ?? []) as HintLite[];
}

async function loadVoteRows(gameId: string, round: number): Promise<VoteLite[]> {
  const { data } = await supabaseAdmin.from("votes").select("voter_id").eq("game_id", gameId).eq("round_number", round);
  return (data ?? []) as VoteLite[];
}

async function patchGame(gameId: string, patch: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from("games")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", gameId);
  if (error) fail(error.message);
}

/* ---------------------------------------------------------------- rooms --- */

export async function createGame(
  sessionToken: string,
  gameType: string = "imposter",
  gameSettings: Record<string, unknown> = {},
) {
  const profile = await resolveProfile(sessionToken);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = Array.from(
      { length: 5 },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
    ).join("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let insertResult = await (supabaseAdmin.from("games") as any)
      .insert({ code, host_id: profile.id, game_type: gameType, game_settings: gameSettings })
      .select("id, code")
      .maybeSingle();
    if (
      insertResult.error &&
      (insertResult.error.message.includes("game_type") ||
        insertResult.error.message.includes("game_settings"))
    ) {
      insertResult = await supabaseAdmin
        .from("games")
        .insert({ code, host_id: profile.id })
        .select("id, code")
        .maybeSingle();
    }
    const { data, error } = insertResult;
    if (error) continue;
    if (data) {
      const { error: playerError } = await supabaseAdmin
        .from("game_players")
        .insert({ game_id: data.id, profile_id: profile.id, is_host: true });
      if (playerError) fail(playerError.message);
      return { code: data.code };
    }
  }
  fail("Couldn't create a room right now. Please try again.");
}

async function joinGameImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const players = await loadPlayers(game.id);
  const mine = players.find((p) => p.profile_id === profile.id);

  if (mine) {
    // Reconnect: same identity rejoins mid-game and re-syncs.
    await supabaseAdmin
      .from("game_players")
      .update({ left_game: false, last_seen_at: new Date().toISOString() })
      .eq("id", mine.id);
    return { code: game.code };
  }

  if (game.status !== "lobby") fail("That game has already started.");
  if (present(players).length >= game.max_players) fail("That room is full.");

  const { error } = await supabaseAdmin
    .from("game_players")
    .insert({ game_id: game.id, profile_id: profile.id });
  if (error) fail(error.message);
  return { code: game.code };
}

async function updateSettingsImpl(
  sessionToken: string,
  code: string,
  settings: {
    mode?: "classic" | "double" | undefined;
    difficulty?: Difficulty | undefined;
    imposterCount?: number | undefined;
    maxPlayers?: number | undefined;
    wordDuelSettings?:
      { rounds?: 3 | 5 | 7 | undefined; roundTime?: 20 | 30 | 45 | undefined } | undefined;
    numberGuessSettings?:
      | {
          range?: "1-50" | "1-100" | "1-500" | undefined;
          hints?: boolean | undefined;
          rounds?: 3 | 5 | undefined;
        }
      | undefined;
    bottleSpinSettings?:
      | {
          promptLevel?: "All" | "Chill" | "Funny" | "Wild" | undefined;
          customPrompts?:
            | Array<{
                id: string;
                type: "truth" | "dare";
                level: "Chill" | "Funny" | "Wild";
                text: string;
              }>
            | undefined;
        }
      | undefined;
    truthOrDareSettings?:
      | {
          promptLevel?: "All" | "Chill" | "Funny" | "Wild" | undefined;
          customPrompts?:
            | Array<{
                id: string;
                type: "truth" | "dare";
                level: "Chill" | "Funny" | "Wild";
                text: string;
              }>
            | undefined;
        }
      | undefined;
    chessSettings?:
      | {
          timedMode?: boolean | undefined;
          timePerSide?: 60 | 180 | 300 | 600 | undefined;
          incrementSeconds?: 0 | 3 | 5 | undefined;
        }
      | undefined;
    ludoSettings?:
      | {
          tokensPerPlayer?: 2 | 4 | undefined;
        }
      | undefined;
    carromSettings?:
      | {
          boardMode?: "fast" | "classic" | undefined;
          targetScore?: 15 | 25 | undefined;
        }
      | undefined;
    letterBlitzSettings?:
      | {
          rounds?: number | undefined;
          roundTime?: number | undefined;
        }
      | undefined;
    doodleRushSettings?:
      | {
          rounds?: number | undefined;
          drawTime?: number | undefined;
        }
      | undefined;
  },
) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.host_id !== profile.id) fail("Only the host can change settings.");
  if (game.status !== "lobby") fail("Settings are locked once the game starts.");
  const players = present(await loadPlayers(game.id));

  const patch: Record<string, unknown> = {};
  if (settings.difficulty) patch["difficulty"] = settings.difficulty;
  if (settings.mode) patch["game_mode"] = settings.mode;
  if (settings.imposterCount != null) {
    patch["imposter_count"] = Math.min(
      Math.max(1, settings.imposterCount),
      maxImposters(Math.max(players.length, MIN_PLAYERS)),
    );
  }
  if (settings.maxPlayers != null) {
    patch["max_players"] = Math.min(
      MAX_PLAYERS,
      Math.max(players.length, settings.maxPlayers, MIN_PLAYERS),
    );
  }
  if (settings.wordDuelSettings) {
    const existing = (game.game_settings as Record<string, unknown>) || {};
    const existingWd = (existing["wordDuel"] as Record<string, unknown>) || {};
    patch["game_settings"] = {
      ...existing,
      wordDuel: {
        ...existingWd,
        settings: {
          ...((existingWd["settings"] as Record<string, unknown>) || { rounds: 3, roundTime: 30 }),
          ...settings.wordDuelSettings,
        },
      },
    };
  }
  if (settings.numberGuessSettings) {
    const existing = (game.game_settings as Record<string, unknown>) || {};
    const existingNg = (existing["numberGuess"] as Record<string, unknown>) || {};
    patch["game_settings"] = {
      ...((patch["game_settings"] as Record<string, unknown>) || existing),
      numberGuess: {
        ...existingNg,
        settings: {
          ...((existingNg["settings"] as Record<string, unknown>) || {
            range: "1-100",
            hints: true,
            rounds: 3,
          }),
          ...settings.numberGuessSettings,
        },
      },
    };
  }
  if (settings.bottleSpinSettings) {
    const existing = (game.game_settings as Record<string, unknown>) || {};
    const existingBs = (existing["bottleSpin"] as Record<string, unknown>) || {};
    patch["game_settings"] = {
      ...((patch["game_settings"] as Record<string, unknown>) || existing),
      bottleSpin: {
        ...existingBs,
        settings: {
          ...((existingBs["settings"] as Record<string, unknown>) || {
            promptLevel: "Chill",
            customPrompts: [],
          }),
          ...settings.bottleSpinSettings,
        },
      },
    };
  }
  if (settings.truthOrDareSettings) {
    const existing = (game.game_settings as Record<string, unknown>) || {};
    const existingTod = (existing["truthOrDare"] as Record<string, unknown>) || {};
    patch["game_settings"] = {
      ...((patch["game_settings"] as Record<string, unknown>) || existing),
      truthOrDare: {
        ...existingTod,
        settings: {
          ...((existingTod["settings"] as Record<string, unknown>) || {
            promptLevel: "Chill",
            customPrompts: [],
          }),
          ...settings.truthOrDareSettings,
        },
      },
    };
  }
  if (settings.chessSettings) {
    const existing = (game.game_settings as Record<string, unknown>) || {};
    const existingChess = (existing["chess"] as Record<string, unknown>) || {};
    patch["game_settings"] = {
      ...((patch["game_settings"] as Record<string, unknown>) || existing),
      chess: {
        ...existingChess,
        settings: {
          ...((existingChess["settings"] as Record<string, unknown>) || {
            timedMode: true,
            timePerSide: 300,
            incrementSeconds: 5,
          }),
          ...settings.chessSettings,
        },
      },
    };
  }
  if (settings.ludoSettings) {
    const existing = (game.game_settings as Record<string, unknown>) || {};
    const existingLudo = (existing["ludo"] as Record<string, unknown>) || {};
    patch["game_settings"] = {
      ...((patch["game_settings"] as Record<string, unknown>) || existing),
      ludo: {
        ...existingLudo,
        settings: {
          ...((existingLudo["settings"] as Record<string, unknown>) || {
            tokensPerPlayer: 4,
          }),
          ...settings.ludoSettings,
        },
      },
    };
  }
  if (settings.carromSettings) {
    const existing = (game.game_settings as Record<string, unknown>) || {};
    const existingCarrom = (existing["carrom"] as Record<string, unknown>) || {};
    patch["game_settings"] = {
      ...((patch["game_settings"] as Record<string, unknown>) || existing),
      carrom: {
        ...existingCarrom,
        settings: {
          ...((existingCarrom["settings"] as Record<string, unknown>) || {
            boardMode: "fast",
            targetScore: 15,
          }),
          ...settings.carromSettings,
        },
      },
    };
  }
  if (settings.letterBlitzSettings) {
    const existing = (game.game_settings as Record<string, unknown>) || {};
    patch["game_settings"] = {
      ...((patch["game_settings"] as Record<string, unknown>) || existing),
      letterBlitzRounds: settings.letterBlitzSettings.rounds ?? existing["letterBlitzRounds"] ?? 5,
      letterBlitzRoundTime: settings.letterBlitzSettings.roundTime ?? existing["letterBlitzRoundTime"] ?? 45,
    };
  }
  if (settings.doodleRushSettings) {
    const existing = (game.game_settings as Record<string, unknown>) || {};
    patch["game_settings"] = {
      ...((patch["game_settings"] as Record<string, unknown>) || existing),
      doodleRushRounds: settings.doodleRushSettings.rounds ?? existing["doodleRushRounds"] ?? 3,
      doodleRushDrawTime: settings.doodleRushSettings.drawTime ?? existing["doodleRushDrawTime"] ?? 80,
    };
  }
  await patchGame(game.id, patch);
}

async function kickPlayerImpl(sessionToken: string, code: string, targetProfileId: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.host_id !== profile.id) fail("Only the host can remove players.");
  if (game.status !== "lobby") fail("You can only remove players in the lobby.");
  if (targetProfileId === profile.id) fail("You can't remove yourself.");
  const { error } = await supabaseAdmin
    .from("game_players")
    .delete()
    .eq("game_id", game.id)
    .eq("profile_id", targetProfileId);
  if (error) fail(error.message);
}

async function setReadyImpl(sessionToken: string, code: string, ready: boolean) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const { error } = await supabaseAdmin
    .from("game_players")
    .update({ is_ready: ready, last_seen_at: new Date().toISOString() })
    .eq("game_id", game.id)
    .eq("profile_id", profile.id);
  if (error) fail(error.message);
}

async function leaveGameImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const players = await loadPlayers(game.id);
  const mine = players.find((p) => p.profile_id === profile.id);
  if (!mine) return;

  if (game.status === "lobby") {
    await supabaseAdmin.from("game_players").delete().eq("id", mine.id);
  } else {
    // Mid-game: counts as eliminated for win math, but the role stays hidden.
    await supabaseAdmin
      .from("game_players")
      .update({ left_game: true, is_ready: false })
      .eq("id", mine.id);
  }

  const remaining = present(await loadPlayers(game.id));
  if (remaining.length === 0) {
    await patchGame(game.id, { status: "ended", winner: null });
    return;
  }
  if (game.host_id === profile.id) {
    const nextHost = remaining[0]!;
    await supabaseAdmin.from("game_players").update({ is_host: true }).eq("id", nextHost.id);
    await patchGame(game.id, { host_id: nextHost.profile_id });
  }
  if (game.status !== "lobby" && game.status !== "ended") {
    const fresh = await loadGameByCode(code);
    await settleAfterRosterChange(fresh, await loadPlayers(game.id), profile.id);
  }
}

/* -------------------------------------------------------------- the game --- */

async function startGameImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.host_id !== profile.id) fail("Only the host can start the game.");
  if (game.status !== "lobby") fail("The game is already running.");

  const players = present(await loadPlayers(game.id));
  const gameType = game.game_type || "imposter";

  if (gameType === "word-duel") {
    if (players.length !== 2) fail("Word Duel requires exactly 2 players.");
    if (!players.every((p) => p.is_ready)) fail("Both players must be ready first.");
    const wordDuelEngine = await import("@/games/word-duel/engine.server");
    await wordDuelEngine.startWordDuelMatch(game, players);
    return;
  }

  if (gameType === "number-guess") {
    if (players.length < 2) fail("Number Guess requires at least 2 players.");
    if (players.length > 6) fail("Number Guess supports at most 6 players.");
    if (!players.every((p) => p.is_ready)) fail("Everyone has to be ready first.");
    const ngEngine = await import("@/games/number-guess/engine.server");
    await ngEngine.startNumberGuessMatch(game, players);
    return;
  }

  if (gameType === "bottle-spin") {
    if (players.length < 3) fail("Bottle Spin requires at least 3 players.");
    if (!players.every((p) => p.is_ready)) fail("Everyone has to be ready first.");
    const bsEngine = await import("@/games/bottle-spin/engine.server");
    await bsEngine.startBottleSpinMatch(game, players);
    return;
  }

  if (gameType === "truth-or-dare") {
    if (players.length < 3) fail("Truth or Dare requires at least 3 players.");
    if (!players.every((p) => p.is_ready)) fail("Everyone has to be ready first.");
    const todEngine = await import("@/games/truth-or-dare/engine.server");
    await todEngine.startTruthOrDareMatch(game, players);
    return;
  }

  if (gameType === "chess") {
    if (players.length !== 2) fail("Chess requires exactly 2 players.");
    if (!players.every((p) => p.is_ready)) fail("Both players must be ready first.");
    const chessEngine = await import("@/games/chess/engine.server");
    await chessEngine.startChessMatch(game, players);
    return;
  }

  if (gameType === "ludo") {
    if (players.length < 2) fail("Ludo requires at least 2 players.");
    if (players.length > 4) fail("Ludo supports at most 4 players.");
    if (!players.every((p) => p.is_ready)) fail("Everyone has to be ready first.");
    const ludoEngine = await import("@/games/ludo/engine.server");
    await ludoEngine.startLudoMatch(game, players);
    return;
  }

  if (gameType === "carrom") {
    if (players.length < 2) fail("Carrom requires at least 2 players.");
    if (players.length > 4) fail("Carrom supports at most 4 players.");
    if (!players.every((p) => p.is_ready)) fail("Everyone has to be ready first.");
    const carromEngine = await import("@/games/carrom/engine.server");
    await carromEngine.startCarromMatch(game, players);
    return;
  }

  if (gameType === "letter-blitz") {
    if (players.length < 2) fail("Letter Blitz requires at least 2 players.");
    if (!players.every((p) => p.is_ready)) fail("Everyone has to be ready first.");
    const lbEngine = await import("@/games/letter-blitz/engine.server");
    await lbEngine.startLetterBlitzMatch(game, players);
    return;
  }

  if (gameType === "doodle-rush") {
    if (players.length < 2) fail("Doodle Rush requires at least 2 players.");
    if (!players.every((p) => p.is_ready)) fail("Everyone has to be ready first.");
    const drEngine = await import("@/games/doodle-rush/engine.server");
    await drEngine.startDoodleRushMatch(game, players);
    return;
  }

  if (players.length < MIN_PLAYERS) fail(`You need at least ${MIN_PLAYERS} players.`);
  if (!players.every((p) => p.is_ready)) fail("Everyone has to be ready first.");

  const { data: words, error: wordError } = await supabaseAdmin
    .from("word_bank")
    .select("word, category")
    .eq("difficulty", game.difficulty);
  if (wordError) fail(wordError.message);
  if (!words?.length && !game.ai_word) fail("The word bank is empty.");
  const pick = game.ai_word
    ? { word: game.ai_word, category: game.ai_category ?? game.ai_theme ?? "Custom" }
    : words![Math.floor(Math.random() * words!.length)]!;
  // ── Double Agent decoy: use Gemini for >50% semantic match ──────────────
  let decoy: string | null = null;
  if (game.game_mode === "double") {
    try {
      const { generateDoubleAgentDecoy } = await import("./ai-word.server");
      decoy = await generateDoubleAgentDecoy(pick.word, pick.category);
    } catch {
      // Fallback: pick same-category word from word bank
      const { data: pool } = await supabaseAdmin.from("word_bank").select("word, category");
      const same = (pool ?? []).filter((w) => w.word !== pick.word && w.category === pick.category);
      const any = (pool ?? []).filter((w) => w.word !== pick.word);
      const list = same.length ? same : any;
      decoy = list.length ? list[Math.floor(Math.random() * list.length)]!.word : null;
    }
  }

  const imposterCount = Math.min(game.imposter_count, maxImposters(players.length));

  // ── Turn order: randomise roles, but guarantee round-1 starts with crew ─
  const rolePool = shuffle(players);
  const imposterIds = new Set(rolePool.slice(0, imposterCount).map((p) => p.profile_id));

  const crewPlayers = players.filter((p) => !imposterIds.has(p.profile_id));
  const imposterPlayers = players.filter((p) => imposterIds.has(p.profile_id));

  // First turn slot = random crew member (never an imposter)
  const firstPlayer =
    crewPlayers.length > 0
      ? crewPlayers[Math.floor(Math.random() * crewPlayers.length)]!
      : players[0]!;

  const rest = shuffle([
    ...crewPlayers.filter((p) => p.id !== firstPlayer.id),
    ...imposterPlayers,
  ]);
  const orderedPlayers = [firstPlayer, ...rest];

  await Promise.all(
    orderedPlayers.map((player, index) =>
      supabaseAdmin
        .from("game_players")
        .update({
          is_imposter: imposterIds.has(player.profile_id),
          turn_order: index,
          is_ready: false,
          card_seen: false,
          is_eliminated: false,
        })
        .eq("id", player.id),
    ),
  );

  await supabaseAdmin.from("hints").delete().eq("game_id", game.id);
  await supabaseAdmin.from("votes").delete().eq("game_id", game.id);

  await patchGame(game.id, {
    status: "reveal",
    secret_word: pick.word,
    decoy_word: decoy,
    category: pick.category,
    imposter_count: imposterCount,
    round_number: 1,
    replay_streak: 0,
    winner: null,
    current_turn_profile_id: null,
    turn_deadline: null,
    vote_deadline: null,
    resolve_until: null,
    pending_status: null,
    last_eliminated_id: null,
    last_eliminated_was_imposter: null,
    last_resolution_note: null,
    ai_word: null,
    ai_category: null,
  });
}

export async function setAiWord(
  sessionToken: string,
  code: string,
  theme: string,
  word: string,
  category: string,
) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.host_id !== profile.id) fail("Only the host can pick the theme.");
  if (game.status !== "lobby") fail("You can only set a theme in the lobby.");
  await patchGame(game.id, { ai_theme: theme, ai_word: word, ai_category: category });
}

export async function assertHostInLobby(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.host_id !== profile.id) fail("Only the host can pick the theme.");
  if (game.status !== "lobby") fail("You can only set a theme in the lobby.");
  return game.difficulty;
}

async function confirmCardSeenImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.status !== "reveal") return;
  await supabaseAdmin
    .from("game_players")
    .update({ card_seen: true })
    .eq("game_id", game.id)
    .eq("profile_id", profile.id);

  const players = await loadPlayers(game.id);
  if (alive(players).every((p) => p.card_seen || p.profile_id === profile.id)) {
    await beginHintRound(game, players, game.round_number);
  }
}

function turnQueue(players: PlayerRow[], round: number) {
  const order = alive(players).sort((a, b) => (a.turn_order ?? 0) - (b.turn_order ?? 0));
  if (order.length === 0) return order;
  const offset = (round - 1) % order.length;
  return [...order.slice(offset), ...order.slice(0, offset)];
}

async function beginHintRound(game: GameRow, players: PlayerRow[], round: number) {
  const queue = turnQueue(players, round);
  const first = queue[0];
  await patchGame(game.id, {
    status: "hint",
    round_number: round,
    current_turn_profile_id: first?.profile_id ?? null,
    turn_deadline: inSeconds(HINT_SECONDS),
    vote_deadline: null,
    resolve_until: null,
    pending_status: null,
  });
}

async function advanceTurn(game: GameRow, round: number) {
  const players = await loadPlayers(game.id);
  const { data: hints } = await supabaseAdmin
    .from("hints")
    .select("profile_id")
    .eq("game_id", game.id)
    .eq("round_number", round);
  const done = new Set((hints ?? []).map((h) => h.profile_id));
  const next = turnQueue(players, round).find((p) => !done.has(p.profile_id));

  if (next) {
    await patchGame(game.id, {
      current_turn_profile_id: next.profile_id,
      turn_deadline: inSeconds(HINT_SECONDS),
    });
    return;
  }
  await patchGame(game.id, {
    status: "voting",
    current_turn_profile_id: null,
    turn_deadline: null,
    vote_deadline: inSeconds(VOTE_SECONDS),
  });
}

async function submitHintImpl(sessionToken: string, code: string, message: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.status !== "hint") fail("It's not clue time right now.");
  if (game.current_turn_profile_id !== profile.id) fail("It's not your turn yet.");

  const { checkHintText } = await import("./profanity.server");
  const checked = checkHintText(message);
  if (!checked.ok) fail(checked.reason);
  if (game.secret_word && checked.text.toLowerCase().includes(game.secret_word.toLowerCase())) {
    fail("Your clue can't contain the secret word.");
  }

  const { error } = await supabaseAdmin.from("hints").insert({
    game_id: game.id,
    round_number: game.round_number,
    profile_id: profile.id,
    message: checked.text,
  });
  if (error) fail("You already gave a clue this round.");
  await advanceTurn(game, game.round_number);
}

async function submitVoteImpl(
  sessionToken: string,
  code: string,
  input: { targetIds: string[]; replay: boolean },
) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.status !== "voting") fail("Voting isn't open.");
  const players = await loadPlayers(game.id);
  const me = players.find((p) => p.profile_id === profile.id);
  if (!me || me.is_eliminated || me.left_game) fail("Eliminated players can't vote.");

  const allowed = suspectsAllowed(game, players);
  const replayAvailable = game.replay_streak < MAX_REPLAY_STREAK;

  if (input.replay) {
    if (!replayAvailable) fail("Replay isn't available anymore — this vote has to stick.");
  } else {
    if (input.targetIds.length === 0) fail("Pick at least one suspect.");
    if (input.targetIds.length > allowed) fail(`You can pick at most ${allowed}.`);
    const living = new Set(alive(players).map((p) => p.profile_id));
    for (const id of input.targetIds) {
      if (id === profile.id) fail("You can't vote for yourself.");
      if (!living.has(id)) fail("That player is already out.");
    }
  }

  await supabaseAdmin
    .from("votes")
    .delete()
    .eq("game_id", game.id)
    .eq("round_number", game.round_number)
    .eq("voter_id", profile.id);

  const rows: {
    game_id: string;
    round_number: number;
    voter_id: string;
    target_id: string | null;
    is_replay_vote: boolean;
  }[] = input.replay
    ? [
        {
          game_id: game.id,
          round_number: game.round_number,
          voter_id: profile.id,
          target_id: null,
          is_replay_vote: true,
        },
      ]
    : input.targetIds.map((id) => ({
        game_id: game.id,
        round_number: game.round_number,
        voter_id: profile.id,
        target_id: id,
        is_replay_vote: false,
      }));
  const { error } = await supabaseAdmin.from("votes").insert(rows);
  if (error) fail(error.message);

  const { data: votes } = await supabaseAdmin
    .from("votes")
    .select("voter_id")
    .eq("game_id", game.id)
    .eq("round_number", game.round_number);
  const voters = new Set((votes ?? []).map((v) => v.voter_id));
  if (alive(players).every((p) => voters.has(p.profile_id))) {
    await tallyVotes(game);
  }
}

function suspectsAllowed(game: GameRow, players: PlayerRow[]) {
  const impostersAlive = alive(players).filter((p) => p.is_imposter).length;
  return Math.max(1, Math.min(impostersAlive, alive(players).length - 1));
}

async function tallyVotes(game: GameRow) {
  const players = await loadPlayers(game.id);
  const { data: votes } = await supabaseAdmin
    .from("votes")
    .select("voter_id, target_id, is_replay_vote")
    .eq("game_id", game.id)
    .eq("round_number", game.round_number);

  const tally = new Map<string, number>();
  const replayVoters = new Set<string>();
  for (const vote of votes ?? []) {
    if (vote.is_replay_vote) replayVoters.add(vote.voter_id);
    else if (vote.target_id) tally.set(vote.target_id, (tally.get(vote.target_id) ?? 0) + 1);
  }

  const top = Math.max(0, ...tally.values());
  const leaders = [...tally.entries()].filter(([, count]) => count === top).map(([id]) => id);
  const replayWins = replayVoters.size > top && game.replay_streak < MAX_REPLAY_STREAK;

  if (replayWins) {
    await patchGame(game.id, {
      status: "resolved",
      replay_streak: game.replay_streak + 1,
      last_eliminated_id: null,
      last_eliminated_was_imposter: null,
      last_resolution_note: "Replay won the vote — nobody was eliminated.",
      resolve_until: inSeconds(RESOLVE_SECONDS),
      pending_status: "hint",
    });
    return;
  }

  if (top === 0 || leaders.length !== 1) {
    await patchGame(game.id, {
      status: "resolved",
      replay_streak: 0,
      last_eliminated_id: null,
      last_eliminated_was_imposter: null,
      last_resolution_note:
        top === 0
          ? "No votes landed — nobody was eliminated."
          : "The vote was tied — nobody was eliminated.",
      resolve_until: inSeconds(RESOLVE_SECONDS),
      pending_status: "hint",
    });
    return;
  }

  const eliminatedId = leaders[0]!;
  const eliminated = players.find((p) => p.profile_id === eliminatedId)!;
  await supabaseAdmin.from("game_players").update({ is_eliminated: true }).eq("id", eliminated.id);

  const after = await loadPlayers(game.id);
  const impostersAlive = alive(after).filter((p) => p.is_imposter).length;
  const crewAlive = alive(after).filter((p) => !p.is_imposter).length;
  const name = eliminated.profiles?.display_name ?? "That player";

  let winner: string | null = null;
  let note: string;
  if (eliminated.is_imposter && impostersAlive === 0) {
    winner = "crew";
    note = `${name} was an Imposter — that was the last one!`;
  } else if (eliminated.is_imposter) {
    note = `${name} was an Imposter. ${impostersAlive} still hiding.`;
  } else if (impostersAlive >= crewAlive) {
    winner = "imposters";
    note = `${name} was Crew — the Imposters now hold the room.`;
  } else {
    note = `${name} was Crew. The hunt continues.`;
  }

  await patchGame(game.id, {
    status: "resolved",
    replay_streak: 0,
    last_eliminated_id: eliminatedId,
    last_eliminated_was_imposter: eliminated.is_imposter,
    last_resolution_note: note,
    resolve_until: inSeconds(RESOLVE_SECONDS),
    pending_status: winner ? "ended" : "hint",
    winner,
  });
}

/** Mini-games have no imposters: when someone leaves, let that game decide what happens next. */
async function settleOtherGameAfterLeave(game: GameRow, players: PlayerRow[], leaverId?: string) {
  const remaining = present(players);
  if (remaining.length === 0) {
    await patchGame(game.id, { status: "ended", pending_status: null });
    return;
  }
  if (!leaverId) return;
  const ids = remaining.map((p) => p.profile_id);
  switch (game.game_type) {
    case "chess":
      await (await import("@/games/chess/engine.server")).handleChessPlayerLeft(game, leaverId);
      break;
    case "word-duel":
      await (await import("@/games/word-duel/engine.server")).handleWordDuelPlayerLeft(game, ids);
      break;
    case "number-guess":
      await (await import("@/games/number-guess/engine.server")).handleNumberGuessPlayerLeft(game, leaverId, ids);
      break;
    case "bottle-spin":
      await (await import("@/games/bottle-spin/engine.server")).handleBottleSpinPlayerLeft(game, leaverId, ids);
      break;
    case "truth-or-dare":
      await (await import("@/games/truth-or-dare/engine.server")).handleTruthOrDarePlayerLeft(game, leaverId);
      break;
    case "ludo":
      await (await import("@/games/ludo/engine.server")).handleLudoPlayerLeft(game, leaverId);
      break;
    case "carrom":
      await (await import("@/games/carrom/engine.server")).handleCarromPlayerLeft(game, leaverId);
      break;
  }
  // Nobody left to play against: close the room.
  if (ids.length < 2) await patchGame(game.id, { status: "ended", winner: null, pending_status: null });
}

async function settleAfterRosterChange(game: GameRow, players: PlayerRow[], leaverId?: string) {
  if ((game.game_type || "imposter") !== "imposter") {
    await settleOtherGameAfterLeave(game, players, leaverId);
    return;
  }
  const living = alive(players);
  if (living.length === 0) {
    await patchGame(game.id, { status: "ended", pending_status: null });
    return;
  }
  const impostersAlive = living.filter((p) => p.is_imposter).length;
  const crewAlive = living.length - impostersAlive;
  if (impostersAlive === 0) {
    await patchGame(game.id, { status: "ended", winner: "crew", pending_status: null });
    return;
  }
  if (impostersAlive >= crewAlive) {
    await patchGame(game.id, { status: "ended", winner: "imposters", pending_status: null });
    return;
  }
  // Card reveal: if the only players still looking at their card left, don't freeze the room.
  if (game.status === "reveal" && living.every((p) => p.card_seen)) {
    await beginHintRound(game, players, game.round_number);
    return;
  }
  if (
    game.status === "hint" &&
    !living.some((p) => p.profile_id === game.current_turn_profile_id)
  ) {
    await advanceTurn(game, game.round_number);
  }
  if (game.status === "voting") {
    const { data: votes } = await supabaseAdmin
      .from("votes")
      .select("voter_id")
      .eq("game_id", game.id)
      .eq("round_number", game.round_number);
    const voters = new Set((votes ?? []).map((v) => v.voter_id));
    if (living.every((p) => voters.has(p.profile_id))) await tallyVotes(game);
  }
}

/** Idempotent: any client may call this the moment it notices a deadline passed. */
export async function advanceIfExpired(code: string, preloaded?: GameRow): Promise<boolean> {
  const game = preloaded ?? (await loadGameByCode(code));
  const now = Date.now();

  if (game.status === "reveal") return false;

  if (game.status === "hint" && game.turn_deadline && Date.parse(game.turn_deadline) <= now) {
    if (game.current_turn_profile_id) {
      await supabaseAdmin
        .from("hints")
        .insert({
          game_id: game.id,
          round_number: game.round_number,
          profile_id: game.current_turn_profile_id,
          message: "(stayed silent)",
          skipped: true,
        })
        .select("id");
    }
    await advanceTurn(game, game.round_number);
    return true;
  }

  if (game.status === "voting" && game.vote_deadline && Date.parse(game.vote_deadline) <= now) {
    await tallyVotes(game);
    return true;
  }

  if (game.status === "resolved" && game.resolve_until && Date.parse(game.resolve_until) <= now) {
    if (game.pending_status === "ended") {
      await patchGame(game.id, { status: "ended", pending_status: null, resolve_until: null });
    } else {
      const players = await loadPlayers(game.id);
      await beginHintRound(game, players, game.round_number + 1);
    }
    return true;
  }
  return false;
}

async function playAgainImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.host_id !== profile.id) fail("Only the host can start a new round.");

  await supabaseAdmin.from("hints").delete().eq("game_id", game.id);
  await supabaseAdmin.from("votes").delete().eq("game_id", game.id);
  await supabaseAdmin
    .from("game_players")
    .update({
      is_imposter: false,
      is_ready: false,
      is_eliminated: false,
      card_seen: false,
      turn_order: null,
    })
    .eq("game_id", game.id);
  await supabaseAdmin.from("game_players").delete().eq("game_id", game.id).eq("left_game", true);

  await patchGame(game.id, {
    status: "lobby",
    secret_word: null,
    category: null,
    round_number: 0,
    current_turn_profile_id: null,
    turn_deadline: null,
    vote_deadline: null,
    resolve_until: null,
    pending_status: null,
    replay_streak: 0,
    winner: null,
    last_eliminated_id: null,
    last_eliminated_was_imposter: null,
    last_resolution_note: null,
  });
}

/* ------------------------------------------------------------- read state --- */

export async function getState(sessionToken: string, code: string): Promise<GameState> {
  const profile = await resolveProfile(sessionToken); // cached: usually no database round trip

  let game = await loadGameByCode(code);
  if (await advanceIfExpired(code, game).catch(() => false)) game = await loadGameByCode(code);

  // Independent reads run together instead of one after another. Hints and votes only exist in Imposter.
  const isImposterGame = ((game.game_type as string) || "imposter") === "imposter";
  const [players, hintRows, voteRows] = await Promise.all([
    loadPlayers(game.id),
    isImposterGame ? loadHintRows(game.id) : Promise.resolve([] as HintLite[]),
    isImposterGame ? loadVoteRows(game.id, game.round_number) : Promise.resolve([] as VoteLite[]),
  ]);
  const me = players.find((p) => p.profile_id === profile.id);
  if (!me) fail("You're not in this game.");

  // Only informational, so refresh it every 30 s instead of on every poll (it was a write per player per second).
  const seenAt = me.last_seen_at ? Date.parse(me.last_seen_at) : 0;
  if (Date.now() - seenAt > 30_000) {
    await supabaseAdmin
      .from("game_players")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", me.id);
  }

  const hintedThisRound = new Set(
    (hintRows ?? []).filter((h) => h.round_number === game.round_number).map((h) => h.profile_id),
  );
  const voters = new Set((voteRows ?? []).map((v) => v.voter_id));
  const ended = game.status === "ended";
  const living = alive(players);
  const gameType = (game.game_type as string) || "imposter";

  let wordDuelState = null;
  if (gameType === "word-duel") {
    const wordDuelEngine = await import("@/games/word-duel/engine.server");
    wordDuelState = await wordDuelEngine.syncWordDuelState(game, players, profile.id);
  }

  let numberGuessState = null;
  if (gameType === "number-guess") {
    const ngEngine = await import("@/games/number-guess/engine.server");
    numberGuessState = await ngEngine.syncNumberGuessState(game, players, profile.id);
  }

  let bottleSpinState = null;
  if (gameType === "bottle-spin") {
    const bsEngine = await import("@/games/bottle-spin/engine.server");
    bottleSpinState = await bsEngine.syncBottleSpinState(game, players, profile.id);
  }

  let truthOrDareState = null;
  if (gameType === "truth-or-dare") {
    const todEngine = await import("@/games/truth-or-dare/engine.server");
    truthOrDareState = await todEngine.syncTruthOrDareState(game, players, profile.id);
  }

  let chessState = null;
  if (gameType === "chess") {
    const chessEngine = await import("@/games/chess/engine.server");
    chessState = await chessEngine.syncChessState(game, players, profile.id);
  }

  let ludoState = null;
  if (gameType === "ludo") {
    const ludoEngine = await import("@/games/ludo/engine.server");
    ludoState = await ludoEngine.syncLudoState(game, players, profile.id);
  }

  let carromState = null;
  if (gameType === "carrom") {
    const carromEngine = await import("@/games/carrom/engine.server");
    carromState = await carromEngine.syncCarromState(game, players, profile.id);
  }

  let letterBlitzState = null;
  if (gameType === "letter-blitz") {
    const lbEngine = await import("@/games/letter-blitz/engine.server");
    await lbEngine.tickLetterBlitz(game);
    letterBlitzState = lbEngine.buildLetterBlitzClientState(lbEngine.parseLetterBlitzData(game));
  }

  let doodleRushState = null;
  if (gameType === "doodle-rush") {
    const drEngine = await import("@/games/doodle-rush/engine.server");
    await drEngine.tickDoodleRush(game);
    doodleRushState = drEngine.buildDoodleRushClientState(
      drEngine.parseDoodleRushData(game),
      profile.id,
    );
  }

  return {
    code: game.code,
    gameType,
    gameSettings: (game.game_settings as Record<string, string | number | boolean | null>) || {},
    wordDuel: wordDuelState,
    numberGuess: numberGuessState,
    bottleSpin: bottleSpinState,
    truthOrDare: truthOrDareState,
    chess: chessState,
    ludo: ludoState,
    carrom: carromState,
    letterBlitz: letterBlitzState,
    doodleRush: doodleRushState,
    status: (wordDuelState?.phase === "match_ended" ||
    numberGuessState?.phase === "match_ended" ||
    chessState?.phase === "ended" ||
    ludoState?.phase === "ended" ||
    carromState?.phase === "ended" ||
    letterBlitzState?.phase === "game_over" ||
    doodleRushState?.phase === "game_over"
      ? "ended"
      : game.status) as GameStatus,
    difficulty: game.difficulty as Difficulty,
    imposterCount: game.imposter_count,
    mode: (game.game_mode === "double" ? "double" : "classic") as "classic" | "double",
    revealedDecoy: ended ? (game.decoy_word ?? null) : null,
    maxPlayers: game.max_players,
    aiTheme: game.ai_word ? (game.ai_theme ?? null) : null,
    roundNumber: game.round_number,
    currentTurnProfileId: game.current_turn_profile_id,
    turnDeadline: game.turn_deadline,
    voteDeadline: game.vote_deadline,
    resolveUntil: game.resolve_until,
    replayStreak: game.replay_streak,
    replayAvailable: game.replay_streak < MAX_REPLAY_STREAK,
    winner: (game.winner as "crew" | "imposters" | null) ?? null,
    lastEliminated: {
      profileId: game.last_eliminated_id,
      wasImposter: game.last_eliminated_was_imposter,
      note: game.last_resolution_note,
    },
    revealedWord: ended ? game.secret_word : null,
    revealedCategory: ended ? game.category : null,
    players: present(players).map((p) => ({
      profileId: p.profile_id,
      displayName: p.profiles?.display_name ?? "Player",
      avatarId: p.profiles?.avatar_id ?? "fox",
      isHost: p.profile_id === game.host_id,
      isReady: p.is_ready,
      isEliminated: p.is_eliminated,
      leftGame: p.left_game,
      cardSeen: p.card_seen,
      turnOrder: p.turn_order,
      hasHinted: hintedThisRound.has(p.profile_id),
      hasVoted: voters.has(p.profile_id),
      ...(ended ? { isImposter: p.is_imposter } : {}),
    })),
    hints: (hintRows ?? []).map((h) => ({
      profileId: h.profile_id,
      roundNumber: h.round_number,
      message: h.message,
      skipped: h.skipped,
    })),
    me: {
      profileId: profile.id,
      isHost: game.host_id === profile.id,
      isEliminated: me.is_eliminated,
      isReady: me.is_ready,
      cardSeen: me.card_seen,
      hasHinted: hintedThisRound.has(profile.id),
      hasVoted: voters.has(profile.id),
      isMyTurn: game.current_turn_profile_id === profile.id,
    },
    myCard:
      game.status === "lobby" || !game.secret_word
        ? null
        : me.is_imposter
          ? game.game_mode === "double" && game.decoy_word
            ? { role: "crew", word: game.decoy_word, category: game.category }
            : { role: "imposter", word: null, category: null }
          : { role: "crew", word: game.secret_word, category: game.category },
    votesNeeded: living.length,
    votesCast: living.filter((p) => voters.has(p.profile_id)).length,
    suspectsAllowed: suspectsAllowed(game, players),
  };
}

/* ----------------------------------------------------------- word duel actions --- */

async function sendWordDuelLetterImpl(sessionToken: string, code: string, letter: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const players = present(await loadPlayers(game.id));
  const wordDuelEngine = await import("@/games/word-duel/engine.server");
  await wordDuelEngine.sendWordDuelLetter(game, players, profile.id, letter);
}

async function submitWordDuelWordImpl(sessionToken: string, code: string, word: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const wordDuelEngine = await import("@/games/word-duel/engine.server");
  return await wordDuelEngine.submitWordDuelWord(game, profile.id, word);
}

async function advanceWordDuelRoundImpl(sessionToken: string, code: string) {
  await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const wordDuelEngine = await import("@/games/word-duel/engine.server");
  await wordDuelEngine.advanceWordDuelRound(game);
}

async function rematchWordDuelImpl(sessionToken: string, code: string) {
  await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const players = present(await loadPlayers(game.id));
  const wordDuelEngine = await import("@/games/word-duel/engine.server");
  await wordDuelEngine.rematchWordDuel(game, players);
}

/* ----------------------------------------------------------- number guess actions --- */

async function lockNumberGuessSecretImpl(sessionToken: string, code: string, number: number) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const players = present(await loadPlayers(game.id));
  const ngEngine = await import("@/games/number-guess/engine.server");
  return await ngEngine.lockNumberGuessSecret(game, players, profile.id, number);
}

async function submitNumberGuessImpl(
  sessionToken: string,
  code: string,
  targetId: string,
  guess: number,
) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const ngEngine = await import("@/games/number-guess/engine.server");
  return await ngEngine.submitNumberGuess(game, profile.id, targetId, guess);
}

async function advanceNumberGuessRoundImpl(sessionToken: string, code: string) {
  await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const ngEngine = await import("@/games/number-guess/engine.server");
  return await ngEngine.advanceNumberGuessRound(game);
}

async function rematchNumberGuessImpl(sessionToken: string, code: string) {
  await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const players = present(await loadPlayers(game.id));
  const ngEngine = await import("@/games/number-guess/engine.server");
  return await ngEngine.rematchNumberGuess(game, players);
}

/* ----------------------------------------------------------- bottle spin actions --- */

async function spinBottleImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const players = present(await loadPlayers(game.id));
  const bsEngine = await import("@/games/bottle-spin/engine.server");
  return await bsEngine.spinBottle(game, players, profile.id);
}

async function chooseBottlePromptImpl(
  sessionToken: string,
  code: string,
  type: "truth" | "dare",
) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const bsEngine = await import("@/games/bottle-spin/engine.server");
  return await bsEngine.chooseBottlePromptType(game, profile.id, type);
}

async function completeBottlePromptImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const bsEngine = await import("@/games/bottle-spin/engine.server");
  return await bsEngine.completeBottlePrompt(game, profile.id);
}

async function skipBottlePromptImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const bsEngine = await import("@/games/bottle-spin/engine.server");
  return await bsEngine.skipBottlePrompt(game, profile.id);
}

/* -------------------------------------------------------- truth or dare actions --- */

async function chooseTruthOrDarePromptImpl(
  sessionToken: string,
  code: string,
  type: "truth" | "dare",
) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const todEngine = await import("@/games/truth-or-dare/engine.server");
  return await todEngine.chooseTruthOrDareType(game, profile.id, type);
}

async function completeTruthOrDarePromptImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const todEngine = await import("@/games/truth-or-dare/engine.server");
  return await todEngine.completeTruthOrDare(game, profile.id);
}

async function skipTruthOrDarePromptImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const todEngine = await import("@/games/truth-or-dare/engine.server");
  return await todEngine.skipTruthOrDare(game, profile.id);
}

/* ---------------------------------------------------------------- chess actions --- */

async function makeChessMoveImpl(
  sessionToken: string,
  code: string,
  from: string,
  to: string,
  promotion?: string,
) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const chessEngine = await import("@/games/chess/engine.server");
  return await chessEngine.makeChessMove(game, profile.id, from, to, promotion);
}

async function resignChessImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const chessEngine = await import("@/games/chess/engine.server");
  await chessEngine.resignChess(game, profile.id);
}

async function rematchChessImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const players = await loadPlayers(game.id);
  const chessEngine = await import("@/games/chess/engine.server");
  return await chessEngine.requestChessRematch(game, players, profile.id);
}

/* ----------------------------------------------------------------- ludo actions --- */

async function rollLudoDiceImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const ludoEngine = await import("@/games/ludo/engine.server");
  return await ludoEngine.rollLudoDice(game, profile.id);
}

async function moveLudoTokenImpl(sessionToken: string, code: string, tokenId: number) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const ludoEngine = await import("@/games/ludo/engine.server");
  return await ludoEngine.moveLudoToken(game, profile.id, tokenId);
}

async function rematchLudoImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.host_id !== profile.id) fail("Only host can restart Ludo match.");
  const players = present(await loadPlayers(game.id));
  const ludoEngine = await import("@/games/ludo/engine.server");
  await ludoEngine.rematchLudo(game, players);
}

/* --------------------------------------------------------------- carrom actions --- */

async function submitCarromShotResultImpl(
  sessionToken: string,
  code: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedCoins: any[],
  strikerFoul: boolean,
) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const carromEngine = await import("@/games/carrom/engine.server");
  return await carromEngine.submitCarromShotResult(game, profile.id, updatedCoins, strikerFoul);
}

async function rematchCarromImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.host_id !== profile.id) fail("Only host can restart Carrom match.");
  const players = present(await loadPlayers(game.id));
  const carromEngine = await import("@/games/carrom/engine.server");
  await carromEngine.rematchCarrom(game, players);
}

/* ---------------------------------------------------- letter-blitz actions --- */

async function submitLetterBlitzGuessImpl(
  sessionToken: string,
  code: string,
  word: string,
) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const lbEngine = await import("@/games/letter-blitz/engine.server");
  return await lbEngine.submitLetterBlitzGuess(game, profile.id, profile.display_name, word);
}

async function advanceLetterBlitzRoundImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.host_id !== profile.id) fail("Only host can advance rounds.");
  const lbEngine = await import("@/games/letter-blitz/engine.server");
  await lbEngine.advanceLetterBlitzRound(game);
}

/* ----------------------------------------------------- doodle-rush actions --- */

async function submitDoodleStrokeImpl(
  sessionToken: string,
  code: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stroke: any,
) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const drEngine = await import("@/games/doodle-rush/engine.server");
  await drEngine.submitDoodleStroke(game, profile.id, stroke);
}

async function submitDoodleGuessImpl(
  sessionToken: string,
  code: string,
  guess: string,
) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const drEngine = await import("@/games/doodle-rush/engine.server");
  return await drEngine.submitDoodleGuess(game, profile.id, profile.display_name, guess);
}

async function clearDoodleCanvasImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  const drEngine = await import("@/games/doodle-rush/engine.server");
  await drEngine.clearDoodleCanvas(game, profile.id);
}

async function advanceDoodleRoundImpl(sessionToken: string, code: string) {
  const profile = await resolveProfile(sessionToken);
  const game = await loadGameByCode(code);
  if (game.host_id !== profile.id) fail("Only host can advance rounds.");
  const drEngine = await import("@/games/doodle-rush/engine.server");
  await drEngine.advanceDoodleRound(game);
}

/* ------------------------------------------------- per-room serialised actions --- */
// Every state-changing action runs one-at-a-time per room (see room-lock.server.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function locked<A extends [string, string, ...any[]], R>(fn: (...args: A) => Promise<R>) {
  return (...args: A): Promise<R> =>
    withRoomLock(args[1], async () => {
      try {
        return await fn(...args);
      } finally {
        notifyRoom(args[1]); // wake the other players' screens right away
      }
    });
}

export const startGame = locked(startGameImpl);
export const confirmCardSeen = locked(confirmCardSeenImpl);
export const submitHint = locked(submitHintImpl);
export const submitVote = locked(submitVoteImpl);
export const playAgain = locked(playAgainImpl);
export const leaveGame = locked(leaveGameImpl);
export const kickPlayer = locked(kickPlayerImpl);
export const updateSettings = locked(updateSettingsImpl);
export const sendWordDuelLetter = locked(sendWordDuelLetterImpl);
export const submitWordDuelWord = locked(submitWordDuelWordImpl);
export const advanceWordDuelRound = locked(advanceWordDuelRoundImpl);
export const rematchWordDuel = locked(rematchWordDuelImpl);
export const lockNumberGuessSecret = locked(lockNumberGuessSecretImpl);
export const submitNumberGuess = locked(submitNumberGuessImpl);
export const advanceNumberGuessRound = locked(advanceNumberGuessRoundImpl);
export const rematchNumberGuess = locked(rematchNumberGuessImpl);
export const spinBottle = locked(spinBottleImpl);
export const chooseBottlePrompt = locked(chooseBottlePromptImpl);
export const completeBottlePrompt = locked(completeBottlePromptImpl);
export const skipBottlePrompt = locked(skipBottlePromptImpl);
export const chooseTruthOrDarePrompt = locked(chooseTruthOrDarePromptImpl);
export const completeTruthOrDarePrompt = locked(completeTruthOrDarePromptImpl);
export const skipTruthOrDarePrompt = locked(skipTruthOrDarePromptImpl);
export const makeChessMove = locked(makeChessMoveImpl);
export const resignChess = locked(resignChessImpl);
export const rematchChess = locked(rematchChessImpl);
export const rollLudoDice = locked(rollLudoDiceImpl);
export const moveLudoToken = locked(moveLudoTokenImpl);
export const rematchLudo = locked(rematchLudoImpl);
export const submitCarromShotResult = locked(submitCarromShotResultImpl);
export const rematchCarrom = locked(rematchCarromImpl);
export const submitLetterBlitzGuess = locked(submitLetterBlitzGuessImpl);
export const advanceLetterBlitzRound = locked(advanceLetterBlitzRoundImpl);
export const submitDoodleStroke = locked(submitDoodleStrokeImpl);
export const submitDoodleGuess = locked(submitDoodleGuessImpl);
export const clearDoodleCanvas = locked(clearDoodleCanvasImpl);
export const advanceDoodleRound = locked(advanceDoodleRoundImpl);
export const joinGame = locked(joinGameImpl);
export const setReady = locked(setReadyImpl);
