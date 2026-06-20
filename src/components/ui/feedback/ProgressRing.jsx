import React from "react";

/**
 * Vials — ProgressRing
 * Routine-completion ring. Monochrome track with a single accent arc
 * (defaults to Cabernet — the active/completed signal).
 */
const STROKE = {
  sos: "var(--status-sos)",
  warning: "var(--status-warning)",
  safe: "var(--status-safe)",
  info: "var(--status-info)",
  ink: "var(--text-primary)",
};

export function ProgressRing({
  value = 0,              // 0..100
  size = 56,
  thickness = 5,
  tone = "sos",           // sos | warning | safe | info | ink
  label = null,           // center content (e.g. "3/5")
  style = {},
  ...rest
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;

  return (
    <div style={{ position: "relative", width: size, height: size, ...style }} {...rest}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="var(--border-divider)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={STROKE[tone]} strokeWidth={thickness} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset var(--dur-slow) var(--ease-standard)" }} />
      </svg>
      {label != null ? (
        <span style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: size > 48 ? "var(--text-sm)" : "var(--text-2xs)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--text-primary)",
        }}>{label}</span>
      ) : null}
    </div>
  );
}
