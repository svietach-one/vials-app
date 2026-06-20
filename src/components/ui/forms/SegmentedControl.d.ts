import * as React from "react";

export interface SegmentOption { value: string; label: React.ReactNode; }

export interface SegmentedControlProps {
  options: (SegmentOption | string)[];
  value: string;
  onChange?: (value: string, e: React.MouseEvent) => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

/** Monochrome segmented switch (AM/PM, schedule phases, ranges). */
export function SegmentedControl(props: SegmentedControlProps): JSX.Element;
