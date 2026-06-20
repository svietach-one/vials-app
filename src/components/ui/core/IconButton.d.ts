import * as React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon node (Lucide / SVG). */
  icon: React.ReactNode;
  /** Required accessible label. */
  label: string;
  variant?: "ghost" | "secondary" | "filled";
  size?: "sm" | "md" | "lg";
  round?: boolean;
  disabled?: boolean;
}

/** Icon-only control with a 44px minimum hit target. */
export function IconButton(props: IconButtonProps): JSX.Element;
