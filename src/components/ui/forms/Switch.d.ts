import * as React from "react";

export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean, e: React.MouseEvent) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

/** Monochrome preference toggle (black when on). */
export function Switch(props: SwitchProps): JSX.Element;
