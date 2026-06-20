import * as React from "react";

export interface TabBarItem {
  key: string;
  label: React.ReactNode;
  icon: React.ReactNode;
}

/**
 * Frosted-glass bottom navigation for the mobile app.
 * @startingPoint section="Navigation" subtitle="Bottom tab bar & segmented nav" viewport="700x220"
 */
export interface TabBarProps {
  items: TabBarItem[];
  active: string;
  onChange?: (key: string, e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

/** Frosted-glass bottom navigation for the mobile app. */
export function TabBar(props: TabBarProps): JSX.Element;
