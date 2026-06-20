import React from "react";

/**
 * Vials — Button
 * Monochrome controls. Accent colors NEVER fill a primary button;
 * the destructive/SOS variant uses a Cabernet outline + tint instead.
 */
export function Button({
  children,
  variant = "primary",   // primary | secondary | ghost | destructive
  size = "md",           // sm | md | lg
  icon = null,
  iconRight = null,
  fullWidth = false,
  disabled = false,
  type = "button",
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);

  const sizes = {
    sm: { h: 36, px: 14, gap: 6, fs: "var(--text-sm)" },
    md: { h: 44, px: 18, gap: 8, fs: "var(--text-base)" },
    lg: { h: 52, px: 24, gap: 9, fs: "var(--text-md)" },
  }[size];

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: sizes.gap,
    height: sizes.h,
    padding: `0 ${sizes.px}px`,
    width: fullWidth ? "100%" : "auto",
    fontFamily: "var(--font-sans)",
    fontSize: sizes.fs,
    fontWeight: "var(--weight-semibold)",
    letterSpacing: "var(--tracking-tight)",
    lineHeight: 1,
    border: "var(--border-hair) solid transparent",
    borderRadius: "var(--radius-md)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transform: press && !disabled ? "scale(0.98)" : "scale(1)",
    transition: "background var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)",
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  const variants = {
    primary: {
      background: hover ? "var(--control-fill-hover)" : "var(--control-fill)",
      color: "var(--control-on)",
    },
    secondary: {
      background: hover ? "var(--surface-sunken)" : "var(--surface-card)",
      color: "var(--text-primary)",
      borderColor: "var(--border-strong)",
    },
    ghost: {
      background: hover ? "var(--surface-sunken)" : "transparent",
      color: "var(--text-primary)",
    },
    destructive: {
      background: hover ? "var(--status-sos-tint)" : "transparent",
      color: "var(--status-sos)",
      borderColor: "var(--cabernet-line)",
    },
  }[variant];

  return (
    <button
      type={type}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{ ...base, ...variants, ...style }}
      {...rest}
    >
      {icon ? <span style={{ display: "inline-flex", flex: "none" }}>{icon}</span> : null}
      {children}
      {iconRight ? <span style={{ display: "inline-flex", flex: "none" }}>{iconRight}</span> : null}
    </button>
  );
}
