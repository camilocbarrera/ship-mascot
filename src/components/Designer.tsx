"use client";

import { useMemo, useState, type ReactNode } from "react";
import { buildLayout, type Dieline, type Vec2 } from "@/lib/box";
import { drawArtwork, drawFacePiece, fillPiece } from "@/lib/artwork";
import { FACES, FACE_IDS, facePiece } from "@/lib/faces";
import { FRAME, mascotSpec } from "@/lib/mascot";
import type { Piece } from "@/lib/pieces";
import { SHIP_URL, useBox } from "@/lib/store";
import BoxScene, { type CostumeScene } from "./BoxScene";
import DielineView from "./DielineView";
import Sidebar from "./Sidebar";

const REPO_URL = "https://github.com/camilocbarrera/ship-mascot";

export default function Designer() {
  const params = useBox((s) => s.params);
  const design = useBox((s) => s.design);
  const { wearer, branding, showWearer, xray, face } = useBox((s) => s.costume);
  const setCostume = useBox((s) => s.setCostume);

  const spec = useMemo(() => mascotSpec(wearer, params), [wearer, params]);
  const layout = useMemo(() => buildLayout(params, spec.bodyOptions), [params, spec]);
  const art = useMemo(
    () => drawArtwork(layout, design, { spec, qr: branding ? SHIP_URL : undefined }),
    [layout, design, spec, branding],
  );

  // The arms: one bent strip with a tab that folds flat onto the side wall.
  // Cut four (two layers per arm, flip one pair for the other side).
  const arm = useMemo(() => {
    const { loop, root, tab } = spec.arm;
    // The outline ends on the wall line; the tab sticks out past it.
    const [a, b] = [loop[loop.length - 1], loop[0]];
    const inset = Math.min(8, Math.abs(a[1] - b[1]) * 0.1);
    const toward = (from: number, to: number) => from + Math.sign(to - from) * inset;
    const cut: Vec2[] = [...loop, [-tab, toward(a[1], b[1])], [-tab, toward(b[1], a[1])]];
    const xs = cut.map((p) => p[0]);
    const ys = cut.map((p) => p[1]);
    const dieline: Dieline = {
      cut,
      holes: [],
      creases: [[root[0], root[1]]],
      bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
    };
    return { dieline, art: fillPiece(dieline, FRAME) };
  }, [spec]);

  // Every face goes in the cut file so they can be swapped; the preview wears one.
  const faces = useMemo(
    () =>
      FACE_IDS.map((id) => {
        const piece = facePiece(id, spec, params.height);
        return { piece, art: drawFacePiece(piece) };
      }),
    [spec, params.height],
  );

  const current = faces.find((f) => f.piece.id === face)!.piece;
  const scene = useMemo<CostumeScene>(
    () => ({ spec, showWearer, xray, face: current }),
    [spec, showWearer, xray, current],
  );

  const pieces = useMemo<Piece[]>(
    () => [
      { id: "body", label: "Body", qty: 1, dieline: layout, art },
      { id: "arm", label: "Arm", qty: 4, dieline: arm.dieline, art: arm.art },
      ...faces.map(({ piece, art }) => ({
        id: `face-${piece.id}`,
        label: `Eyes · ${FACES[piece.id].label}`,
        qty: 1,
        dieline: piece.dieline,
        art,
      })),
    ],
    [layout, art, arm, faces],
  );
  const [showDieline, setShowDieline] = useState(true);

  return (
    <div className="flex h-dvh w-full flex-col-reverse bg-stone-100 md:flex-row">
      <div className="h-[46dvh] shrink-0 md:h-full md:w-auto">
        <Sidebar layout={layout} pieces={pieces} />
      </div>

      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1 bg-[radial-gradient(ellipse_at_50%_35%,#ffffff_0%,#f1efeb_55%,#e4e0d9_100%)]">
          <BoxScene layout={layout} art={art} board={design.board} thickness={params.thickness} costume={scene} />
          <FoldControl />
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-stone-300 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-700 backdrop-blur hover:bg-white"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
          <div className="absolute right-4 top-4 flex gap-1.5">
            <Toggle on={showWearer} onClick={() => setCostume({ showWearer: !showWearer })}>
              Person
            </Toggle>
            <Toggle on={xray} onClick={() => setCostume({ xray: !xray })}>
              X-ray
            </Toggle>
            <button
              onClick={snapshot}
              className="rounded-full border border-stone-300 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-700 backdrop-blur hover:bg-white"
            >
              Snapshot
            </button>
          </div>
        </div>

        <div
          className={`relative shrink-0 border-t border-stone-200 bg-white transition-[height] duration-300 ${
            showDieline ? "h-[34%]" : "h-10"
          }`}
        >
          <div className="absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-between px-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-semibold uppercase tracking-[0.08em] text-stone-500">Dieline</span>
              {showDieline && (
                <>
                  <Legend color="#dc2626" label="Cut" />
                  <Legend color="#2563eb" label="Crease" dashed />
                </>
              )}
            </div>
            <button onClick={() => setShowDieline((v) => !v)} className="text-xs text-stone-500 hover:text-stone-900">
              {showDieline ? "Hide" : "Show"}
            </button>
          </div>
          {showDieline && (
            <div className="absolute inset-0 top-10 p-3">
              <DielineView layout={layout} pieces={pieces} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FoldControl() {
  const fold = useBox((s) => s.fold);
  const playing = useBox((s) => s.playing);
  const setFold = useBox((s) => s.setFold);
  const playFold = useBox((s) => s.playFold);

  return (
    <div className="absolute bottom-5 left-1/2 flex w-[min(420px,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-full border border-stone-200 bg-white/85 py-2 pl-2 pr-5 shadow-lg shadow-stone-900/5 backdrop-blur">
      <button
        onClick={playFold}
        disabled={playing}
        className="shrink-0 rounded-full bg-stone-900 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-stone-700 disabled:opacity-60"
      >
        {fold > 0.5 ? "Unfold" : "Fold"}
      </button>
      <span className="text-[11px] text-stone-400">Flat</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={fold}
        onChange={(e) => setFold(Number(e.target.value))}
        className="w-full accent-stone-900"
        aria-label="Fold"
      />
      <span className="text-[11px] text-stone-400">Box</span>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur ${
        on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white/80 text-stone-700 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-stone-500">
      <svg width="18" height="4">
        <line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "4 3" : undefined} />
      </svg>
      {label}
    </span>
  );
}

function snapshot() {
  const canvas = document.querySelector<HTMLCanvasElement>("#box-scene canvas");
  if (!canvas) return;
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "ship-mascot.png";
  a.click();
}
