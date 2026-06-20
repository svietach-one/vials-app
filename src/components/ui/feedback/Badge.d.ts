import * as React from "react";

/**
 * Compact status / contextual marker using apothecary-glass accent tints.
 * @startingPoint section="Feedback" subtitle="Badges, status tags & alerts" viewport="700x300"
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Maps to Vials functional accents. */
  tone?: "neutral" | "sos" | "warning" | "safe" | "info" | "solid";
  size?: "sm" | "md";
  /** Show a leading status dot. */
  dot?: boolean;
  uppercase?: boolean;
  children?: React.ReactNode;
}

/** Compact status / contextual marker using apothecary-glass accent tints. */
export function Badge(props: BadgeProps): JSX.Element;
