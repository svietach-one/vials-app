import React from "react";

/**
 * Vials — IconButton
 * Square/circular icon-only control. Min 44px hit target.
 */
export function IconButton({
  icon,
  label,                 // accessible label (required)
  variant = "ghost",     // ghost | secondary | filled
  size = "md",           // sm | md | lg
  round = false,
  disabled = false,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);

  const dim = { sm: 36, md: 44, lg: 52 }[size];

  const variants = {
    ghost: {
      background: hover ? "var(--surface-sunken)" : "transparent",
      color: "var(--text-primary)",
      border: "var(--border-hair) solid transparent",
    },
    secondary: {
      background: hover ? "var(--surface-sunken)" : "var(--surface-card)",
      color: "var(--text-primary)",
      border: "var(--border-hair) solid var(--border-strong)",
    },
    filled: {
      background: hover ? "var(--control-fill-hover)" : "var(--control-fill)",
      color: "var(--control-on)",
      border: "var(--border-hair) solid transparent",
    },
  }[variant];

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dim,
        height: dim,
        borderRadius: round ? "var(--radius-pill)" : "var(--radius-md)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transform: press && !disabled ? "scale(0.94)" : "scale(1)",
        transition: "background var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)",
        ...variants,
        ...style,
      }}
      {...rest}
    >
      {icon}
    </button>
  );
}
