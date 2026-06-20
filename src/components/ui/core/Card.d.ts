import * as React from "react";

/**
 * Bone-surface container with hairline border — the core layout primitive.
 * @startingPoint section="Core" subtitle="Cards, list rows & surfaces" viewport="700x340"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "surface" | "raised" | "flat";
  padding?: "none" | "sm" | "md" | "lg";
  /** Adds hover lift + pointer affordance. */
  interactive?: boolean;
  children?: React.ReactNode;
}

/** Bone-surface container with hairline border — the core layout primitive. */
export function Card(props: CardProps): JSX.Element;
