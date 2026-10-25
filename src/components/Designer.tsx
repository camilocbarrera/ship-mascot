"use client";

import { useMemo, useState, type ReactNode } from "react";
import { buildLayout, type Dieline } from "@/lib/box";
import { drawArtwork, drawFacePiece, fillPiece } from "@/lib/artwork";
import { FACES, FACE_IDS, facePiece } from "@/lib/faces";
import { FRAME, mascotSpec } from "@/lib/mascot";
import type { Piece } from "@/lib/pieces";
import { SHIP_URL, useBox } from "@/lib/store";
import BoxScene, { type CostumeScene } from "./BoxScene";
import DielineView from "./DielineView";
import Sidebar from "./Sidebar";

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

  // The { } arms: one outline, cut four times (two layers each, flip one pair).
  const brace = useMemo(() => {
    const { loop } = spec.brace;
    const xs = loop.map((p) => p[0]);
    const ys = loop.map((p) => p[1]);
    const dieline: Dieline = {
      cut: loop,
      holes: [],
      creases: [],
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
      { id: "brace", label: "Brace arm", qty: 4, dieline: brace.dieline, art: brace.art },
      ...faces.map(({ piece, art }) => ({
        id: `face-${piece.id}`,
        label: `Eyes · ${FACES[piece.id].label}`,
        qty: 1,
        dieline: piece.dieline,
        art,
      })),
    ],
    [layout, art, brace, faces],
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
