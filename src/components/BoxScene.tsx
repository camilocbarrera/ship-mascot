"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { phaseProgress, rectPoly, type Bounds, type Layout, type Part, type Vec2, type Wall } from "@/lib/box";
import { BOARD_COLORS, boardTile } from "@/lib/artwork";
import { EYE, FRAME, SCREEN, type MascotSpec } from "@/lib/mascot";
import type { FacePiece } from "@/lib/faces";
import { useBox, type Board } from "@/lib/store";

/** Scene units per millimetre (1 unit = 10 cm). */
const S = 0.01;
const FOV = 32;
const TILE_MM = 128;

export type CostumeScene = {
  spec: MascotSpec;
  showWearer: boolean;
  xray: boolean;
  face: FacePiece;
};

type Props = {
  layout: Layout;
  art: HTMLCanvasElement;
  board: Board;
  thickness: number;
  costume: CostumeScene | null;
};

/** 0 → 1 as the costume's limbs come out once the body is fully folded. */
type Anim = () => number;

const storeFold = () => useBox.getState().fold;

/** How far each side door is pushed open (0–1), driven by the wearer's arms. */
const doorOpen: Partial<Record<Wall, number>> = {};
const DOOR_ANGLE = 1.2;

export default function BoxScene(props: Props) {
  return (
    <Canvas
      id="box-scene"
      dpr={[1, 2]}
      camera={{ position: [4.2, 3.2, 6.4], fov: FOV, near: 0.05, far: 400 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 8, 6]} intensity={1.6} />
      <directionalLight position={[-6, 3, -4]} intensity={0.35} />
      {/* Built from lightformers so nothing is fetched at runtime. */}
      <Environment resolution={256} environmentIntensity={0.6}>
        <Lightformer form="rect" intensity={3} position={[0, 6, 2]} scale={[10, 4, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.5} position={[-6, 2, 3]} scale={[4, 6, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={1} position={[6, 2, -3]} scale={[4, 6, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="ring" color="#fff4e6" intensity={2} position={[3, 4, 6]} scale={3} />
      </Environment>
      <Box {...props} />
      <ContactShadows position={[0, 0, 0]} scale={40} resolution={1024} blur={2.6} opacity={0.5} far={12} />
      <OrbitControls makeDefault enableDamping minDistance={1} maxDistance={150} maxPolarAngle={Math.PI / 2 - 0.04} />
    </Canvas>
  );
}

function Box({ layout, art, board, thickness, costume }: Props) {
  const root = useRef<THREE.Group>(null);
  const appear = useRef(0);
  const anim = useCallback(() => appear.current, []);
  const materials = useBoardMaterials(art, board);
  const { minX, maxX, minY } = layout.bounds;
  const L = layout.faces.front.w;
  const W = layout.faces.right.w;
  const H = layout.faces.front.h;

  useFrame((_, delta) => {
    const fold = useBox.getState().fold;
    const target = costume && fold > 0.999 ? 1 : 0;
    appear.current += (target - appear.current) * (1 - Math.exp(-Math.min(delta, 0.1) * 3.2));
    if (Math.abs(target - appear.current) < 1e-4) appear.current = target;

    // Keep the blank centred and resting on the floor as it folds up; a
    // costume then rises to where the wearer carries it.
    const walls = phaseProgress(fold, [0, 0.4]);
    const bottom = phaseProgress(fold, [0.4, 0.68]);
    const lift = costume ? (costume.spec.topFromFloor - H) * ease(appear.current) : 0;
    root.current?.position.set(
      THREE.MathUtils.lerp(-(minX + maxX) / 2, -L / 2, walls) * S,
      (THREE.MathUtils.lerp(-minY, thickness, bottom) + lift) * S,
      THREE.MathUtils.lerp(0, W / 2, walls) * S,
    );
  });

  return (
    <group ref={root} scale={S}>
      <PartNode part={layout.root} parentPivot={[0, 0]} layout={layout} materials={materials} thickness={thickness} getFold={storeFold} />
      {costume && <CostumeParts costume={costume} body={{ L, W, H }} thickness={thickness} anim={anim} />}
      <CameraRig layout={layout} thickness={thickness} costume={costume} anim={anim} />
    </group>
  );
}

const ease = (t: number) => t * t * (3 - 2 * t);
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

/** Arms, the eyes and (optionally) the wearer — positioned in the folded body's frame. */
function CostumeParts({
  costume,
  body,
  thickness,
  anim,
}: {
  costume: CostumeScene;
  body: { L: number; W: number; H: number };
  thickness: number;
  anim: Anim;
}) {
  const { spec, showWearer, xray, face } = costume;
  const { L, H } = body;
  const arms = useRef<(THREE.Group | null)[]>([]);
  const wearer = useRef<THREE.Group>(null);
  const lift = spec.topFromFloor - H;
  const { arm } = spec;

  useFrame(() => {
    const a = anim();
    // Arms swing out from flat against the walls once the body is folded.
    arms.current.forEach((g, i) => {
      if (!g) return;
      g.visible = a > 0.001;
      g.rotation.y = (i === 0 ? -1 : 1) * (1 - Math.min(easeOutBack(a), 1.2)) * (Math.PI / 2);
    });
    if (wearer.current) wearer.current.visible = showWearer && a > 0.98;
  });

  return (
    <>
      {/* Bent-strip arms off each side wall, a little behind the front face. The outline
          points outward along +x; the left arm is its mirror. */}
      {[0, 1].map((i) => (
        <group key={i} position={[i === 0 ? 0 : L, 0, arm.z]}>
          <group ref={(g) => void (arms.current[i] = g)}>
            <group scale-x={i === 0 ? -1 : 1}>
              <FlatPiece loop={arm.loop} depth={arm.depth} />
            </group>
          </group>
        </group>
      ))}

      <FaceRelief key={face.id} face={face} />

      {/* Black mesh behind the eye slit: you see out, and it vanishes into the black screen. */}
      <mesh position={[spec.slit.x + spec.slit.w / 2, spec.slit.y + spec.slit.h / 2, -thickness - 1]}>
        <planeGeometry args={[spec.slit.w + 60, spec.slit.h + 60]} />
        <meshStandardMaterial color={SCREEN} roughness={1} side={THREE.DoubleSide} transparent={xray} opacity={xray ? 0.3 : 1} />
      </mesh>

      <group ref={wearer}>
        <Wearer
          spec={spec}
          x={L / 2}
          hips={[L / 2 - spec.hipHalf, L / 2 + spec.hipHalf]}
          z={spec.wearerZ}
          lift={lift}
          swing={xray && showWearer}
        />
      </group>
    </>
  );
}

/** A flat cut-out, extruded to its doubled-board thickness, centred on z. */
function FlatPiece({ loop, depth }: { loop: Vec2[]; depth: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(loop.map(([x, y]) => new THREE.Vector2(x, y))), {
      depth,
      bevelEnabled: false,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  }, [loop, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      {/* Double-sided: the mirrored arm turns its faces inside out. */}
      <meshStandardMaterial color={FRAME} roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Foamy / doubled board, plus the gap the magnets leave. */
const RELIEF = 6;
const MAGNET_GAP = 3;

/** The swappable face, raised off the front. Pops in whenever it changes. */
function FaceRelief({ face }: { face: FacePiece }) {
  const ref = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const geometry = useMemo(() => {
    const shapes = face.loops.map((loop) => new THREE.Shape(loop.map(([x, y]) => new THREE.Vector2(x, y))));
    return new THREE.ExtrudeGeometry(shapes, { depth: RELIEF, bevelEnabled: false });
  }, [face]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    if (!ref.current) return;
    born.current ??= state.clock.elapsedTime;
    const t = clamp((state.clock.elapsedTime - born.current) / 0.55);
    const e = 1 - (1 - t) ** 3;
    ref.current.position.z = MAGNET_GAP + (1 - e) * 160;
    ref.current.rotation.x = (1 - e) * -0.35;
  });

  return (
    <group ref={ref} position-z={MAGNET_GAP}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={EYE} roughness={0.6} emissive={EYE} emissiveIntensity={0.08} />
      </mesh>
    </group>
  );
}

/**
 * The wearer, built from standard body proportions (fractions of stature).
 * Their arms hang inside the body with the hands out under the hem; the
 * cardboard arms are fixed to the side walls.
 */
function Wearer({
  spec,
  x,
  hips,
  z,
  lift,
  swing,
}: {
  spec: MascotSpec;
  x: number;
  hips: number[];
  z: number;
  lift: number;
  /** Lift the arms out through the side openings and back, on a loop. */
  swing: boolean;
}) {
  const h = spec.wearer;
  const arms = useRef<(THREE.Group | null)[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    arms.current.forEach((g, i) => {
      if (!g) return;
      const side = i === 0 ? 1 : -1;
      const out = swing ? (0.5 - 0.5 * Math.cos(t * 1.4 + i * Math.PI * 0.35)) ** 1.5 : 0;
      g.rotation.z = side * (RELAXED + out * (RAISED - RELAXED));
      // The door on that side gets pushed open ahead of the arm.
      doorOpen[side > 0 ? "right" : "left"] = Math.min(1, out * 1.3);
    });
  });
  /** Height above the floor (as a fraction of stature) → body-frame y. */
  const y = (f: number) => f * h - lift;
  const shoeH = h * 0.045;
  const torsoR = h * 0.085;
  const torsoTop = 0.815;
  const torsoBottom = 0.52;
  const upper = h * 0.18;
  const fore = h * 0.15;
  return (
    <group position={[x, 0, z]}>
      {/* Head and neck */}
      <mesh position={[0, y(0.935), 0]} scale={[1, 1.25, 1.1]}>
        <sphereGeometry args={[h * 0.05, 24, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      <mesh position={[0, y(0.855), 0]}>
        <cylinderGeometry args={[h * 0.022, h * 0.025, h * 0.06, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, y((torsoTop + torsoBottom) / 2), 0]} scale={[1, 1, 0.62]}>
        <capsuleGeometry args={[torsoR, (torsoTop - torsoBottom) * h - torsoR * 2, 8, 24]} />
        <meshStandardMaterial color={SHIRT} roughness={0.85} />
      </mesh>
      {/* Arms, relaxed: a little out to the side, forearms a little forward. */}
      {[1, -1].map((side) => (
        <group
          key={side}
          ref={(g) => void (arms.current[side > 0 ? 0 : 1] = g)}
          position={[side * h * 0.112, y(0.805), 0]}
          rotation-z={side * RELAXED}
        >
          <mesh position={[0, -upper / 2, 0]}>
            <capsuleGeometry args={[h * 0.024, upper - h * 0.03, 6, 16]} />
            <meshStandardMaterial color={SHIRT} roughness={0.85} />
          </mesh>
          <group position={[0, -upper, 0]} rotation-x={-0.4}>
            <mesh position={[0, -fore / 2, 0]}>
              <capsuleGeometry args={[h * 0.019, fore - h * 0.02, 6, 16]} />
              <meshStandardMaterial color={SKIN} roughness={0.7} />
            </mesh>
            <mesh position={[0, -fore - h * 0.045, 0]} scale={[0.75, 1, 0.45]}>
              <capsuleGeometry args={[h * 0.028, h * 0.04, 6, 16]} />
              <meshStandardMaterial color={SKIN} roughness={0.7} />
            </mesh>
          </group>
        </group>
      ))}
      {/* Legs, standing in the thigh sleeves. */}
      {hips.map((hx, i) => {
        const top = y(0.54);
        const bottom = shoeH - lift;
        return (
          <group key={i} position={[hx - x, 0, 0]}>
            <mesh position={[0, (top + bottom) / 2, 0]}>
              <cylinderGeometry args={[h * 0.036, h * 0.022, top - bottom, 20]} />
              <meshStandardMaterial color={JEANS} roughness={0.9} />
            </mesh>
            <mesh position={[0, -lift + shoeH / 2, h * 0.02]}>
              <boxGeometry args={[h * 0.055, shoeH, h * 0.15]} />
              <meshStandardMaterial color="#1c1c1c" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Arm abduction (radians): hanging relaxed, and lifted out through the side opening. */
const RELAXED = 0.14;
const RAISED = 1.05;
const SKIN = "#d8a983";
const SHIRT = "#2f3b4c";
/** Grey trousers: your legs are the mascot's legs. */
const JEANS = "#4a4a4a";

type NodeProps = {
  part: Part;
  parentPivot: Vec2;
  layout: Layout;
  materials: THREE.Material[];
  thickness: number;
  getFold: () => number;
};

function PartNode({ part, parentPivot, layout, materials, thickness, getFold }: NodeProps) {
  const ref = useRef<THREE.Group>(null);
  const { rect, pivot, axis, angle, phase, layer } = part;
  const geometry = useMemo(() => panelGeometry(part, layout.bounds, thickness), [part, layout.bounds, thickness]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    // Doors open outward (+z) as the arm pushes them; everything else follows the fold.
    const a = part.door ? -DOOR_ANGLE * (doorOpen[part.door] ?? 0) : angle * phaseProgress(getFold(), phase);
    ref.current?.rotation.set(axis === "x" ? a : 0, axis === "y" ? a : 0, 0);
  });

  // "in" sits behind the hinge, "out" in front of it, so overlapping flaps
  // stack the way real board does instead of z-fighting.
  const z = { in: -thickness / 2, out: thickness / 2, deep: -thickness * 1.5 }[layer];

  return (
    <group ref={ref} position={[pivot[0] - parentPivot[0], pivot[1] - parentPivot[1], 0]}>
      <mesh
        geometry={geometry}
        material={materials}
        position={[rect.x + rect.w / 2 - pivot[0], rect.y + rect.h / 2 - pivot[1], z]}
      />
      {part.children.map((child) => (
        <PartNode
          key={child.id}
          part={child}
          parentPivot={pivot}
          layout={layout}
          materials={materials}
          thickness={thickness}
          getFold={getFold}
        />
      ))}
    </group>
  );
}

/**
 * A panel of board, centred on its rect. The outside (+Z) face samples its
 * slice of the print sheet; the inside (-Z) face gets unprinted board, also
 * in sheet space so the fibres run continuously across folds. Panels with
 * cut-outs are extruded from a shape instead of being a plain box.
 */
function panelGeometry({ rect, holes, outline }: Part, bounds: Bounds, thickness: number) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const sw = bounds.maxX - bounds.minX;
  const sh = bounds.maxY - bounds.minY;
  const sheetUV = (x: number, y: number): Vec2 => [(x - bounds.minX) / sw, (y - bounds.minY) / sh];
  const tileUV = (x: number, y: number): Vec2 => [x / TILE_MM, y / TILE_MM];

  if (!holes.length && !outline) {
    const g = new THREE.BoxGeometry(rect.w, rect.h, thickness);
    const pos = g.getAttribute("position");
    const uv = g.getAttribute("uv");
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z — four vertices each.
    for (let i = 16; i < 24; i++) {
      const [u, v] = (i < 20 ? sheetUV : tileUV)(pos.getX(i) + cx, pos.getY(i) + cy);
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
    return g;
  }

  const local = (pts: Vec2[]) => pts.map(([x, y]) => new THREE.Vector2(x - cx, y - cy));
  const shape = new THREE.Shape(local(outline ?? rectPoly(rect.x, rect.y, rect.w, rect.h)));
  for (const hole of holes) shape.holes.push(new THREE.Path(local(hole)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  g.translate(0, 0, -thickness / 2);

  // Extrude emits the back cap, then the front cap (one group), then sides.
  // Split the caps so they take the same material slots as BoxGeometry.
  const [caps, sides] = g.groups;
  const half = caps.count / 2;
  g.clearGroups();
  g.addGroup(0, half, 5);
  g.addGroup(half, half, 4);
  g.addGroup(sides.start, sides.count, 0);

  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  for (let i = 0; i < caps.count; i++) {
    const [u, v] = (i < half ? tileUV : sheetUV)(pos.getX(i) + cx, pos.getY(i) + cy);
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return g;
}

function useBoardMaterials(art: HTMLCanvasElement, board: Board) {
  const gl = useThree((s) => s.gl);
  const xray = useBox((s) => s.costume.xray);

  const outside = useMemo(() => {
    const map = new THREE.CanvasTexture(art);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = gl.capabilities.getMaxAnisotropy();
    return new THREE.MeshStandardMaterial({ map, roughness: 0.82, metalness: 0 });
  }, [art, gl]);

  const inside = useMemo(() => {
    const map = new THREE.CanvasTexture(boardTile(board));
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.92, color: "#e9e1d6" });
  }, [board]);

  const edge = useMemo(
    () => new THREE.MeshStandardMaterial({ color: BOARD_COLORS[board].edge, roughness: 0.95 }),
    [board],
  );

  useEffect(() => () => (outside.map?.dispose(), outside.dispose()), [outside]);
  useEffect(() => () => (inside.map?.dispose(), inside.dispose()), [inside]);
  useEffect(() => () => edge.dispose(), [edge]);

  // X-ray: ghost the board so the wearer shows through.
  useEffect(() => {
    for (const m of [outside, inside, edge]) {
      m.transparent = xray;
      m.opacity = xray ? 0.22 : 1;
      m.depthWrite = !xray;
      m.needsUpdate = true;
    }
  }, [xray, outside, inside, edge]);

  return useMemo(() => [edge, edge, edge, edge, outside, inside], [edge, outside, inside]);
}

/**
 * Re-frames the camera whenever the thing on screen changes size (resizing,
 * folding, a costume assembling), then lets go so orbiting and zooming stay
 * in the user's hands.
 */
function CameraRig({
  layout,
  thickness,
  costume,
  anim,
}: {
  layout: Layout;
  thickness: number;
  costume: CostumeScene | null;
  anim: Anim;
}) {
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null;
  const camera = useThree((s) => s.camera);
  const last = useRef({ dist: 0, x: 0, y: 0, active: true });
  const target = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!controls) return;
    const fold = useBox.getState().fold;
    const walls = phaseProgress(fold, [0, 0.4]);
    const { minX, maxX } = layout.bounds;
    const { front, right, top, bottom } = layout.faces;
    const [L, W, H] = [front.w, right.w, front.h];

    // Bounding box of the part-folded blank: flaps stick out until they fold.
    const sx = THREE.MathUtils.lerp(maxX - minX, L, walls);
    const sz = THREE.MathUtils.lerp(0, W, walls);
    const sy =
      H +
      bottom.h * (1 - phaseProgress(fold, [0.4, 0.68])) +
      top.h * (1 - phaseProgress(fold, [0.7, 1])) +
      thickness * 2;
    const box = { minX: -sx / 2, maxX: sx / 2, minY: 0, maxY: sy };

    const a = anim();
    if (costume && a > 0) {
      const { spec } = costume;
      const lift = (spec.topFromFloor - H) * ease(a);
      const out = spec.arm.reach * a;
      box.minX = Math.min(box.minX, -L / 2 - out);
      box.maxX = Math.max(box.maxX, L / 2 + out);
      box.maxY += lift;
    }

    const r = (Math.hypot(box.maxX - box.minX, box.maxY - box.minY, sz) / 2) * S;
    const dist = (r / Math.sin(THREE.MathUtils.degToRad(FOV / 2))) * 1.22;
    const x = ((box.minX + box.maxX) / 2) * S;
    const y = ((box.minY + box.maxY) / 2) * S;

    const l = last.current;
    if (Math.abs(dist - l.dist) > 1e-4 || Math.abs(y - l.y) > 1e-4 || Math.abs(x - l.x) > 1e-4) l.active = true;
    Object.assign(l, { dist, x, y });
    if (!l.active) return;

    // Frame-rate independent easing; hand control back once settled.
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 7);
    target.set(x, y, 0);
    controls.target.lerp(target, k);
    offset.copy(camera.position).sub(controls.target);
    const len = THREE.MathUtils.lerp(offset.length(), dist, k);
    offset.setLength(len);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    if (Math.abs(len - dist) < dist * 0.002 && controls.target.distanceTo(target) < 0.002) l.active = false;
  });

  return null;
}

function clamp(v: number) {
  return Math.min(1, Math.max(0, v));
}
