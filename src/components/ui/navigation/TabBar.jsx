import React from "react";

/**
 * Vials — TabBar
 * Bottom navigation for the mobile app. Frosted apothecary-glass
 * chrome; active item is off-black, inactive is zinc.
 */
export function TabBar({
  items = [],             // [{ key, label, icon }]
  active,
  onChange = () => {},
  style = {},
  ...rest
}) {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 2,
        padding: "8px 8px 10px",
        background: "var(--glass-fill)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        borderTop: "var(--border-hair) solid var(--border-divider)",
        ...style,
      }}
      {...rest}
    >
      {items.map((it) => {
        const on = it.key === active;
        return (
          <button
            key={it.key}
            type="button"
            aria-current={on ? "page" : undefined}
            onClick={(e) => onChange(it.key, e)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              minHeight: 48,
              padding: "4px 0",
              border: "none",
              background: "transparent",
              color: on ? "var(--text-primary)" : "var(--text-tertiary)",
              cursor: "pointer",
              transition: "color var(--dur-fast) var(--ease-standard)",
            }}
          >
            <span style={{ display: "inline-flex" }}>{it.icon}</span>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              fontWeight: "var(--weight-medium)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
            }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
