import React from "react";

/**
 * Vials — InlineAlert
 * Contextual notice for ingredient conflicts, PAO expirations,
 * fading-zone transitions, and informational banners.
 * Tinted small surface — never a full-bleed accent fill.
 */
const TONES = {
  sos:     { fg: "var(--status-sos)",     bg: "var(--status-sos-tint)",     bd: "var(--cabernet-line)" },
  warning: { fg: "var(--status-warning)", bg: "var(--status-warning-tint)", bd: "var(--amber-line)" },
  safe:    { fg: "var(--status-safe)",    bg: "var(--status-safe-tint)",    bd: "var(--bottle-green-line)" },
  info:    { fg: "var(--status-info)",    bg: "var(--status-info-tint)",    bd: "var(--cobalt-line)" },
};

export function InlineAlert({
  tone = "warning",       // sos | warning | safe | info
  icon = null,
  title = null,
  children = null,
  action = null,
  style = {},
  ...rest
}) {
  const t = TONES[tone] || TONES.warning;
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: 11,
        padding: "12px 14px",
        background: t.bg,
        border: `var(--border-hair) solid ${t.bd}`,
        borderRadius: "var(--radius-md)",
        ...style,
      }}
      {...rest}
    >
      {icon ? (
        <span style={{ display: "inline-flex", color: t.fg, flex: "none", marginTop: 1 }}>{icon}</span>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title ? (
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-semibold)",
            color: t.fg,
            marginBottom: children ? 2 : 0,
            letterSpacing: "var(--tracking-tight)",
          }}>{title}</div>
        ) : null}
        {children ? (
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: 1.45,
          }}>{children}</div>
        ) : null}
      </div>
      {action ? <div style={{ flex: "none", alignSelf: "center" }}>{action}</div> : null}
    </div>
  );
}
