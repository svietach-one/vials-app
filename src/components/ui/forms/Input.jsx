import React from "react";

/**
 * Vials — Input
 * Text field with optional mono uppercase label (apothecary style),
 * leading icon, and helper / error text. Focus ring is monochrome.
 */
export function Input({
  label = null,
  value,
  onChange = () => {},
  placeholder = "",
  type = "text",
  icon = null,
  suffix = null,
  helper = null,
  error = null,
  disabled = false,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const borderColor = error
    ? "var(--status-sos)"
    : focus
    ? "var(--border-focus)"
    : "var(--border-input)";

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%", ...style }}>
      {label ? (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-2xs)",
          fontWeight: "var(--weight-medium)",
          letterSpacing: "var(--tracking-label)",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}>{label}</span>
      ) : null}

      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 48,
          padding: "0 14px",
          background: disabled ? "var(--surface-sunken)" : "var(--surface-raised)",
          border: `var(--border-thick) solid ${borderColor}`,
          borderRadius: "var(--radius-md)",
          transition: "border-color var(--dur-fast) var(--ease-standard)",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {icon ? <span style={{ display: "inline-flex", color: "var(--text-tertiary)", flex: "none" }}>{icon}</span> : null}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value, e)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-base)",
            color: "var(--text-primary)",
          }}
          {...rest}
        />
        {suffix ? (
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            flex: "none",
          }}>{suffix}</span>
        ) : null}
      </span>

      {(helper || error) ? (
        <span style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-sm)",
          color: error ? "var(--status-sos)" : "var(--text-secondary)",
        }}>{error || helper}</span>
      ) : null}
    </label>
  );
}
