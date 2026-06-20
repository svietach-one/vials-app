import * as React from "react";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label?: React.ReactNode;
  value?: string;
  onChange?: (value: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  /** Trailing unit / suffix (e.g. "%", "ml"). */
  suffix?: React.ReactNode;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  disabled?: boolean;
}

/** Text field with mono apothecary label, icon, suffix, and helper/error. */
export function Input(props: InputProps): JSX.Element;
