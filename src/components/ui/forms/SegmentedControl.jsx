import React from "react";

/**
 * Vials — SegmentedControl
 * Monochrome segmented switch. Used for AM/PM, schedule phases,
 * timeline ranges. The active segment is a white pill on a sunken track.
 */
export function SegmentedControl({
  options = [],           // [{ value, label }] or [string]
  value,
  onChange = () => {},
  size = "md",            // sm | md
  fullWidth = true,
  style = {},
  ...rest
}) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const h = size === "sm" ? 32 : 40;

  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        width: fullWidth ? "100%" : "auto",
        padding: 3,
        gap: 3,
        background: "var(--surface-sunken)",
        border: "var(--border-hair) solid var(--border-divider)",
        borderRadius: "var(--radius-md)",
        ...style,
      }}
      {...rest}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={(e) => onChange(it.value, e)}
            style={{
              flex: fullWidth ? 1 : "none",
              height: h,
              padding: "0 16px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: active ? "var(--surface-raised)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              fontFamily: "var(--font-sans)",
              fontSize: size === "sm" ? "var(--text-sm)" : "var(--text-base)",
              fontWeight: active ? "var(--weight-semibold)" : "var(--weight-medium)",
              letterSpacing: "var(--tracking-tight)",
              cursor: "pointer",
              boxShadow: active ? "var(--shadow-xs)" : "none",
              transition: "background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)",
              whiteSpace: "nowrap",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
