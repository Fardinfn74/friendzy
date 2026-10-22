import type { LudoColor } from "./types";

/*
 * Shared Ludo board geometry. A step is:
 *   -1 = still in the yard, 0..51 = main track, 52..56 = home column, 57 = finished.
 * Cells are [row, column] on a 15x15 grid (row 0 at the top).
 */

// 52 common track squares coordinates: [row, col] on a 15x15 grid
export const TRACK_COORDS: [number, number][] = [
  /* 0 - 4: Red arm out */
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  /* 5 - 10: Up to top */
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  /* 11 - 12: Across top */
  [0, 7],
  [0, 8],
  /* 13 - 17: Down green arm */
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  /* 18 - 23: Right into yellow arm */
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  /* 24 - 25: Across right edge */
  [7, 14],
  [8, 14],
  /* 26 - 30: Left along yellow arm */
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  /* 31 - 36: Down along bottom arm */
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  /* 37 - 38: Across bottom edge */
  [14, 7],
  [14, 6],
  /* 39 - 43: Up along blue arm */
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  /* 44 - 49: Left into red arm */
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  /* 50 - 51: Turn into red entrance */
  [7, 0],
  [6, 0],
];

// Home stretch columns (steps 52-56)
export const HOME_STRETCH_COORDS: Record<LudoColor, [number, number][]> = {
  red: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
  green: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  yellow: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
  blue: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
};

// Yard positions for tokens (step = -1)
export const YARD_COORDS: Record<LudoColor, [number, number][]> = {
  red: [
    [2, 2],
    [2, 3],
    [3, 2],
    [3, 3],
  ],
  green: [
    [2, 11],
    [2, 12],
    [3, 11],
    [3, 12],
  ],
  yellow: [
    [11, 11],
    [11, 12],
    [12, 11],
    [12, 12],
  ],
  blue: [
    [11, 2],
    [11, 3],
    [12, 2],
    [12, 3],
  ],
};


export const COLOR_START_OFFSETS: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

export const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Where a token stands on the 15x15 grid. */
export function getTokenCoords(color: LudoColor, step: number, id: number): [number, number] {
  if (step === -1) return YARD_COORDS[color][id] ?? [7, 7];
  if (step >= 57) return [7, 7]; // home centre
  if (step >= 52) return HOME_STRETCH_COORDS[color][step - 52] ?? [7, 7];
  const trackIdx = (COLOR_START_OFFSETS[color] + step) % 52;
  return TRACK_COORDS[trackIdx] ?? [7, 7];
}
