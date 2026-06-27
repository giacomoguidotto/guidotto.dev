import { ImageResponse } from "next/og";
import { content } from "~/content";

// The shared social share card, rendered by both the OpenGraph and Twitter image
// routes. The cards declare `summary_large_image`, so they need a real 1200x630
// image or the preview renders blank. Built from the locked content surface (no
// invented copy) so the card can never drift from the page.

export const ogAlt = `${content.site.name}, ${content.site.jobTitle}`;
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

// Hex restatements of the locked oklch stage tokens (globals.css). Satori cannot
// parse oklch, so the brand field is approximated here in sRGB.
const STAGE_DEEP = "#06070c";
const STAGE = "#0b0d15";
const IVORY = "#f1ebdd";
const ACCENT = "#9b99f0"; // showpiece periwinkle — the one earned accent

const LOGO_PATHS = [
  "M52.8 14.8C53.1 14.7 54.4 13.7 53.5 13.6C53.1 13.5 52.6 13.8 52.3 14.1C51.4 14.7 50.6 15.5 49.8 16.1C46.2 19 43.1 22.3 40 25.6C37 28.8 34.2 31.9 31.5 35.2C29.8 37.4 28.2 39.6 26.5 41.8C23.4 45.7 20.1 49.4 17.1 53.5C14.3 57.4 11.5 61.3 8.6 65.1C7.7 66.4 6.6 67.7 5.7 69C5.4 69.4 5.4 69.9 5 70.3",
  "M5.4 70.2C7 70.2 8.8 69 10.3 68.3C12.9 67 15.6 65.9 18.2 64.7C26.3 60.9 34.8 58 43.1 54.9C46 53.8 48.9 52.7 52 52.3C52.7 52.1 54.9 51.5 55 52.7C55 53.7 53.9 54.8 53.3 55.4C51.4 57.4 49.2 59.1 47 60.7C40.9 65.2 34.2 69.1 27.7 73C25.6 74.3 23.4 75.5 21.6 77C20.8 77.7 19.9 78.2 19.5 79.1L20.4 79.1L19.9 78.5",
  "M20.5 79.1C24.9 76.6 29.6 74.7 34.3 72.8C38.1 71.2 41.9 69.7 45.8 68.4C49.7 67 54 65.3 58.2 64.9C60.4 64.6 62.5 64.7 64.5 65.9C66.2 66.8 67.5 68.5 69.5 69C73.1 69.9 76.8 67.7 79.9 66.1C81.4 65.3 83 64.7 84.4 63.7",
] as const;

function LogoMark() {
  return (
    <div
      style={{
        width: "112px",
        height: "112px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: "26px",
        border: `1px solid ${IVORY}26`,
        backgroundColor: STAGE_DEEP,
        backgroundImage: `radial-gradient(82% 82% at 50% 18%, #171d2a 0%, ${STAGE} 56%, ${STAGE_DEEP} 100%)`,
      }}
    >
      <svg
        aria-label="guidotto.dev logo"
        fill="none"
        height="112"
        role="img"
        viewBox="0 0 512 512"
        width="112"
      >
        <g
          stroke={IVORY}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.75"
          transform="translate(44 38) scale(4.58)"
        >
          {LOGO_PATHS.map((path) => (
            <path d={path} key={path} />
          ))}
        </g>
      </svg>
    </div>
  );
}

export function renderOgCard(): ImageResponse {
  const { site, hero } = content;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "80px",
        backgroundColor: STAGE_DEEP,
        backgroundImage: `radial-gradient(120% 120% at 100% 0%, ${STAGE} 0%, ${STAGE_DEEP} 60%)`,
        color: IVORY,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "26px",
            letterSpacing: "0.32em",
            color: ACCENT,
          }}
        >
          {hero.eyebrow}
        </div>
        <LogoMark />
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: "104px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.04,
          }}
        >
          {site.name}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "20px",
            fontSize: "40px",
            color: `${IVORY}cc`,
          }}
        >
          {site.jobTitle}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "30px",
            color: `${IVORY}b3`,
            maxWidth: "780px",
            lineHeight: 1.3,
          }}
        >
          {hero.subline}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "26px",
            letterSpacing: "0.06em",
            color: `${IVORY}99`,
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: ACCENT,
            }}
          />
          {new URL(site.url).host}
        </div>
      </div>
    </div>,
    ogSize
  );
}
