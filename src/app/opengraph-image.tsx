import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Ship mascot: a wearable cardboard costume of the Vercel Ship pixel mascot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// A render of the costume on the wearer, taken from the 3D preview.
export default async function Image() {
  const render = await readFile(join(process.cwd(), "public/og-mascot.png"));
  const src = `data:image/png;base64,${render.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "radial-gradient(ellipse at 70% 35%, #ffffff 0%, #f1efeb 55%, #e4e0d9 100%)",
        color: "#1c1917",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "0 0 0 80px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 22, height: 22, background: "#4a4a4a" }} />
          ))}
        </div>
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>Ship mascot</div>
        <div style={{ fontSize: 36, color: "#57534e", marginTop: 24, lineHeight: 1.3, maxWidth: 620 }}>
          A cardboard costume of the pixel browser window, sized to you. Cut files included.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 48, fontSize: 26 }}>
          <div style={{ display: "flex", background: "#0a0a0a", color: "#f2f2f2", padding: "12px 24px", borderRadius: 999 }}>
            Halloween ready
          </div>
          <div style={{ display: "flex", color: "#78716c" }}>ship-mascot.vercel.app</div>
        </div>
      </div>
      <img src={src} width={385} height={600} style={{ marginTop: 22, marginRight: 70 }} alt="" />
    </div>,
    size,
  );
}
