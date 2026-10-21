import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  LudoClientState,
  LudoColor,
  LudoPlayer,
  LudoServerData,
  LudoSettings,
  LudoToken,
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

export const COLOR_ORDER: LudoColor[] = ["red", "green", "yellow", "blue"];

export const COLOR_START_OFFSETS: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

export const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const DEFAULT_LUDO_SETTINGS: LudoSettings = {
  tokensPerPlayer: 4,
};

export function getDefaultServerData(customSettings?: Partial<LudoSettings>): LudoServerData {
  const settings: LudoSettings = {
    tokensPerPlayer: customSettings?.tokensPerPlayer === 2 ? 2 : 4,
  };
  return {
    settings,
    phase: "rolling",
    players: [],
    currentTurnColor: "red",
    diceValue: null,
    hasRolledSix: false,
    consecutiveSixes: 0,
    winnerId: null,
    ranking: [],
    lastActionText: "Roll the dice to start!",
    rematchRequested: null,
  };
}

export function parseLudoData(game: AnyGame): LudoServerData {
  const raw = game.game_settings?.["ludo"] as Partial<LudoServerData> | undefined;
  if (!raw) return getDefaultServerData();

  return {
    settings: {
      tokensPerPlayer: raw.settings?.tokensPerPlayer === 2 ? 2 : 4,
    },
    phase: raw.phase ?? "rolling",
    players: raw.players ?? [],
    currentTurnColor: raw.currentTurnColor ?? "red",
    diceValue: raw.diceValue ?? null,
    hasRolledSix: raw.hasRolledSix ?? false,
    consecutiveSixes: raw.consecutiveSixes ?? 0,
    winnerId: raw.winnerId ?? null,
    ranking: raw.ranking ?? [],
    lastActionText: raw.lastActionText ?? null,
    rematchRequested: raw.rematchRequested ?? null,
  };
}

export async function saveLudoData(gameId: string, data: LudoServerData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentGame } = await (supabaseAdmin.from("games") as any)
    .select("game_settings")
    .eq("id", gameId)
    .single();

  const currentSettings = (currentGame?.game_settings as Record<string, unknown>) || {};
  const updatedSettings = { ...currentSettings, ludo: data };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({ game_settings: updatedSettings })
    .eq("id", gameId);
}

export async function startLudoMatch(game: AnyGame, players: AnyPlayer[]) {
  if (players.length < 2 || players.length > 4) {
    throw new Error("Ludo requires 2 to 4 players.");
  }

  const existingSettings = (game.game_settings?.["ludo"] as Partial<LudoServerData>)?.settings;
  const data = getDefaultServerData(existingSettings);

  const tokensCount = data.settings.tokensPerPlayer;

  // Assign colors in order
  data.players = players.map((p, idx) => {
    const color = COLOR_ORDER[idx]!;
    const tokens: LudoToken[] = Array.from({ length: tokensCount }, (_, tid) => ({
      id: tid,
      color,
      step: -1,
      hasFinished: false,
    }));
    return {
      profileId: p.profile_id,
      color,
      tokens,
      rank: null,
    };
  });

  data.currentTurnColor = data.players[0]!.color;
  data.phase = "rolling";
  data.lastActionText = "Game started! Red rolls first.";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({
      status: "hint",
      game_settings: {
        ...(game.game_settings || {}),
        ludo: data,
      },
    })
    .eq("id", game.id);
}

function getValidMoves(player: LudoPlayer, dice: number): number[] {
  const valid: number[] = [];
  for (const token of player.tokens) {
    if (token.hasFinished) continue;

    // In yard: needs a 6 to enter
    if (token.step === -1) {
      if (dice === 6) valid.push(token.id);
    } else {
      // On track or home stretch: step + dice must not exceed 57
      if (token.step + dice <= 57) {
        valid.push(token.id);
      }
    }
  }
  return valid;
}

function advanceTurn(data: LudoServerData) {
  const activePlayers = data.players.filter((p) => p.rank === null);
  if (activePlayers.length <= 1) {
    data.phase = "ended";
    return;
  }

  const currentIndex = data.players.findIndex((p) => p.color === data.currentTurnColor);
  for (let i = 1; i <= data.players.length; i++) {
    const nextIdx = (currentIndex + i) % data.players.length;
    const nextPlayer = data.players[nextIdx]!;
    if (nextPlayer.rank === null) {
      data.currentTurnColor = nextPlayer.color;
      break;
    }
  }

  data.phase = "rolling";
  data.diceValue = null;
  data.consecutiveSixes = 0;
}

export async function rollLudoDice(game: AnyGame, profileId: string) {
  const data = parseLudoData(game);
  if (data.phase !== "rolling") throw new Error("Not in rolling phase.");

  const currentPlayer = data.players.find((p) => p.color === data.currentTurnColor);
  if (!currentPlayer || currentPlayer.profileId !== profileId) {
    throw new Error("It is not your turn to roll.");
  }

  // Roll 1 to 6
  const roll = Math.floor(Math.random() * 6) + 1;
  data.diceValue = roll;

  if (roll === 6) {
    data.consecutiveSixes += 1;
  } else {
    data.consecutiveSixes = 0;
  }

  // 3 consecutive sixes penalty: turn forfeited
  if (data.consecutiveSixes >= 3) {
    data.lastActionText = `${currentPlayer.color.toUpperCase()} rolled 3 consecutive sixes! Turn lost.`;
    advanceTurn(data);
    await saveLudoData(game.id, data);
    return { diceValue: roll, validMoves: [] };
  }

  const validMoves = getValidMoves(currentPlayer, roll);

  if (validMoves.length === 0) {
    data.lastActionText = `${currentPlayer.color.toUpperCase()} rolled a ${roll}. No valid moves!`;
    advanceTurn(data);
  } else if (
    validMoves.length === 1 &&
    currentPlayer.tokens.find((t) => t.id === validMoves[0])?.step === -1 &&
    roll === 6
  ) {
    // If only one token can leave the yard, we can let user click or auto-move
    data.phase = "moving";
    data.lastActionText = `${currentPlayer.color.toUpperCase()} rolled a ${roll}! Tap your token to move.`;
  } else {
    data.phase = "moving";
    data.lastActionText = `${currentPlayer.color.toUpperCase()} rolled a ${roll}! Pick a token to move.`;
  }

  await saveLudoData(game.id, data);
  return { diceValue: roll, validMoves };
}

export async function moveLudoToken(game: AnyGame, profileId: string, tokenId: number) {
  const data = parseLudoData(game);
  if (data.phase !== "moving" || data.diceValue === null) {
    throw new Error("Not ready to move a token.");
  }

  const currentPlayer = data.players.find((p) => p.color === data.currentTurnColor);
  if (!currentPlayer || currentPlayer.profileId !== profileId) {
    throw new Error("It is not your turn.");
  }

  const token = currentPlayer.tokens.find((t) => t.id === tokenId);
  if (!token) throw new Error("Token not found.");

  const roll = data.diceValue;
  const validMoves = getValidMoves(currentPlayer, roll);
  if (!validMoves.includes(tokenId)) {
    throw new Error("Invalid move for this token.");
  }

  let capturedOpponent = false;

  if (token.step === -1) {
    // Moving out of yard to start square
    token.step = 0;
  } else {
    token.step += roll;
    if (token.step === 57) {
      token.hasFinished = true;
    }
  }

  // Check capture if on common track (0 to 50)
  if (token.step >= 0 && token.step <= 50) {
    const myOffset = COLOR_START_OFFSETS[currentPlayer.color];
    const myTrackIndex = (myOffset + token.step) % 52;

    if (!SAFE_SQUARES.has(myTrackIndex)) {
      // Check all other players' tokens
      for (const otherPlayer of data.players) {
        if (otherPlayer.color === currentPlayer.color) continue;
        const otherOffset = COLOR_START_OFFSETS[otherPlayer.color];

        for (const otherToken of otherPlayer.tokens) {
          if (otherToken.step >= 0 && otherToken.step <= 50) {
            const otherTrackIndex = (otherOffset + otherToken.step) % 52;
            if (otherTrackIndex === myTrackIndex) {
              // Captured!
              otherToken.step = -1;
              capturedOpponent = true;
            }
          }
        }
      }
    }
  }

  // Check if current player just finished all tokens
  const allFinished = currentPlayer.tokens.every((t) => t.hasFinished);
  if (allFinished && currentPlayer.rank === null) {
    const currentFinishedCount = data.players.filter((p) => p.rank !== null).length;
    currentPlayer.rank = currentFinishedCount + 1;
    data.ranking.push(currentPlayer.profileId);
    if (!data.winnerId) {
      data.winnerId = currentPlayer.profileId;
    }
  }

  // Extra turn if rolled 6 or captured opponent
  const getsBonusRoll = (roll === 6 || capturedOpponent) && currentPlayer.rank === null;

  if (getsBonusRoll) {
    data.phase = "rolling";
    data.diceValue = null;
    data.lastActionText = capturedOpponent
      ? `💥 Captured opponent token! Bonus roll for ${currentPlayer.color.toUpperCase()}!`
      : `🎲 Rolled a 6! Bonus roll for ${currentPlayer.color.toUpperCase()}!`;
  } else {
    advanceTurn(data);
  }

  // Check if game completely ended
  const unfinishedPlayers = data.players.filter((p) => p.rank === null);
  if (unfinishedPlayers.length <= 1) {
    data.phase = "ended";
    if (unfinishedPlayers.length === 1) {
      const last = unfinishedPlayers[0]!;
      last.rank = data.players.length;
      data.ranking.push(last.profileId);
    }
  }

  await saveLudoData(game.id, data);
}

export async function syncLudoState(
  game: AnyGame,
  _players: AnyPlayer[],
  myProfileId: string,
): Promise<LudoClientState> {
  const data = parseLudoData(game);
  const myPlayer = data.players.find((p) => p.profileId === myProfileId);
  const isMyTurn =
    myPlayer !== undefined && myPlayer.color === data.currentTurnColor && data.phase !== "ended";

  const validTokenMoves =
    isMyTurn && data.phase === "moving" && data.diceValue !== null
      ? getValidMoves(myPlayer, data.diceValue)
      : [];

  return {
    settings: data.settings,
    phase: data.phase,
    players: data.players,
    currentTurnColor: data.currentTurnColor,
    diceValue: data.diceValue,
    isMyTurn,
    myColor: myPlayer?.color ?? null,
    validTokenMoves,
    winnerId: data.winnerId,
    ranking: data.ranking,
    lastActionText: data.lastActionText,
    rematchRequested: data.rematchRequested,
  };
}

export async function rematchLudo(game: AnyGame, players: AnyPlayer[]) {
  await startLudoMatch(game, players);
}

/** A player left: pass the turn on if it was theirs, remove their tokens, end the game if <2 remain. */
export async function handleLudoPlayerLeft(game: AnyGame, leaverId: string) {
  const data = parseLudoData(game);
  if (data.phase === "ended") return;
  const idx = data.players.findIndex((p) => p.profileId === leaverId);
  if (idx === -1) return;
  const leaver = data.players[idx]!;
  if (leaver.rank !== null) return; // already finished: nothing to settle

  if (data.currentTurnColor === leaver.color) {
    for (let i = 1; i < data.players.length; i++) {
      const next = data.players[(idx + i) % data.players.length]!;
      if (next.rank === null) {
        data.currentTurnColor = next.color;
        break;
      }
    }
    data.phase = "rolling";
    data.diceValue = null;
    data.consecutiveSixes = 0;
  }
  data.players.splice(idx, 1);
  data.lastActionText = `${leaver.color.toUpperCase()} left the game.`;

  const unfinished = data.players.filter((p) => p.rank === null);
  if (unfinished.length <= 1) {
    data.phase = "ended";
    const last = unfinished[0];
    if (last) {
      last.rank = data.players.filter((p) => p.rank !== null).length + 1;
      data.ranking.push(last.profileId);
      if (!data.winnerId) data.winnerId = last.profileId;
    }
  }
  await saveLudoData(game.id, data);
}
