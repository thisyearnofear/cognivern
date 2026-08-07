import type { ReactElement } from "react";

// Shared 1.91:1 social-card art used by both /opengraph-image and /twitter-image.
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;

export function OgCard(): ReactElement {
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background:
          "linear-gradient(140deg, #0d1624 0%, #070b12 48%, #05070b 100%)",
        fontFamily: "'Segoe UI', -apple-system, Roboto, Arial, sans-serif",
        color: "#e6edf3",
      }}
    >
      {/* faint grid via repeating lines + soft glows (no CSS filter — satori-safe) */}
      <div
        style={{
          position: "absolute",
          width: 480,
          height: 480,
          right: -120,
          top: -140,
          borderRadius: "50%",
          background: "rgba(56,189,248,0.14)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          left: -140,
          bottom: -160,
          borderRadius: "50%",
          background: "rgba(124,58,237,0.12)",
        }}
      />

      {/* top: brand mark + wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "linear-gradient(135deg, #38bdf8, #7c3aed)",
            boxShadow: "0 0 34px rgba(56,189,248,0.55)",
          }}
        />
        <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: 2 }}>
          COGNIVERN
        </div>
        <div
          style={{
            marginLeft: 18,
            padding: "10px 22px",
            borderRadius: 999,
            border: "1px solid rgba(56,189,248,0.35)",
            color: "#38bdf8",
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          AI AGENT GOVERNANCE
        </div>
      </div>

      {/* middle: headline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ color: "#38bdf8", fontSize: 26, fontWeight: 700, letterSpacing: 4 }}>
          EVERY APPROVED AGENT SPEND
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 84,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -1,
          }}
        >
          <span>Goes on-chain.</span>
          <span style={{ display: "flex" }}>Stays <span style={{ color: "#38bdf8" }}>auditable.</span></span>
        </div>
        <div style={{ fontSize: 32, color: "#93a4b7", lineHeight: 1.3, maxWidth: 900 }}>
          Policy checks in under 100ms · cryptographic evidence · multi-chain.
        </div>
      </div>

      {/* bottom: domain + tag */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 26,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          color: "#7d8da0",
          fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
          fontSize: 26,
        }}
      >
        <span>cognivern.persidian.com</span>
        <span style={{ color: "#38bdf8" }}>· governance</span>
      </div>
    </div>
  );
}
