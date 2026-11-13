"use client";

import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "outline" | "light" | "danger";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary", outline: "btn-outline", light: "btn-light", danger: "btn-danger",
};

export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return <button {...props} type={type} className={["btn", variantClass[variant], className].filter(Boolean).join(" ")} />;
}
