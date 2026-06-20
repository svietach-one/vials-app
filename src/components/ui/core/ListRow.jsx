import React from "react";

/**
 * Vials — ListRow
 * Settings / inventory / product list row. Leading slot, title +
 * subtitle, trailing slot, optional chevron + divider.
 */
export function ListRow({
  leading = null,
  title,
  subtitle = null,
  trailing = null,
  chevron = false,
  divider = true,
  onClick = null,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const interactive = !!onClick;

  return (
    <div
      onClick={onClick || undefined}
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 56,
        padding: "10px 4px",
        borderBottom: divider ? "var(--border-hair) solid var(--border-divider)" : "none",
        cursor: interactive ? "pointer" : "default",
        background: interactive && hover ? "var(--surface-sunken)" : "transparent",
        transition: "background var(--dur-fast) var(--ease-standard)",
        ...style,
      }}
      {...rest}
    >
      {leading ? <div style={{ flex: "none", display: "inline-flex" }}>{leading}</div> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-base)",
          fontWeight: "var(--weight-medium)",
          color: "var(--text-primary)",
          letterSpacing: "var(--tracking-tight)",
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{title}</div>
        {subtitle ? (
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: 1.3,
            marginTop: 1,
          }}>{subtitle}</div>
        ) : null}
      </div>
      {trailing ? <div style={{ flex: "none", display: "inline-flex", alignItems: "center" }}>{trailing}</div> : null}
      {chevron ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      ) : null}
    </div>
  );
}
