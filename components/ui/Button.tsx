"use client";

import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";

type ButtonVariant = "primary" | "outline" | "light" | "danger";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  isLoading?: boolean;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary", outline: "btn-outline", light: "btn-light", danger: "btn-danger",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  isLoading = false,
  disabled = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={["btn", variantClass[variant], className].filter(Boolean).join(" ")}
    >
      {isLoading && <LoaderCircle size={16} aria-hidden="true" className="haddir-button-spinner" />}
      {children}
    </button>
  );
}
