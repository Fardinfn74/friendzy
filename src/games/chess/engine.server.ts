import { Chess } from "chess.js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  ChessClientState,
  ChessColor,
  ChessMove,
  ChessPhase,
  ChessServerData,
  ChessSettings,
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

export const DEFAULT_CHESS_SETTINGS: ChessSettings = {
  timedMode: true,
  timePerSide: 300,
  incrementSeconds: 5,
};

const DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function parseChessData(game: AnyGame): ChessServerData {
  const raw = game.game_settings?.["chess"] as Partial<ChessServerData> | undefined;
  if (!raw) {
    return getDefaultServerData();
  }

  const timedMode = raw.settings?.timedMode !== false;
  const timePerSide = ([60, 180, 300, 600] as const).includes(
    raw.settings?.timePerSide as 60 | 180 | 300 | 600,
  )
    ? (raw.settings!.timePerSide as 60 | 180 | 300 | 600)
    : 300;
  const incrementSeconds = ([0, 3, 5] as const).includes(
    raw.settings?.incrementSeconds as 0 | 3 | 5,
  )
    ? (raw.settings!.incrementSeconds as 0 | 3 | 5)
    : 5;

  return {
    settings: { timedMode, timePerSide, incrementSeconds },
    phase: (raw.phase as ChessPhase) ?? "waiting",
    fen: raw.fen ?? DEFAULT_FEN,
    whiteProfileId: raw.whiteProfileId ?? "",
    blackProfileId: raw.blackProfileId ?? "",
    turn: (raw.turn as ChessColor) ?? "w",
    moves: raw.moves ?? [],
    result: raw.result ?? null,
    resultReason: raw.resultReason ?? null,
    whiteTimeMs: raw.whiteTimeMs ?? timePerSide * 1000,
    blackTimeMs: raw.blackTimeMs ?? timePerSide * 1000,
    turnStartedAt: raw.turnStartedAt ?? null,
    winnerId: raw.winnerId ?? null,
    rematchRequested: raw.rematchRequested ?? null,
  };
}

export function getDefaultServerData(customSettings?: Partial<ChessSettings>): ChessServerData {
  const settings: ChessSettings = {
    timedMode: customSettings?.timedMode !== false,
    timePerSide: ([60, 180, 300, 600] as const).includes(
      customSettings?.timePerSide as 60 | 180 | 300 | 600,
    )
      ? (customSettings!.timePerSide as 60 | 180 | 300 | 600)
      : 300,
    incrementSeconds: ([0, 3, 5] as const).includes(customSettings?.incrementSeconds as 0 | 3 | 5)
      ? (customSettings!.incrementSeconds as 0 | 3 | 5)
      : 5,
  };
  return {
    settings,
    phase: "waiting",
    fen: DEFAULT_FEN,
    whiteProfileId: "",
    blackProfileId: "",
    turn: "w",
    moves: [],
    result: null,
    resultReason: null,
    whiteTimeMs: settings.timePerSide * 1000,
    blackTimeMs: settings.timePerSide * 1000,
    turnStartedAt: null,
    winnerId: null,
    rematchRequested: null,
  };
}

export async function saveChessData(gameId: string, data: ChessServerData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentGame } = await (supabaseAdmin.from("games") as any)
    .select("game_settings")
    .eq("id", gameId)
    .single();

  const currentSettings = (currentGame?.game_settings as Record<string, unknown>) || {};
  const updatedSettings = { ...currentSettings, chess: data };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({ game_settings: updatedSettings })
    .eq("id", gameId);
}

export async function startChessMatch(game: AnyGame, players: AnyPlayer[]) {
  if (players.length !== 2) throw new Error("Chess requires exactly 2 players.");

  const existingSettings = (game.game_settings?.["chess"] as Partial<ChessServerData>)?.settings;
  const data = getDefaultServerData(existingSettings);

  // Random color assignment
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  data.whiteProfileId = shuffled[0]!.profile_id;
  data.blackProfileId = shuffled[1]!.profile_id;
  data.phase = "playing";
  data.turnStartedAt = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({
      status: "hint",
      game_settings: {
        ...(game.game_settings || {}),
        chess: data,
      },
    })
    .eq("id", game.id);
}

export async function syncChessState(
  game: AnyGame,
  _players: AnyPlayer[],
  myProfileId: string,
): Promise<ChessClientState> {
  const data = parseChessData(game);

  // Clock management: deduct elapsed time from the current player's clock
  let { whiteTimeMs, blackTimeMs } = data;
  if (data.phase === "playing" && data.turnStartedAt && data.settings.timedMode) {
    const elapsed = Date.now() - data.turnStartedAt;
    if (data.turn === "w") {
      whiteTimeMs = Math.max(0, data.whiteTimeMs - elapsed);
    } else {
      blackTimeMs = Math.max(0, data.blackTimeMs - elapsed);
    }

    // Check timeout
    if ((data.turn === "w" && whiteTimeMs <= 0) || (data.turn === "b" && blackTimeMs <= 0)) {
      const loser = data.turn;
      const winner = loser === "w" ? data.blackProfileId : data.whiteProfileId;
      data.result = loser === "w" ? "black" : "white";
      data.resultReason = "timeout";
      data.winnerId = winner;
      data.phase = "ended";
      await saveChessData(game.id, data);
    }
  }

  const chess = new Chess(data.fen);
  const inCheck = chess.inCheck();

  const myColor =
    data.whiteProfileId === myProfileId ? "w" : data.blackProfileId === myProfileId ? "b" : null;

  return {
    settings: data.settings,
    phase: data.phase,
    fen: data.fen,
    whiteProfileId: data.whiteProfileId,
    blackProfileId: data.blackProfileId,
    myColor,
    turn: data.turn,
    moves: data.moves,
    result: data.result,
    resultReason: data.resultReason,
    whiteTimeMs,
    blackTimeMs,
    turnStartedAt: data.turnStartedAt,
    winnerId: data.winnerId,
    rematchRequested: data.rematchRequested,
    isMyTurn: myColor !== null && data.turn === myColor && data.phase === "playing",
    inCheck,
  };
}

export async function makeChessMove(
  game: AnyGame,
  profileId: string,
  from: string,
  to: string,
  promotion?: string,
) {
  const data = parseChessData(game);
  if (data.phase !== "playing") throw new Error("Game is not in progress.");

  const myColor =
    data.whiteProfileId === profileId ? "w" : data.blackProfileId === profileId ? "b" : null;

  if (!myColor) throw new Error("You are not a player in this game.");
  if (data.turn !== myColor) throw new Error("It is not your turn.");

  const chess = new Chess(data.fen);

  // Deduct clock time and apply increment
  const now = Date.now();
  if (data.settings.timedMode && data.turnStartedAt) {
    const elapsed = now - data.turnStartedAt;
    if (myColor === "w") {
      data.whiteTimeMs = Math.max(
        0,
        data.whiteTimeMs - elapsed + data.settings.incrementSeconds * 1000,
      );
    } else {
      data.blackTimeMs = Math.max(
        0,
        data.blackTimeMs - elapsed + data.settings.incrementSeconds * 1000,
      );
    }
  }

  let result;
  try {
    result = chess.move({ from, to, promotion: promotion ?? "q" });
  } catch {
    throw new Error("Invalid move.");
  }

  const move: ChessMove = {
    from: result.from,
    to: result.to,
    piece: result.piece,
    color: result.color,
    san: result.san,
    captured: result.captured,
    promotion: result.promotion,
    ts: now,
  };

  data.fen = chess.fen();
  data.turn = chess.turn() as ChessColor;
  data.moves = [...data.moves, move];
  data.turnStartedAt = now;

  // Check end conditions
  if (chess.isGameOver()) {
    data.phase = "ended";
    if (chess.isCheckmate()) {
      // The color that just moved won
      data.result = myColor === "w" ? "white" : "black";
      data.resultReason = "checkmate";
      data.winnerId = profileId;
    } else if (chess.isStalemate() || chess.isDraw()) {
      data.result = "draw";
      data.resultReason = chess.isStalemate() ? "stalemate" : "draw";
    }
  }

  await saveChessData(game.id, data);
  return { move, fen: data.fen };
}

export async function resignChess(game: AnyGame, profileId: string) {
  const data = parseChessData(game);
  if (data.phase !== "playing") throw new Error("Game is not in progress.");

  const myColor =
    data.whiteProfileId === profileId ? "w" : data.blackProfileId === profileId ? "b" : null;

  if (!myColor) throw new Error("You are not a player in this game.");

  data.phase = "ended";
  data.result = myColor === "w" ? "black" : "white";
  data.resultReason = "resignation";
  data.winnerId = myColor === "w" ? data.blackProfileId : data.whiteProfileId;

  await saveChessData(game.id, data);
}

export async function requestChessRematch(game: AnyGame, players: AnyPlayer[], profileId: string) {
  const data = parseChessData(game);
  if (data.phase !== "ended") throw new Error("Game has not ended yet.");

  if (data.rematchRequested === null) {
    data.rematchRequested = profileId;
    await saveChessData(game.id, data);
    return { waiting: true };
  }

  if (data.rematchRequested === profileId) {
    return { waiting: true };
  }

  // Both requested — start a new game with swapped colors
  const newData = getDefaultServerData(data.settings);
  newData.whiteProfileId = data.blackProfileId;
  newData.blackProfileId = data.whiteProfileId;
  newData.phase = "playing";
  newData.turnStartedAt = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({
      status: "hint",
      game_settings: {
        ...(game.game_settings || {}),
        chess: newData,
      },
    })
    .eq("id", game.id);

  return { waiting: false };
}
