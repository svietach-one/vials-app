import React from "react";

/**
 * Vials — Checkbox
 * Active/checked fill is Cabernet — the brand's "active checklist
 * trigger" state (routine step completed, SOS step acknowledged).
 */
export function Checkbox({
  checked = false,
  onChange = () => {},
  label = null,
  sublabel = null,
  size = "md",            // sm | md
  disabled = false,
  style = {},
  ...rest
}) {
  const dim = size === "sm" ? 18 : 22;

  const box = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dim,
        height: dim,
        flex: "none",
        borderRadius: "var(--radius-xs)",
        border: checked
          ? "var(--border-hair) solid var(--cabernet)"
          : "var(--border-thick) solid var(--border-strong)",
        background: checked ? "var(--cabernet)" : "var(--surface-raised)",
        color: "var(--white)",
        transition: "background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)",
      }}
    >
      {checked ? (
        <svg width={dim * 0.62} height={dim * 0.62} viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : null}
    </span>
  );

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: sublabel ? "flex-start" : "center",
        gap: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
      {...rest}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked, e)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      {box}
      {(label || sublabel) ? (
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {label ? (
            <span style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-base)",
              fontWeight: "var(--weight-medium)",
              color: "var(--text-primary)",
              textDecoration: checked ? "line-through" : "none",
              textDecorationColor: "var(--text-tertiary)",
              lineHeight: 1.3,
            }}>{label}</span>
          ) : null}
          {sublabel ? (
            <span style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              lineHeight: 1.3,
            }}>{sublabel}</span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}
