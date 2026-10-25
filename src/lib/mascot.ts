import { rectPoly, type BoxParams, type LayoutOptions, type Vec2 } from "./box";

// The Ship mascot as a wearable costume: a pixel browser window, worn from
// just above the head to the hips, open at the bottom. Your legs are its
// legs; bent cardboard strips make its arms.
//
//          ║ ║ ║ ║ ║ ║                    ← breathing vents in the top flaps
//        ┌──────────────────────┐         ← 40 mm head clearance
//        │■ ■ ■ title bar       │
//        │┌────────────────────┐│
//        ││   [   eye slit   ]  ││         ← slit hidden in the black screen (black mesh)
//        ││     ██      ██      ││         ← eyes: a swappable white relief piece
//      ╱╱││     ██      ██      ││╲╲       ← arms: flat bent strips, tab glued to the side
//     ╱╱ │└────────────────────┘│ ╲╲
//     ╲╲ │                      │ ╱╱
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

  // Arms: a strip bent at the elbow, out from the side wall and back down
  // past the hem. Coordinates are outward from the wall (x) and up from the
  // hem (y); the right arm is the mirror of the left.
  const armW = Math.round(L * 0.08);
  const shoulder: Vec2 = [0, H * 0.58];
  const elbow: Vec2 = [L * 0.23, H * 0.34];
  const hand: Vec2 = [L * 0.09, -H * 0.04];
  const armLoop = bentStrip([shoulder, elbow, hand], armW);
  const armTab = Math.round(armW * 0.8);

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
    arm: {
      /** Outline in mm: x outward from the side wall, y up from the hem. */
      loop: armLoop,
      /** The flat end that meets the wall, and the tab that folds 90° onto it. */
      root: armLoop.filter(([x]) => x === 0),
      tab: armTab,
      reach: elbow[0] + armW / 2,
      /** How far behind the front face it sits. */
      z: -Math.max(24, thickness * 3),
      /** Two layers glued together for stiffness. */
      depth: thickness * 2,
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

/**
 * A strip of width w along a polyline, as a closed outline: mitred at the
 * bends, cut square at the far end, and cut flush with x = 0 at the start
 * (where it meets the wall).
 */
function bentStrip(points: Vec2[], w: number): Vec2[] {
  const h = w / 2;
  const seg = points.slice(1).map((p, i) => {
    const [ax, ay] = points[i];
    const len = Math.hypot(p[0] - ax, p[1] - ay);
    const d: Vec2 = [(p[0] - ax) / len, (p[1] - ay) / len];
    return { a: points[i], b: p, d, n: [-d[1], d[0]] as Vec2 };
  });
  const offset = (p: Vec2, n: Vec2, k: number): Vec2 => [p[0] + n[0] * k, p[1] + n[1] * k];
  // Where two offset lines (point + direction) cross.
  const meet = (p: Vec2, d: Vec2, q: Vec2, e: Vec2): Vec2 => {
    const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / (d[0] * e[1] - d[1] * e[0]);
    return [p[0] + d[0] * t, p[1] + d[1] * t];
  };
  const side = (k: number): Vec2[] => {
    const first = seg[0];
    const start = offset(first.a, first.n, k);
    // Slide the start along the edge until it hits the wall line.
    const atWall: Vec2 = [0, start[1] - (start[0] * first.d[1]) / first.d[0]];
    const bends = seg.slice(1).map((s, i) => meet(offset(seg[i].a, seg[i].n, k), seg[i].d, offset(s.a, s.n, k), s.d));
    const last = seg[seg.length - 1];
    return [atWall, ...bends, offset(last.b, last.n, k)];
  };
  const r = (v: number) => Math.round(v * 10) / 10;
  return [...side(h), ...side(-h).reverse()].map(([x, y]) => [r(x), r(y)]);
}
