import * as React from "react";

/**
 * Primary action control for Vials. Monochrome by design.
 * @startingPoint section="Core" subtitle="Buttons, icon buttons, badges & tags" viewport="700x340"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Accent colors never fill a button; `destructive` is a Cabernet outline. */
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  /** Leading icon node (e.g. a Lucide <i data-lucide> or SVG). */
  icon?: React.ReactNode;
  /** Trailing icon node. */
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

/** Primary action control for Vials. Monochrome by design. */
export function Button(props: ButtonProps): JSX.Element;
