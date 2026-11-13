"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type HaddirSelectOption = { value: string; label: string; disabled?: boolean };

type MenuPosition = { top: number; left: number; width: number; maxHeight: number };

export function HaddirSelect({ value, options, onChange, placeholder = "اختر...", disabled = false, ariaLabel }: {
  value: string;
  options: HaddirSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!open) { setPosition(null); return; }
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 7;
      const viewportPadding = 12;
      const desiredHeight = Math.min(260, Math.max(48, options.length * 52 + 12));
      const below = window.innerHeight - rect.bottom - viewportPadding - gap;
      const above = rect.top - viewportPadding - gap;
      const placeBelow = below >= Math.min(desiredHeight, 150) || below >= above;
      const maxHeight = Math.max(100, Math.min(desiredHeight, placeBelow ? below : above));
      setPosition({
        top: placeBelow ? rect.bottom + gap : Math.max(viewportPadding, rect.top - gap - maxHeight),
        left: Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - rect.width - viewportPadding)),
        width: rect.width,
        maxHeight,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, options.length]);

  const menu = open && typeof document !== "undefined" ? createPortal(
    <>
      <button type="button" className="haddir-select-dismiss" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} />
      {position && <div className={"haddir-select-menu haddir-select-menu-portal" + (document.querySelector(".app-shell.theme-dark, .admin-shell.theme-dark") ? " theme-dark" : "")} role="listbox" aria-label={ariaLabel} style={{ position: "fixed", top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}>
        {options.map(option => <button type="button" role="option" aria-selected={option.value === value} key={option.value} disabled={option.disabled} className={"haddir-select-option" + (option.value === value ? " is-selected" : "")} onClick={() => { onChange(option.value); setOpen(false); }}>
          <span>{option.label}</span>{option.value === value && <Check size={16}/>}
        </button>)}
      </div>}
    </>,
    document.body
  ) : null;

  return (
    <div className="haddir-select">
      <button ref={triggerRef} type="button" className="haddir-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen(current => !current)}>
        <span className={!selected ? "is-placeholder" : ""}>{selected?.label || placeholder}</span><ChevronDown size={17}/>
      </button>
      {menu}
    </div>
  );
}
