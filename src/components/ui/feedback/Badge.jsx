import React from "react";

/**
 * Vials — Badge
 * Small status/contextual marker. Apothecary-glass accent tints.
 * Used for: SOS, conflict/expiry warnings, safe zones, tracking info.
 */
const TONES = {
  neutral: { fg: "var(--text-secondary)", bg: "var(--surface-sunken)", bd: "var(--border-divider)" },
  sos:     { fg: "var(--status-sos)",     bg: "var(--status-sos-tint)",     bd: "var(--cabernet-line)" },
  warning: { fg: "var(--status-warning)", bg: "var(--status-warning-tint)", bd: "var(--amber-line)" },
  safe:    { fg: "var(--status-safe)",    bg: "var(--status-safe-tint)",    bd: "var(--bottle-green-line)" },
  info:    { fg: "var(--status-info)",    bg: "var(--status-info-tint)",    bd: "var(--cobalt-line)" },
  solid:   { fg: "var(--control-on)",     bg: "var(--control-fill)",        bd: "transparent" },
};

export function Badge({
  children,
  tone = "neutral",       // neutral | sos | warning | safe | info | solid
  size = "md",            // sm | md
  dot = false,            // leading status dot
  uppercase = true,
  style = {},
  ...rest
}) {
  const t = TONES[tone] || TONES.neutral;
  const s = size === "sm"
    ? { fs: "var(--text-2xs)", px: 7, h: 18 }
    : { fs: "var(--text-xs)", px: 9, h: 22 };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: s.h,
        padding: `0 ${s.px}px`,
        background: t.bg,
        color: t.fg,
        border: `var(--border-hair) solid ${t.bd}`,
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-mono)",
        fontSize: s.fs,
        fontWeight: "var(--weight-medium)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: uppercase ? "uppercase" : "none",
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {dot ? (
        <span style={{
          width: 6, height: 6, borderRadius: "var(--radius-pill)",
          background: t.fg, flex: "none",
        }} />
      ) : null}
      {children}
    </span>
  );
}
