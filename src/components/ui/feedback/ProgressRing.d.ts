import * as React from "react";

export interface ProgressRingProps {
  /** 0–100. */
  value?: number;
  size?: number;
  thickness?: number;
  tone?: "sos" | "warning" | "safe" | "info" | "ink";
  /** Center content, e.g. "3/5" or "60%". */
  label?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Routine-completion ring — monochrome track + single accent arc. */
export function ProgressRing(props: ProgressRingProps): JSX.Element;
