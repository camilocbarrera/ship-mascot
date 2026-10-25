import type { Bounds, Dieline, Layout, Rect, Vec2 } from "./box";
import QRCode from "qrcode";
import { ANCHORS, type FacePiece } from "./faces";
import { EYE, FRAME, SCREEN, type MascotSpec } from "./mascot";
import type { Board, Design } from "./store";

// The print sheet: one canvas covering the whole flat blank. The 3D preview
// samples it per panel through UVs and the dieline view shows it as-is, so
// what you see folded is exactly what gets printed flat.

const MAX_PX = 4096;
const PX_PER_MM = 4;
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export const BOARD_COLORS: Record<Board, { base: string; edge: string }> = {
  kraft: { base: "#c49a6c", edge: "#a87f53" },
  white: { base: "#f2eee6", edge: "#d9cdb8" },
};

const tiles = new Map<Board, HTMLCanvasElement>();

/** Seeded so the fibres don't shimmer every time the sheet is redrawn. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tileable board-surface texture: base colour, mottling and paper fibres. */
export function boardTile(board: Board) {
  const cached = tiles.get(board);
  if (cached) return cached;
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const rand = mulberry32(board === "kraft" ? 7 : 11);
  const kraft = board === "kraft";
  ctx.fillStyle = BOARD_COLORS[board].base;
  ctx.fillRect(0, 0, size, size);

  // Wrap every mark across the edges so the tile repeats seamlessly.
  const wrapped = (draw: (ox: number, oy: number) => void) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) draw(ox, oy);
  };

  for (let i = 0; i < 220; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 20 + rand() * 70;
    const light = rand() > 0.5;
    const a = (kraft ? 0.05 : 0.025) * rand();
    wrapped((ox, oy) => {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, light ? `rgba(255,240,215,${a})` : `rgba(90,55,20,${a})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }

  ctx.lineCap = "round";
  for (let i = 0; i < (kraft ? 2600 : 900); i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 2 + rand() * 9;
    const ang = rand() * Math.PI;
    const dark = rand() > 0.35;
    ctx.strokeStyle = dark
      ? `rgba(70,40,15,${(kraft ? 0.22 : 0.08) * rand()})`
      : `rgba(255,245,225,${(kraft ? 0.25 : 0.4) * rand()})`;
    ctx.lineWidth = 0.4 + rand() * 0.8;
    wrapped((ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + ox + Math.cos(ang) * len, y + oy + Math.sin(ang) * len);
      ctx.stroke();
    });
  }
  tiles.set(board, c);
  return c;
}

/** A blank canvas covering a sheet, with helpers from sheet mm to canvas px. */
function sheetCanvas({ minX, minY, maxX, maxY }: Bounds) {
  const k = Math.min(PX_PER_MM, MAX_PX / Math.max(maxX - minX, maxY - minY));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((maxX - minX) * k);
  canvas.height = Math.ceil((maxY - minY) * k);
  const ctx = canvas.getContext("2d")!;
  // Sheet space is Y-up millimetres; the canvas is Y-down pixels.
  const toPx = (r: Rect) => ({
    x: (r.x - minX) * k,
    y: (maxY - (r.y + r.h)) * k,
    w: r.w * k,
    h: r.h * k,
  });
  const pt = ([x, y]: Vec2): Vec2 => [(x - minX) * k, (maxY - y) * k];
  return { canvas, ctx, k, toPx, pt };
}

export type Decorations = {
  /** Draws the window (frame, title bar, screen) on the front and back. */
  spec?: MascotSpec;
  /** Back screen: the ▲, "Ship what's next" in dot matrix, and a QR to this URL. */
  qr?: string;
};

export function drawArtwork(layout: Layout, design: Design, decorations: Decorations = {}) {
  const { canvas, ctx, k, toPx } = sheetCanvas(layout.bounds);

  ctx.fillStyle = ctx.createPattern(boardTile(design.board), "repeat")!;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (design.printColor) {
    // Ink on kraft soaks in; multiply keeps the fibres showing through.
    ctx.globalCompositeOperation = design.board === "kraft" ? "multiply" : "source-over";
    ctx.globalAlpha = design.board === "kraft" ? 0.92 : 0.97;
    ctx.fillStyle = design.printColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  const { spec } = decorations;
  if (!spec) return canvas;

  const front = toPx(layout.faces.front);
  const back = toPx(layout.faces.back);
  drawWindow(ctx, front, spec, k, false);
  drawWindow(ctx, back, spec, k, true);

  // Magnet marks: every face piece covers these, so they never show when worn.
  const { left, top, px } = spec.faceGrid;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(1, px * k * 0.04);
  for (const [r, c] of ANCHORS) {
    const cx = front.x + (left + (c + 0.5) * px) * k;
    const cy = front.y + (top + (r + 0.5) * px) * k;
    const rad = px * k * 0.28;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.moveTo(cx - rad * 1.4, cy);
    ctx.lineTo(cx + rad * 1.4, cy);
    ctx.moveTo(cx, cy - rad * 1.4);
    ctx.lineTo(cx, cy + rad * 1.4);
    ctx.stroke();
  }

  if (decorations.qr) drawBack(ctx, screenRect(back, spec, k), decorations.qr);
  return canvas;
}

type Box = { x: number; y: number; w: number; h: number };

/** The black screen inside a window panel, in canvas px. */
function screenRect(panel: Box, spec: MascotSpec, k: number): Box {
  const { frame, bar, screen } = spec.chrome;
  return { x: panel.x + frame * k, y: panel.y + bar * k, w: screen.w * k, h: screen.h * k };
}

/**
 * The browser window: grey frame, a title bar with three square "buttons",
 * and the black screen. Seen from behind, the buttons sit on the other side.
 */
function drawWindow(ctx: CanvasRenderingContext2D, panel: Box, spec: MascotSpec, k: number, mirrored: boolean) {
  const { frame, bar } = spec.chrome;
  ctx.fillStyle = FRAME;
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  const s = screenRect(panel, spec, k);
  ctx.fillStyle = SCREEN;
  ctx.fillRect(s.x, s.y, s.w, s.h);

  const sq = Math.min(bar - frame * 0.6, frame * 1.1) * k;
  const gap = sq * 0.55;
  const y = panel.y + (bar * k - sq) / 2 + frame * k * 0.1;
  for (let i = 0; i < 3; i++) {
    const offset = frame * k + i * (sq + gap);
    const x = mirrored ? panel.x + panel.w - offset - sq : panel.x + offset;
    ctx.fillRect(x, y, sq, sq);
  }
}

/** Back screen: the triangle, "Ship what's next" in dot matrix, then a QR and its URL. */
function drawBack(ctx: CanvasRenderingContext2D, box: Box, url: string) {
  const cx = box.x + box.w / 2;

  const t = box.h * 0.1;
  const ty = box.y + box.h * 0.08;
  ctx.fillStyle = EYE;
  ctx.beginPath();
  ctx.moveTo(cx, ty);
  ctx.lineTo(cx + t * 0.577, ty + t);
  ctx.lineTo(cx - t * 0.577, ty + t);
  ctx.closePath();
  ctx.fill();

  dotText(ctx, ["Ship", "what's next"], { x: box.x + box.w * 0.08, y: box.y + box.h * 0.24, w: box.w * 0.84, h: box.h * 0.32 });

  // Dark modules on a light quiet zone, so it scans off the black screen.
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const size = Math.min(box.h * 0.26, box.w * 0.34);
  const m = size / (n + 8);
  const x0 = cx - size / 2;
  const y0 = box.y + box.h * 0.6;
  ctx.fillStyle = EYE;
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = SCREEN;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.modules.get(r, c)) ctx.fillRect(x0 + (c + 4) * m - 0.25, y0 + (r + 4) * m - 0.25, m + 0.5, m + 0.5);

  const label = url.replace(/^https?:\/\//, "");
  const fs = Math.min(box.h * 0.045, (box.w * 0.7) / (label.length * 0.62));
  ctx.font = `500 ${fs}px ${MONO}`;
  ctx.fillStyle = "#a1a1a1";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, y0 + size + (box.y + box.h - (y0 + size)) * 0.45);
}

/** Lines of text as a dot-matrix sign: rendered small, then sampled into round dots. */
function dotText(ctx: CanvasRenderingContext2D, lines: string[], area: Box) {
  const rows = 9;
  const scratch = document.createElement("canvas");
  const sctx = scratch.getContext("2d")!;
  sctx.font = `500 ${rows}px ${FONT}`;
  const cols = Math.ceil(Math.max(...lines.map((l) => sctx.measureText(l).width))) + 1;
  scratch.width = cols;
  scratch.height = rows * lines.length + (lines.length - 1) * 3;
  sctx.font = `500 ${rows}px ${FONT}`;
  sctx.fillStyle = "#fff";
  sctx.textBaseline = "top";
  lines.forEach((l, i) => sctx.fillText(l, 0, i * (rows + 3)));
  const { data, width, height } = sctx.getImageData(0, 0, scratch.width, scratch.height);

  const pitch = Math.min(area.w / width, area.h / height);
  const ox = area.x + (area.w - width * pitch) / 2;
  const oy = area.y + (area.h - height * pitch) / 2;
  ctx.fillStyle = EYE;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 110) continue;
      ctx.beginPath();
      ctx.arc(ox + (x + 0.5) * pitch, oy + (y + 0.5) * pitch, pitch * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
}

/** An eye piece as cut: plain white. */
export function drawFacePiece(piece: FacePiece) {
  return fillPiece(piece.dieline, EYE);
}

/** A cut-out piece filled with one colour inside its outline, transparent outside. */
export function fillPiece(d: Dieline, color: string) {
  const { canvas, ctx, pt } = sheetCanvas(d.bounds);
  ctx.beginPath();
  for (const loop of [d.cut, ...d.holes]) {
    loop.forEach((p, i) => (i ? ctx.lineTo(...pt(p)) : ctx.moveTo(...pt(p))));
    ctx.closePath();
  }
  ctx.fillStyle = color;
  ctx.fill("nonzero");
  return canvas;
}
