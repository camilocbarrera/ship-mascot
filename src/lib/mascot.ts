import { rectPoly, type BoxParams, type LayoutOptions, type Vec2 } from "./box";
import { traceCells } from "./pixels";

// The Ship mascot as a wearable costume: a pixel browser window, worn from
// just above the head to the hips, open at the bottom. Your legs are its
// legs; curly-brace arms stand off the sides.
//
//          ║ ║ ║ ║ ║ ║                    ← breathing vents in the top flaps
//        ┌──────────────────────┐         ← 40 mm head clearance
//        │■ ■ ■ title bar       │
//        │┌────────────────────┐│
//   ▄▀   ││   [   eye slit   ]  ││  ▀▄     ← slit hidden in the black screen (black mesh)
//  ▀▄    ││     ██      ██      ││    ▄▀   ← eyes: a swappable white relief piece
//   ▀▄   ││     ██      ██      ││   ▄▀    ← { } braces glued to the side walls
//        │└────────────────────┘│
//        └───╯ door ╰───────────┘         ← arm doors up from the hem, hinged at the top
//              ║    ║                     ← your legs, in grey
//             ▄▀    ▀▄

/** The mascot's palette, sampled from the pixel art. */
export const FRAME = "#4a4a4a";
export const SIDE = "#3a3a3a";
export const SCREEN = "#0a0a0a";
export const EYE = "#f2f2f2";

const HEAD_CLEARANCE = 40;

/** Columns of the eye grid across the screen (see faces.ts). */
const FACE_COLS = 15;
const FACE_ROWS = 4;

/**
 * The `{` arm on a pixel grid, one pixel thin like the art; `}` is its mirror.
 * Steps share an edge (no corner-only joins) so it cuts as one piece.
 */
export const BRACE = [
  "...##",
  "..##.",
  "..#..",
  "..#..",
  ".##..",
  "##...",
  ".##..",
  "..#..",
  "..#..",
  "..##.",
  "...##",
];
const BRACE_COLS = 5;

export type MascotSpec = ReturnType<typeof mascotSpec>;

export function mascotSpec(wearer: number, body: BoxParams) {
  const { length: L, width: W, height: H, thickness } = body;

  // Eye line: ~6.8% of stature below the crown, plus the clearance above it.
  const eyeFromTop = wearer * 0.068 + HEAD_CLEARANCE;
  // Shoulder (acromion) height is ~81.8% of stature.
  const shoulderFromTop = wearer * 0.182 + HEAD_CLEARANCE;

  // Window chrome, in mm on the front: grey frame, title bar, black screen.
  const frame = Math.round(L * 0.055);
  const bar = Math.round(Math.min(H * 0.11, eyeFromTop - 40));
  const screen = { x: frame, y: frame, w: L - frame * 2, h: H - bar - frame };

  // Eyes sit a little above the middle of the screen, on a pixel grid.
  const px = screen.w / FACE_COLS;
  const eyesMid = H - (bar + screen.h * 0.42);

  // Viewing slit at the real eye line; black mesh behind it vanishes into the screen.
  const slitW = Math.round(wearer * 0.125);
  const slitH = Math.round(Math.min(px * 0.62, 30));
  const slit = { x: (L - slitW) / 2, y: H - eyeFromTop - slitH / 2, w: slitW, h: slitH };

  // Arm doors: slit up both sides of each side wall from the hem, hinged
  // just below shoulder height, centred on the wearer.
  const wearerFromFront = W / 2;
  const notchW = Math.round(Math.min(wearer * 0.15, W - 80));
  const notchH = Math.round(H - shoulderFromTop);
  const door = (fromFront: number) => [{ x: Math.round(fromFront - notchW / 2), w: notchW, h: notchH, door: true }];

  // Breathing vents: slots in the front and back top flaps, over the head,
  // where only one layer of board covers it.
  const flapDepth = W / 2;
  const ventCount = 7;
  const ventW = 14;
  const ventPitch = 34;
  const ventLen = Math.round(flapDepth * 0.55);
  const flapMid = (L - Math.max(thickness, 3) / 2) / 2;
  const vents = Array.from({ length: ventCount }, (_, k) =>
    rectPoly(
      Math.round(flapMid + (k - (ventCount - 1) / 2) * ventPitch - ventW / 2),
      Math.round((flapDepth - ventLen) / 2),
      ventW,
      ventLen,
    ),
  );

  // Braces hang off the lower half of the sides, a little apart from the body.
  const bracePx = Math.round((H * 0.52) / BRACE.length);
  const braceLoop = traceCells(BRACE, (ch) => ch === "#")[0].map(([x, y]): Vec2 => [x * bracePx, (y + BRACE.length) * bracePx]);
  const braceGap = Math.round(bracePx * 1.4);

  return {
    wearer,
    /** Body sits with its top this far above the floor. */
    topFromFloor: wearer + HEAD_CLEARANCE,
    chrome: { frame, bar, screen },
    /** Eye grid: top-left corner (mm from the front's top-left) and pixel size. */
    faceGrid: { left: frame, top: H - eyesMid - (px * FACE_ROWS) / 2, px, cols: FACE_COLS, rows: FACE_ROWS },
    slit,
    bodyOptions: {
      top: true,
      bottom: false,
      holes: { front: [rectPoly(slit.x, slit.y, slit.w, slit.h)] },
      // The right wall runs front → back, the left one back → front.
      notches: { right: door(wearerFromFront), left: door(W - wearerFromFront) },
      topHoles: { front: vents, back: vents },
    } satisfies LayoutOptions,
    brace: {
      /** Outline of `{` in mm, origin bottom-left; tips on the right edge. */
      loop: braceLoop,
      px: bracePx,
      w: BRACE_COLS * bracePx,
      h: BRACE.length * bracePx,
      /** Centre height above the hem, and how far behind the front face it sits. */
      y: H * 0.26,
      z: -Math.max(24, thickness * 3),
      /** Two layers glued together for stiffness. */
      depth: thickness * 2,
      /** Air between the brace tips and the side wall. */
      gap: braceGap,
      /**
       * Hidden strut behind each tip: a strip glued to the back of the brace,
       * bridging the gap, with a tab creased 90° and glued flat to the wall.
       */
      strut: { overlap: bracePx, tab: Math.round(bracePx * 0.8), h: Math.round(bracePx * 0.7) },
    },
    wearerZ: -wearerFromFront,
    /** Hip joints either side of the centre line. */
    hipHalf: wearer * 0.055,
  };
}

/** Body box for a given wearer height: a near-square window, deep enough to stand in. */
export function mascotBody(wearer: number, thickness: number): BoxParams {
  const height = Math.round(wearer * 0.43 + HEAD_CLEARANCE);
  return {
    length: Math.round(height * 0.95),
    width: Math.round(wearer * 0.22),
    height,
    thickness,
    glueTab: 40,
  };
}
