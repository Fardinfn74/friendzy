import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { GameState } from "./game-types";

const token = z.string().min(10).max(80);
const code = z.string().min(4).max(8);

const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Messages written for players pass through; unexpected crashes (TypeError etc.) never leak internals. */
function publicMessage(error: unknown): string {
  if (!(error instanceof Error)) return GENERIC_ERROR;
  if (
    error instanceof TypeError ||
    error instanceof ReferenceError ||
    error instanceof RangeError ||
    error instanceof SyntaxError
  ) {
    console.error("[server]", error);
    return GENERIC_ERROR;
  }
  return error.message || GENERIC_ERROR;
}

function failResult(error: unknown): { ok: false; error: string } {
  return { ok: false, error: publicMessage(error) };
}

function wrap(error: unknown): never {
  throw new Error(publicMessage(error));
}

export const saveProfile = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        sessionToken: token,
        displayName: z.string().max(40),
        avatarId: z.string().regex(/^[a-z0-9_-]{1,24}$/),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      (await import("./rate-limit.server")).rateLimit("save-profile", 30, 60_000);
      const profile = await engine.upsertProfile(data);
      return { displayName: profile.display_name, avatarId: profile.avatar_id };
    } catch (error) {
      return failResult(error);
    }
  });

export const createGameFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        sessionToken: token,
        gameType: z
          .enum([
            "imposter",
            "word-duel",
            "number-guess",
            "truth-or-dare",
            "chess",
            "ludo",
            "carrom",
            "letter-blitz",
            "doodle-rush",
          ])
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      (await import("./rate-limit.server")).rateLimit("create-game", 20, 60_000);
      return await engine.createGame(data.sessionToken, data.gameType ?? "imposter");
    } catch (error) {
      return failResult(error);
    }
  });

export const joinGameFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      (await import("./rate-limit.server")).rateLimit("join-game", 60, 60_000);
      return await engine.joinGame(data.sessionToken, data.code);
    } catch (error) {
      return failResult(error);
    }
  });

export const getStateFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }): Promise<GameState> => {
    const engine = await import("./game-engine.server");
    try {
      return await engine.getState(data.sessionToken, data.code);
    } catch (error) {
      wrap(error);
    }
  });

export const setReadyFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code, ready: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.setReady(data.sessionToken, data.code, data.ready);
      return { ok: true };
    } catch (error) {
      return failResult(error);
    }
  });

export const updateSettingsFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        sessionToken: token,
        code,
        mode: z.enum(["classic", "double"]).optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        imposterCount: z.number().int().min(1).max(3).optional(),
        maxPlayers: z.number().int().min(2).max(12).optional(),
        wordDuelSettings: z
          .object({
            rounds: z.union([z.literal(3), z.literal(5), z.literal(7)]).optional(),
            roundTime: z.union([z.literal(20), z.literal(30), z.literal(45)]).optional(),
          })
          .optional(),
        numberGuessSettings: z
          .object({
            range: z.enum(["1-50", "1-100", "1-500"]).optional(),
            hints: z.boolean().optional(),
            rounds: z.union([z.literal(3), z.literal(5)]).optional(),
          })
          .optional(),
        truthOrDareSettings: z
          .object({
            promptLevel: z.enum(["All", "Chill", "Funny", "Wild"]).optional(),
            customPrompts: z
              .array(
                z.object({
                  id: z.string().max(40),
                  type: z.enum(["truth", "dare"]),
                  level: z.enum(["Chill", "Funny", "Wild"]),
                  text: z.string().trim().max(200),
                }),
              )
              .max(40)
              .optional(),
          })
          .optional(),
        chessSettings: z
          .object({
            timedMode: z.boolean().optional(),
            timePerSide: z
              .union([z.literal(60), z.literal(180), z.literal(300), z.literal(600)])
              .optional(),
            incrementSeconds: z.union([z.literal(0), z.literal(3), z.literal(5)]).optional(),
          })
          .optional(),
        ludoSettings: z
          .object({
            tokensPerPlayer: z.union([z.literal(2), z.literal(4)]).optional(),
          })
          .optional(),
        carromSettings: z
          .object({
            boardMode: z.enum(["fast", "classic"]).optional(),
            targetScore: z.union([z.literal(15), z.literal(25)]).optional(),
          })
          .optional(),
        letterBlitzSettings: z
          .object({
            rounds: z.number().int().min(1).max(10).optional(),
            roundTime: z.number().int().min(15).max(120).optional(),
          })
          .optional(),
        doodleRushSettings: z
          .object({
            rounds: z.number().int().min(1).max(10).optional(),
            drawTime: z.union([z.literal(0), z.number().int().min(30).max(180)]).optional(),
          })
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    const { sessionToken, code: gameCode, ...settings } = data;
    try {
      await engine.updateSettings(sessionToken, gameCode, settings);
      return { ok: true };
    } catch (error) {
      return failResult(error);
    }
  });

export const kickPlayerFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ sessionToken: token, code, targetProfileId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.kickPlayer(data.sessionToken, data.code, data.targetProfileId);
      return { ok: true };
    } catch (error) {
      return failResult(error);
    }
  });

export const startGameFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.startGame(data.sessionToken, data.code);
      return { ok: true };
    } catch (error) {
      return failResult(error);
    }
  });

export const confirmCardFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.confirmCardSeen(data.sessionToken, data.code);
      return { ok: true };
    } catch (error) {
      return failResult(error);
    }
  });

export const submitHintFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ sessionToken: token, code, message: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.submitHint(data.sessionToken, data.code, data.message);
      return { ok: true };
    } catch (error) {
      return failResult(error);
    }
  });

export const submitVoteFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        sessionToken: token,
        code,
        targetIds: z.array(z.string().uuid()).max(3),
        replay: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.submitVote(data.sessionToken, data.code, {
        targetIds: data.targetIds,
        replay: data.replay,
      });
      return { ok: true };
    } catch (error) {
      return failResult(error);
    }
  });

export const playAgainFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.playAgain(data.sessionToken, data.code);
      return { ok: true };
    } catch (error) {
      return failResult(error);
    }
  });

export const leaveGameFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.leaveGame(data.sessionToken, data.code);
      return { ok: true };
    } catch (error) {
      return failResult(error);
    }
  });

export const generateThemeWordFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ sessionToken: token, code, theme: z.string().trim().min(2).max(60) }).parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    const ai = await import("./ai-word.server");
    try {
      (await import("./rate-limit.server")).rateLimit("ai-theme", 6, 60_000);
      const difficulty = await engine.assertHostInLobby(data.sessionToken, data.code);
      const { word, category } = await ai.generateThemedWord(data.theme, difficulty);
      await engine.setAiWord(data.sessionToken, data.code, data.theme, word, category);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

export const sendWordDuelLetterFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        sessionToken: token,
        code,
        letter: z.string().length(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.sendWordDuelLetter(data.sessionToken, data.code, data.letter);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

export const submitWordDuelWordFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        sessionToken: token,
        code,
        word: z.string().min(1).max(50),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      const res = await engine.submitWordDuelWord(data.sessionToken, data.code, data.word);
      return res;
    } catch (error) {
      return failResult(error);
    }
  });

export const advanceWordDuelRoundFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.advanceWordDuelRound(data.sessionToken, data.code);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

export const rematchWordDuelFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.rematchWordDuel(data.sessionToken, data.code);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

export const lockNumberGuessFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        sessionToken: token,
        code,
        number: z.number().int().min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.lockNumberGuessSecret(data.sessionToken, data.code, data.number);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

export const submitNumberGuessFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        sessionToken: token,
        code,
        targetId: z.string().uuid(),
        guess: z.number().int().min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      const res = await engine.submitNumberGuess(
        data.sessionToken,
        data.code,
        data.targetId,
        data.guess,
      );
      return res;
    } catch (error) {
      return failResult(error);
    }
  });

export const advanceNumberGuessRoundFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.advanceNumberGuessRound(data.sessionToken, data.code);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

export const rematchNumberGuessFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.rematchNumberGuess(data.sessionToken, data.code);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

/* -------------------------------------------------------- truth or dare functions --- */

export const chooseTruthOrDarePromptFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ sessionToken: token, code, type: z.enum(["truth", "dare"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      const res = await engine.chooseTruthOrDarePrompt(data.sessionToken, data.code, data.type);
      return res;
    } catch (error) {
      return failResult(error);
    }
  });

export const completeTruthOrDarePromptFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.completeTruthOrDarePrompt(data.sessionToken, data.code);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

export const skipTruthOrDarePromptFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      const res = await engine.skipTruthOrDarePrompt(data.sessionToken, data.code);
      return res;
    } catch (error) {
      return failResult(error);
    }
  });

/* ------------------------------------------------------------- chess functions --- */

export const makeChessMoveFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        sessionToken: token,
        code,
        from: z.string().min(2).max(2),
        to: z.string().min(2).max(2),
        promotion: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      const res = await engine.makeChessMove(
        data.sessionToken,
        data.code,
        data.from,
        data.to,
        data.promotion,
      );
      return res;
    } catch (error) {
      return failResult(error);
    }
  });

export const resignChessFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.resignChess(data.sessionToken, data.code);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

export const rematchChessFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      const res = await engine.rematchChess(data.sessionToken, data.code);
      return res;
    } catch (error) {
      return failResult(error);
    }
  });

/* -------------------------------------------------------------- ludo functions --- */

export const rollLudoDiceFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      const res = await engine.rollLudoDice(data.sessionToken, data.code);
      return res;
    } catch (error) {
      return failResult(error);
    }
  });

export const moveLudoTokenFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        sessionToken: token,
        code,
        tokenId: z.number().int().min(0).max(3),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.moveLudoToken(data.sessionToken, data.code, data.tokenId);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

export const rematchLudoFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.rematchLudo(data.sessionToken, data.code);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

/* ------------------------------------------------------------ carrom functions --- */

export const submitCarromShotResultFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        sessionToken: token,
        code,
        updatedCoins: z.array(z.any()),
        strikerFoul: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.submitCarromShotResult(
        data.sessionToken,
        data.code,
        data.updatedCoins,
        data.strikerFoul,
      );
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

export const rematchCarromFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.rematchCarrom(data.sessionToken, data.code);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

/* --------------------------------------------------- letter-blitz functions --- */

export const submitLetterBlitzGuessFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ sessionToken: token, code, word: z.string().min(1).max(50) }).parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      return await engine.submitLetterBlitzGuess(data.sessionToken, data.code, data.word);
    } catch (error) {
      return failResult(error);
    }
  });

export const advanceLetterBlitzRoundFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.advanceLetterBlitzRound(data.sessionToken, data.code);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

/* ---------------------------------------------------- doodle-rush functions --- */

// Size limits are enforced here AND again in the engine, so one oversized request can't fill the database.
const strokeSchema = z.object({
  x: z.array(z.number()).max(1500),
  y: z.array(z.number()).max(1500),
  color: z.string().max(9),
  size: z.number().min(1).max(40),
  tool: z.enum(["pen", "eraser"]),
});

/** The artist saves their picture (the whole canvas, replacing the previous snapshot). */
export const pushDoodleCanvasFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ sessionToken: token, code, strokes: z.array(strokeSchema).max(400) }).parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      const res = await engine.pushDoodleCanvas(data.sessionToken, data.code, data.strokes);
      return { ok: true as const, seq: res.seq };
    } catch (error) {
      return failResult(error);
    }
  });

/** Guessers fetch the current picture (on joining, after a refresh, or when a live update was missed). */
export const getDoodleCanvasFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      return { ok: true as const, ...(await engine.getDoodleCanvas(data.sessionToken, data.code)) };
    } catch (error) {
      return failResult(error);
    }
  });

/** The artist (or the host) gives up on a drawing nobody can guess. */
export const endDoodleRoundFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.endDoodleRound(data.sessionToken, data.code);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });

export const submitDoodleGuessFn = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ sessionToken: token, code, guess: z.string().min(1).max(60) }).parse(data),
  )
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      return await engine.submitDoodleGuess(data.sessionToken, data.code, data.guess);
    } catch (error) {
      return failResult(error);
    }
  });

export const advanceDoodleRoundFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ sessionToken: token, code }).parse(data))
  .handler(async ({ data }) => {
    const engine = await import("./game-engine.server");
    try {
      await engine.advanceDoodleRound(data.sessionToken, data.code);
      return { ok: true as const };
    } catch (error) {
      return failResult(error);
    }
  });
