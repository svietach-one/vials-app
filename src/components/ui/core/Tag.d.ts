import * as React from "react";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "sos" | "warning" | "safe" | "info";
  /** When provided, renders a remove (×) affordance. */
  onRemove?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}

/** Pill chip for ingredients / formulation labels. */
export function Tag(props: TagProps): JSX.Element;
