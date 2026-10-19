import { ImageResponse } from "next/og";

// Home-screen app icons, listed in app/manifest.ts. Same mark as the logo
// (a coral die whose three pips form a play button), drawn at each size.
//  - icon-*: the rounded tile on a transparent background, for launchers that
//    show the icon as-is.
//  - maskable-*: full-bleed coral, pips inside the central safe zone, for
//    Android launchers that crop icons to circles, squircles and so on.

const PIPS = [
  [24, 20],
  [24, 44],
  [46, 32],
];

const ICONS: Record<string, { size: number; maskable: boolean }> = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!Object.hasOwn(ICONS, name)) return new Response("Not found", { status: 404 });
  const { size, maskable } = ICONS[name];
  // The 64-unit logo grid drawn over the whole icon (maskable: shrunk into the
  // middle 72%, so no crop shape cuts into the pips).
  const tile = maskable ? size * 0.72 : size;
  const scale = tile / 64;
  const offset = (size - tile) / 2;
  const r = 6.5 * scale;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
        <div
          style={{
            // (Explicit box: the image renderer doesn't support `inset`.)
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size,
            background: "#FF5A5F",
            // The rounded tile of the logo (rx 16 on the 64 grid); maskable icons are cropped by the launcher instead.
            borderRadius: maskable ? 0 : (16 / 64) * size,
          }}
        />
        {PIPS.map(([cx, cy]) => (
          <div
            key={`${cx}-${cy}`}
            style={{
              position: "absolute",
              left: offset + cx * scale - r,
              top: offset + cy * scale - r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              background: "#FFF8F2",
            }}
          />
        ))}
      </div>
    ),
    { width: size, height: size },
  );
}
