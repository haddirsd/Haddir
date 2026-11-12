"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type HaddirSelectOption = { value: string; label: string; disabled?: boolean };

export function HaddirSelect({ value, options, onChange, placeholder = "اختر...", disabled = false, ariaLabel }: {
  value: string;
  options: HaddirSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return (
    <div className="haddir-select">
      <button type="button" className="haddir-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen(current => !current}>
        <span className={!selected ? "is-placeholder" : ""}>{selected?.label || placeholder}</span><ChevronDown size={17}/>
      </button>
      {open && <><button type="button" className="haddir-select-dismiss" aria-label="إغلاق القائمة" onClick={() => setOpen(false)}/><div className="haddir-select-menu" role="listbox" aria-label={ariaLabel}>
        {options.map(option => <button type="button" role="option" aria-selected={option.value === value} key={option.value} disabled={option.disabled} className={"haddir-select-option" + (option.value === value ? " is-selected" : "")} onClick={() => { onChange(option.value); setOpen(false); }}>
          <span>{option.label}</span>{option.value === value && <Check size={16}/>}
        </button>)}
      </div></>}
    </div>
  );
}
