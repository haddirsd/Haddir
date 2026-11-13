"use client";

import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string };

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  const inputId = id ?? (label ? label.replace(/\\s+/g, "-") : undefined);
  return (
    <label className="haddir-field" htmlFor={inputId}>
      {label && <span className="haddir-field-label">{label}</span>}
      <input {...props} id={inputId} className={["haddir-input", className].filter(Boolean).join(" ")} aria-invalid={error ? true : props["aria-invalid"]} />
      {error && <span className="haddir-field-error" role="alert">{error}</span>}
    </label>
  );
}
