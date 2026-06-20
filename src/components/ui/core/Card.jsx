import React from "react";

/**
 * Vials — Card
 * Bone/cream surface, hairline border, soft low shadow.
 * The structural container for almost everything in the app.
 */
export function Card({
  children,
  variant = "surface",   // surface | raised | flat
  padding = "md",        // none | sm | md | lg
  interactive = false,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);

  const pad = { none: 0, sm: "var(--space-3)", md: "var(--gap-card)", lg: "var(--space-6)" }[padding];

  const variants = {
    surface: {
      background: "var(--surface-card)",
      border: "var(--border-hair) solid var(--border-divider)",
      boxShadow: "var(--shadow-none)",
    },
    raised: {
      background: "var(--surface-raised)",
      border: "var(--border-hair) solid var(--border-divider)",
      boxShadow: "var(--shadow-md)",
    },
    flat: {
      background: "transparent",
      border: "var(--border-hair) solid var(--border-divider)",
      boxShadow: "none",
    },
  }[variant];

  return (
    <div
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{
        borderRadius: "var(--radius-lg)",
        padding: pad,
        transition: "box-shadow var(--dur-base) var(--ease-standard), transform var(--dur-base) var(--ease-standard)",
        cursor: interactive ? "pointer" : "default",
        transform: interactive && hover ? "translateY(-1px)" : "none",
        boxShadow: interactive && hover ? "var(--shadow-md)" : variants.boxShadow,
        ...variants,
        ...(interactive && hover ? {} : {}),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
