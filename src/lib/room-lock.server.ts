/**
 * Serialises state-changing actions per room within one server process.
 *
 * Game state lives in one JSON column, and every action is read -> change -> write. Without this,
 * two players acting in the same instant (both pressing Send, both guessing, both typing a word)
 * can overwrite each other and one action silently disappears.
 *
 * Only short mutating actions take the lock; the 1-second state polling does not, so polls can never queue up.
 */
const tails = new Map<string, Promise<void>>();
const MAX_WAIT_MS = 8000;

export async function withRoomLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const key = code.trim().toUpperCase();
  const prev = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = prev.then(() => mine);
  tails.set(key, tail);

  // Never wait forever behind a request that got stuck (e.g. a hung database call).
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    prev,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, MAX_WAIT_MS);
    }),
  ]);
  if (timer) clearTimeout(timer);

  try {
    return await fn();
  } finally {
    release();
    if (tails.get(key) === tail) tails.delete(key);
  }
}
