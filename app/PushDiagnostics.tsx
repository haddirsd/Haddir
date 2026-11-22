"use client";

import { useEffect, useState } from "react";

type DiagnosticEntry = {
  stage: string;
  at: string;
  permission?: string;
  title?: string;
  body?: string;
  url?: string;
  error?: string;
  hasData?: boolean;
};

export function PushDiagnostics() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const [status, setStatus] = useState("جارٍ قراءة سجل Service Worker...");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("push-diagnostic") !== "1") return;
    setVisible(true);
    let cancelled = false;
    const read = async () => {
      try {
        const registration = await navigator.serviceWorker?.ready;
        const worker = registration?.active;
        if (!worker) throw new Error("لا يوجد Service Worker نشط");
        const channel = new MessageChannel();
        const result = await new Promise<{ entries?: DiagnosticEntry[] }>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("انتهت مهلة قراءة سجل Service Worker")), 4000);
          channel.port1.onmessage = (event) => {
            window.clearTimeout(timeout);
            resolve(event.data);
          };
          worker.postMessage({ type: "HADDIR_GET_PUSH_DIAGNOSTICS" }, [channel.port2]);
        });
        if (!cancelled) {
          setEntries(result.entries || []);
          setStatus("تمت قراءة السجل المحفوظ على الجهاز.");
        }
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "تعذر قراءة السجل");
      }
    };
    void read();
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;
  return (
    <aside dir="rtl" role="status" aria-live="polite" style={{
      position: "fixed", zIndex: 10002, inset: "12px 12px auto", maxWidth: 520,
      maxHeight: "75vh", overflow: "auto", marginInline: "auto", padding: 14,
      border: "1px solid #5B2EFF", borderRadius: 14, background: "#fff", color: "#171717",
      boxShadow: "0 8px 28px rgba(0,0,0,.22)", fontFamily: "sans-serif", fontSize: 13,
    }}>
      <strong>تشخيص استقبال إشعارات حاضر</strong>
      <p>{status}</p>
      {entries.length === 0 ? <p>لا توجد أحداث Push محفوظة في Service Worker حتى الآن.</p> : (
        <ol style={{ paddingInlineStart: 22 }}>
          {entries.map((entry, index) => (
            <li key={index} style={{ marginBottom: 9, overflowWrap: "anywhere" }}>
              <b>{entry.stage}</b>
              <div>{new Date(entry.at).toLocaleString("ar")}</div>
              {entry.title && <div>العنوان: {entry.title}</div>}
              {entry.permission && <div>الإذن: {entry.permission}</div>}
              {entry.error && <div>الخطأ: {entry.error}</div>}
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={() => setVisible(false)} style={{
        border: 0, borderRadius: 8, padding: "8px 12px", background: "#5B2EFF",
        color: "#fff", font: "inherit",
      }}>إغلاق</button>
    </aside>
  );
}
