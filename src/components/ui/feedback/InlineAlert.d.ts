import * as React from "react";

export interface InlineAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "sos" | "warning" | "safe" | "info";
  icon?: React.ReactNode;
  title?: React.ReactNode;
  /** Optional trailing action node (e.g. a ghost Button). */
  action?: React.ReactNode;
  children?: React.ReactNode;
}

/** Contextual notice for conflicts, expirations, transitions, and info. */
export function InlineAlert(props: InlineAlertProps): JSX.Element;
