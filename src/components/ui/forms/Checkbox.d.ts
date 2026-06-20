import * as React from "react";

/**
 * Routine-step checkbox. Checked = Cabernet fill (active trigger).
 * @startingPoint section="Forms" subtitle="Checkbox, switch, segmented & inputs" viewport="700x320"
 */
export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean, e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  size?: "sm" | "md";
  disabled?: boolean;
  style?: React.CSSProperties;
}

/** Routine-step checkbox. Checked = Cabernet fill (active trigger). */
export function Checkbox(props: CheckboxProps): JSX.Element;
