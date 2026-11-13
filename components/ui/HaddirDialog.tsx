"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type HaddirDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger" | "success";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children?: ReactNode;
};

export function HaddirDialog({ open, title, description, confirmLabel = "تأكيد", cancelLabel = "إلغاء", tone = "primary", busy = false, onConfirm, onCancel, children }: HaddirDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setMounted(true);
    const syncTheme = () => setDarkMode(document.documentElement.dataset.theme === "dark");
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  if (!open || !mounted) return null;
  const Icon = tone === "danger" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;

  return createPortal(
    <div className={"haddir-dialog-root" + (darkMode ? " theme-dark" : "")}>
      <div className="haddir-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
        <section className="haddir-dialog" role="dialog" aria-modal="true" aria-labelledby="haddir-dialog-title">
          <button className="haddir-dialog-close" type="button" aria-label="إغلاق" onClick={onCancel} disabled={busy}><X size={18}/></button>
          <span className={"haddir-dialog-icon tone-" + tone}><Icon size={27}/></span>
          <h2 id="haddir-dialog-title">{title}</h2>
          {description && <p>{description}</p>}
          {children}
          <div className="haddir-dialog-actions">
            <button type="button" className={"haddir-dialog-confirm tone-" + tone} onClick={() => void onConfirm()} disabled={busy}>{busy ? "جاري التنفيذ..." : confirmLabel}</button>
            <button type="button" className="haddir-dialog-cancel" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}
