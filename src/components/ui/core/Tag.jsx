import React from "react";

/**
 * Vials — Tag
 * Ingredient / formulation chip. Outlined, optionally removable.
 * Accent border tones tie a tag to a functional meaning
 * (e.g. green = restorative ingredient, amber = active/exfoliant).
 */
const TONES = {
  neutral: "var(--border-strong)",
  sos:     "var(--cabernet-line)",
  warning: "var(--amber-line)",
  safe:    "var(--bottle-green-line)",
  info:    "var(--cobalt-line)",
};
const FG = {
  neutral: "var(--text-primary)",
  sos:     "var(--status-sos)",
  warning: "var(--status-warning)",
  safe:    "var(--status-safe)",
  info:    "var(--status-info)",
};

export function Tag({
  children,
  tone = "neutral",
  onRemove = null,
  style = {},
  ...rest
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 28,
        padding: onRemove ? "0 6px 0 12px" : "0 12px",
        background: "var(--surface-raised)",
        color: FG[tone],
        border: `var(--border-hair) solid ${TONES[tone]}`,
        borderRadius: "var(--radius-pill)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-medium)",
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          aria-label="Remove"
          onClick={onRemove}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18, padding: 0, marginLeft: 1,
            border: "none", borderRadius: "var(--radius-pill)",
            background: "transparent", color: "var(--text-tertiary)",
            cursor: "pointer", fontSize: 14, lineHeight: 1,
          }}
        >×</button>
      ) : null}
    </span>
  );
}
