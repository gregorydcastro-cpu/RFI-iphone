import { ImageResponse } from "next/og";
import {
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_SAMPLE_JOBS,
  OG_TAGLINE_LINES,
} from "@/lib/siteMetadata";
import { SITE_BACKGROUND_COLOR, SITE_NAME, SITE_THEME_COLOR } from "@/lib/siteInfo";

export const alt = OG_IMAGE_ALT;
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = "image/png";

/** Matches --gline-cta, --gline-secondary, and --gline-tan in app/globals.css. */
const CTA = "#e10600";
const PAPER = "#f5f1eb";
const TAN = "#c8bdac";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: SITE_BACKGROUND_COLOR,
          color: PAPER,
        }}
      >
        <div
          style={{
            height: 8,
            width: "100%",
            backgroundColor: CTA,
            display: "flex",
          }}
        />
        <div
          style={{
            height: 96,
            width: "100%",
            backgroundColor: SITE_THEME_COLOR,
            display: "flex",
            alignItems: "center",
            paddingLeft: 64,
            paddingRight: 64,
          }}
        >
          <div
            style={{
              width: 8,
              height: 44,
              backgroundColor: CTA,
              display: "flex",
              marginRight: 16,
            }}
          />
          <div style={{ fontSize: 40, display: "flex" }}>{SITE_NAME}</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flexGrow: 1,
            paddingLeft: 72,
            paddingRight: 72,
          }}
        >
          <div style={{ fontSize: 64, display: "flex" }}>{OG_TAGLINE_LINES[0]}</div>
          <div style={{ fontSize: 64, display: "flex", marginTop: 10 }}>
            {OG_TAGLINE_LINES[1]}
          </div>
        </div>
        <div
          style={{
            height: 124,
            width: "100%",
            backgroundColor: SITE_THEME_COLOR,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: 72,
            paddingRight: 72,
          }}
        >
          <div style={{ fontSize: 22, color: TAN, display: "flex" }}>
            Sample jobs
          </div>
          <div style={{ fontSize: 36, display: "flex", marginTop: 10 }}>
            {OG_SAMPLE_JOBS.join("   ·   ")}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
