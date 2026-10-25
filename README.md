# Ship mascot · cardboard costume

A wearable cardboard version of the pixel browser-window mascot from Vercel Ship, sized to the
wearer, with a 3D preview and cut files. Fan-made, not affiliated with Vercel.

**Stack:** Next.js 16 (App Router) · React Three Fiber + drei · Maker.js · Zustand · Tailwind v4

```bash
pnpm install
pnpm dev
```

## How it works

One parametric model drives everything, in `src/lib/box.ts`:

```
BoxParams (L, W, H, board) ──► buildLayout()
                                 ├─ cut / crease paths ──► Dieline view + SVG/DXF export (Maker.js)
                                 ├─ face rectangles     ──► print-sheet artwork (canvas)
                                 └─ part tree (hinges)  ──► 3D folding (R3F)
```

- **Folding:** each panel is a `<group>` whose origin is on its fold line, nested in hinge
  order (front → right → back → left → glue tab, plus flaps per wall). Global `fold` 0→1 is
  split into phases (walls, bottom minor/major, top minor/major), so it folds like a real box.
- **Artwork:** a single canvas covers the whole flat blank. The 3D panels sample it through
  UVs and the dieline view shows it directly, so the flat print and the folded box always match.
- **Exports:** SVG and DXF with `red` = cut and `blue` = crease layers, plus a print PNG of
  the artwork at 4 px/mm.

| File | What |
|---|---|
| `src/lib/box.ts` | FEFCO 0201 geometry: layout, part tree, cut/crease paths |
| `src/lib/artwork.ts` | Board texture + print-sheet rendering |
| `src/lib/export.ts` | Maker.js SVG/DXF export |
| `src/components/BoxScene.tsx` | R3F scene, folding, auto-framing camera |
| `src/components/DielineView.tsx` | Flat dieline with dimensions |
| `src/lib/mascot.ts` | Costume spec: proportions, window chrome, doors, vents, braces |
| `src/lib/faces.ts` | Swappable eye sets on a shared magnet grid |
| `src/components/Sidebar.tsx` | Controls |

## The costume

`src/lib/mascot.ts` sizes everything from the wearer's height (standard body-proportion ratios):

- **Body:** an open-bottom RSC worn from just above the head to the hips. It's printed as a
  browser window: grey frame, a title bar with three square buttons, and a black screen.
  Your legs are the mascot's legs (grey trousers).
- **Viewing slit:** at the real eye line, hidden in the black screen behind black mesh.
- **Eyes ×4 sets** (`src/lib/faces.ts`): Focused ▮▮, Curious ••, Happy ⌒⌒, Chill ▬▬. Each set
  is a white relief piece on a 15 × 4 pixel grid; all of them cover the same two magnet
  anchors, so one pair of magnets in the body takes any set.
- **Brace arms:** thin pixel `{` and `}` hanging off the lower half of the sides, two layers
  each, held a gap away from the wall by a strut behind each tip (creased tab glued to the wall).
- **Arm doors:** slit up both sides of each side wall from the hem, creased at shoulder height,
  so your arms push them open.
- **Vents:** slots in the front and back top flaps, over the head.
- **Back:** ▲, "Ship what's next" in dot matrix, and a QR to vercel.com/ship (switch off
  with "Ship branding").

Also needed: black mesh, white foamy, 10 neodymium magnets, hot glue, duct tape, shoulder
straps, grey trousers.

## Not production-accurate yet

- No board-thickness allowances: panels equal the entered L/W/H. Real dielines add
  allowances per crease, depending on the flute, to hit internal dimensions.
- No bleed or safe zone on the print sheet.
- Only FEFCO 0201. Next: 0427 mailer, tuck-end cartons.

## Ideas for next steps

- More styles (each one is just another `buildLayout`)
- Drag-and-place artwork directly on the 3D box (raycast → sheet UV)
- PDF export with print marks
- Save/share designs (Postgres) and quoting from `blankStats()`
