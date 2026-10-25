import { type Dieline, type Vec2 } from "./box";
import type { MascotSpec } from "./mascot";
import { traceCells } from "./pixels";

// The mascot's mood lives in its eyes: a separate relief piece (white
// foamy or doubled board) that sits on the black screen and swaps out.
//
// Every face is drawn on the same 15 × 4 pixel grid, and every eye covers
// the two ANCHOR cells. That's where the magnets go, so one pair of magnets
// in the body holds any face.

export type FaceId = "focused" | "curious" | "happy" | "chill";

/** Row/col of the magnet cells, shared by every face. */
export const ANCHORS: [number, number][] = [
  [1, 4],
  [1, 10],
];

/** `#` = eye. Both eyes mirror around the centre column. */
export const FACES: Record<FaceId, { label: string; grid: string[] }> = {
  focused: {
    label: "Focused",
    grid: ["....##...##....", "....##...##....", "....##...##....", "....##...##...."],
  },
  curious: {
    label: "Curious",
    grid: ["...............", "....##...##....", "....##...##....", "..............."],
  },
  happy: {
    label: "Happy",
    grid: ["...............", "...####.####...", "...#..#.#..#...", "..............."],
  },
  chill: {
    label: "Chill",
    grid: ["...............", "...####.####...", "...............", "..............."],
  },
};

export const FACE_IDS = Object.keys(FACES) as FaceId[];

export type FacePiece = {
  id: FaceId;
  dieline: Dieline;
  /** Outlines of each eye, in front-wall coordinates (mm). */
  loops: Vec2[][];
  px: number;
};

/** Grid cell → front-wall millimetres. */
export function cellOrigin(spec: MascotSpec, bodyHeight: number) {
  const { left, top, px } = spec.faceGrid;
  const y0 = bodyHeight - top;
  return {
    px,
    point: ([x, y]: Vec2): Vec2 => [left + x * px, y0 + y * px],
    cell: (r: number, c: number): Vec2 => [left + c * px, y0 - (r + 1) * px],
  };
}

export function facePiece(id: FaceId, spec: MascotSpec, bodyHeight: number): FacePiece {
  const { grid } = FACES[id];
  const { px, point } = cellOrigin(spec, bodyHeight);
  const loops = traceCells(grid, (ch) => ch !== ".").map((loop) => loop.map(point));
  const all = loops.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  return {
    id,
    loops,
    px,
    dieline: {
      cut: loops[0],
      // The other eye (and any other island) is cut alongside.
      holes: loops.slice(1),
      creases: [],
      bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
    },
  };
}
