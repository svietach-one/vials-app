import React from "react";

/**
 * Vials — Switch
 * Monochrome toggle (black when on). Setting / preference control.
 */
export function Switch({
  checked = false,
  onChange = () => {},
  disabled = false,
  size = "md",            // sm | md
  style = {},
  ...rest
}) {
  const w = size === "sm" ? 38 : 46;
  const h = size === "sm" ? 22 : 28;
  const knob = h - 6;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => onChange(!checked, e)}
      style={{
        position: "relative",
        width: w,
        height: h,
        flex: "none",
        padding: 0,
        border: "none",
        borderRadius: "var(--radius-pill)",
        background: checked ? "var(--control-fill)" : "var(--border-strong)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background var(--dur-base) var(--ease-standard)",
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? w - knob - 3 : 3,
          width: knob,
          height: knob,
          borderRadius: "var(--radius-pill)",
          background: "var(--white)",
          boxShadow: "var(--shadow-sm)",
          transition: "left var(--dur-base) var(--ease-standard)",
        }}
      />
    </button>
  );
}
