import { ImageResponse } from "next/og";

// iPhone home-screen icon. iOS rounds the corners itself, so this is full-bleed.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same pip positions as the logo mark (64-unit grid), scaled to 180 px.
const PIPS = [
  [24, 20],
  [24, 44],
  [46, 32],
];
const SCALE = 180 / 64;
const R = 6.5 * SCALE;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#FF5A5F" }}>
        {PIPS.map(([cx, cy]) => (
          <div
            key={`${cx}-${cy}`}
            style={{
              position: "absolute",
              left: cx * SCALE - R,
              top: cy * SCALE - R,
              width: R * 2,
              height: R * 2,
              borderRadius: "50%",
              background: "#FFF8F2",
            }}
          />
        ))}
      </div>
    ),
    size,
  );
}
