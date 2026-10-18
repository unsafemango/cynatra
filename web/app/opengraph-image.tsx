import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// The share preview for every page that doesn't have its own (title pages use
// the title's backdrop): the logo, the name and what Cynatra does.
export const alt = `${SITE_NAME}: ${SITE_TAGLINE.toLowerCase()}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same pip positions as the logo mark (64-unit grid).
const PIPS = [
  [24, 20],
  [24, 44],
  [46, 32],
];
const MARK = 168;
const SCALE = MARK / 64;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "linear-gradient(135deg, #14121c 0%, #1d1a29 60%, #2a1a24 100%)",
          color: "#f6f5fa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div
            style={{
              width: MARK,
              height: MARK,
              borderRadius: 44,
              background: "#FF5A5F",
              position: "relative",
              display: "flex",
            }}
          >
            {PIPS.map(([cx, cy]) => (
              <div
                key={`${cx}-${cy}`}
                style={{
                  position: "absolute",
                  left: cx * SCALE - 7 * SCALE,
                  top: cy * SCALE - 7 * SCALE,
                  width: 14 * SCALE,
                  height: 14 * SCALE,
                  borderRadius: "50%",
                  background: "#FFF8F2",
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: "-0.04em" }}>cynatra</div>
        </div>
        <div style={{ marginTop: 56, fontSize: 60, fontWeight: 700, letterSpacing: "-0.02em", display: "flex" }}>
          Stop scrolling.&nbsp;<span style={{ color: "#FF5A5F" }}>Start watching.</span>
        </div>
        <div style={{ marginTop: 20, fontSize: 34, color: "#b9b6c8" }}>
          One movie or series for tonight, in a single spin.
        </div>
      </div>
    ),
    size,
  );
}
