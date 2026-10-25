import { create } from "zustand";
import type { BoxParams } from "./box";
import type { FaceId } from "./faces";
import { SIDE, mascotBody } from "./mascot";

export type Board = "kraft" | "white";

export type Design = {
  board: Board;
  /** null = unprinted board. */
  printColor: string | null;
};

export const SHIP_URL = "https://vercel.com/ship";

const DESIGN: Design = { board: "white", printColor: SIDE };

export type Costume = {
  /** Wearer's height in mm. */
  wearer: number;
  showWearer: boolean;
  /** "Ship what's next", the ▲ and a QR on the back; off gives a plain window. */
  branding: boolean;
  /** See-through board, to show how the wearer sits inside. */
  xray: boolean;
  /** Which face piece is on in the preview; all of them are in the cut file. */
  face: FaceId;
};

const WEARER = 1750;
const BOARD_MM = 7;

type State = {
  params: BoxParams;
  design: Design;
  costume: Costume;
  /** 0 = flat blanks, 1 = assembled costume. */
  fold: number;
  playing: boolean;
  setParams: (p: Partial<BoxParams>) => void;
  setCostume: (c: Partial<Costume>) => void;
  setFold: (fold: number) => void;
  playFold: () => void;
};

let raf = 0;

export const useBox = create<State>((set, get) => ({
  params: mascotBody(WEARER, BOARD_MM),
  design: DESIGN,
  costume: { wearer: WEARER, branding: true, showWearer: true, xray: false, face: "focused" },
  fold: 1,
  playing: false,
  setParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),
  setCostume: (c) =>
    set((s) => {
      const costume = { ...s.costume, ...c };
      // Re-fit the body only when the wearer changes; manual tweaks otherwise stick.
      const params = c.wearer ? mascotBody(costume.wearer, s.params.thickness) : s.params;
      return { costume, params };
    }),
  setFold: (fold) => {
    cancelAnimationFrame(raf);
    set({ fold, playing: false });
  },
  // Folds towards whichever end is further away.
  playFold: () => {
    cancelAnimationFrame(raf);
    const from = get().fold;
    const to = from > 0.5 ? 0 : 1;
    const duration = 2600 * Math.abs(to - from);
    const start = performance.now();
    set({ playing: true });
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      set({ fold: from + (to - from) * t });
      if (t < 1) raf = requestAnimationFrame(tick);
      else set({ playing: false });
    };
    raf = requestAnimationFrame(tick);
  },
}));
