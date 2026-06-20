import * as React from "react";

export interface ListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  divider?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

/** Settings / inventory / product list row with leading + trailing slots. */
export function ListRow(props: ListRowProps): JSX.Element;
