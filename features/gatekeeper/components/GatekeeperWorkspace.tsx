"use client";

import { useEffect, useState, type RefObject } from "react";
import { ClipboardList, ScanLine } from "lucide-react";
import type { GatekeeperScanHistoryItem, GatekeeperScanStats, GatekeeperTicketActionResult } from "../types";
import { ManualTicketEntry } from "./ManualTicketEntry";
import { QrScanner } from "./QrScanner";
import { ScanHistory } from "./ScanHistory";

type AssignedEvent = { events?: { title?: string; venue?: string; city?: string; starts_at?: string } } | null;

export function GatekeeperWorkspace({
  userRole, assignedEvent, online, counts, loading, code, result, manualEntryOpen,
  scannerOpen, history, historyLoading, videoRef, onOpenScanner, onOpenManual,
  onCodeChange, onManualSubmit, onAcknowledgeResult, onClose,
}: {
  userRole: string;
  assignedEvent: AssignedEvent;
  online: boolean;
  counts: GatekeeperScanStats;
  loading: boolean;
  code: string;
  result: GatekeeperTicketActionResult | null;
  manualEntryOpen: boolean;
  scannerOpen: boolean;
  history: GatekeeperScanHistoryItem[];
  historyLoading: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onOpenScanner: () => void;
  onOpenManual: () => void;
  onCodeChange: (value: string) => void;
  onManualSubmit: () => void;
  onAcknowledgeResult: () => void;
  onClose: () => void;
}) {
  const [slowRequest, setSlowRequest] = useState(false);
  useEffect(() => {
    if (!loading) { setSlowRequest(false); return; }
    const timer = window.setTimeout(() => setSlowRequest(true), 1400);
    return () => window.clearTimeout(timer);
  }, [loading]);
  const formatDate = (value: string) => new Intl.DateTimeFormat("ar-SD-u-nu-latn", { weekday: "long", day: "numeric", month: "long" }).format(new Date(value));
  return (
    <section className="screen container gatekeeper-page-screen" aria-label="واجهة البواب">
      {(userRole === "gatekeeper" || userRole === "organizer") ? <div className="gatekeeper-workspace">
        <div className="gatekeeper-workspace-head">
          <div><small>مساحة البواب</small><h2>فحص تذاكر الدخول</h2><p>{assignedEvent?.events?.title || "لم يتم ربط فعالية بحسابك"}</p></div>
          <div className="gatekeeper-head-actions">
            <span className={"gatekeeper-network " + (online ? "online" : "offline")}><i />{online ? "متصل بالشبكة" : "غير متصل"}</span>
            <button type="button" className="btn btn-outline" onClick={onClose}>إغلاق</button>
          </div>
        </div>
        <div className="gatekeeper-counter-grid">
          <article className="accepted"><small>دخول ناجح</small><strong>{counts.accepted}</strong></article>
          <article className="used"><small>محاولات مكررة</small><strong>{counts.used}</strong></article>
          <article className="forged"><small>كود غير موجود</small><strong>{counts.forged}</strong></article>
          <article className="invalid"><small>غير صالحة</small><strong>{counts.invalid}</strong></article>
        </div>
        {assignedEvent?.events && <div className="gatekeeper-assigned-event"><small>الفعالية المصرح لك بها</small><strong>{assignedEvent.events.title}</strong><span>{assignedEvent.events.venue || assignedEvent.events.city || "الموقع غير محدد"} · {assignedEvent.events.starts_at ? formatDate(assignedEvent.events.starts_at) : "موعد غير محدد"}</span></div>}
        {!assignedEvent && <p className="gatekeeper-inline-error">حسابك غير مربوط بفعالية حالياً. راجع إدارة حاضر لتعيين الفعالية.</p>}
        <div className="gatekeeper-actions">
          <button type="button" className="btn btn-primary" disabled={!assignedEvent || loading || !online} onClick={onOpenScanner}><ScanLine size={18} />{scannerOpen ? "إغلاق الكاميرا" : "مسح بالكاميرا"}</button>
          <button type="button" className="btn btn-outline" disabled={!assignedEvent || loading || !online} onClick={onOpenManual}><ClipboardList size={18} />إدخال يدوي</button>
        </div>
        {loading && <div className="gatekeeper-network-loading" role="status" aria-live="polite">
          <div className="gatekeeper-network-loading-card">
            <span className="gatekeeper-loading-spinner" aria-hidden="true" />
            <strong>{slowRequest ? "الاتصال بطيء، ما زلنا نتحقق..." : "جارٍ التحقق من التذكرة..."}</strong>
            <p>{slowRequest ? "قد يستغرق الرد وقتاً إضافياً. لا تغلق الصفحة ولا تكرر الفحص، سنعرض النتيجة فور وصولها." : "نتواصل مع نظام حاضر للتأكد من صلاحية التذكرة وتسجيل الدخول."}</p>
          </div>
        </div>}
        {scannerOpen && <QrScanner videoRef={videoRef} />}
        {manualEntryOpen && <ManualTicketEntry code={code} loading={loading} disabled={!assignedEvent} onCodeChange={onCodeChange} onSubmit={onManualSubmit} />}
        {result && (() => {
          const tone = result.status === "checked_in" ? "valid" : result.status === "used" ? "used" : result.status === "not_found" || result.status === "invalid" ? "invalid" : "error";
          const heading = result.status === "checked_in" ? "مقبولة — تم تسجيل الدخول" : result.status === "used" ? "مستعملة — سبق تسجيل الدخول بها" : result.status === "not_found" ? "من خارج نظام حاضر" : result.status === "invalid" ? "تذكرة غير صالحة" : "تعذر إكمال الفحص";
          return <div className="gatekeeper-result-backdrop" role="presentation">
            <section className={"gatekeeper-result-modal " + tone} role="dialog" aria-modal="true" aria-labelledby="gatekeeper-result-title">
              <div className="gatekeeper-result-status-icon" aria-hidden="true">{tone === "valid" ? "✓" : tone === "used" ? "!" : "×"}</div>
              <strong id="gatekeeper-result-title">{heading}</strong>
              <p className="gatekeeper-result-message">{result.message || (result.status === "checked_in" ? "تم اعتماد التذكرة وتسجيل استخدامها بنجاح." : result.status === "used" ? "لا تسمح بدخول حامل هذه التذكرة مرة أخرى." : "لم يتم العثور على تذكرة صادرة من نظام حاضر بهذا الرمز.")}</p>
              {result.ticket_code && <div className="gatekeeper-result-details">
                <span><b>اسم المشتري:</b> {result.buyer_name || result.attendee_name || "—"}</span>
                <span><b>الفعالية:</b> {result.event_title || "—"}</span>
                <span><b>فئة التذكرة:</b> {result.ticket_type || "—"}</span>
                {result.attendee_count != null && <span><b>عدد الأفراد:</b> {result.attendee_count}</span>}
                <span><b>كود التذكرة:</b> <b dir="ltr">{result.ticket_code}</b></span>
              </div>}
              {result.status === "checked_in" && <p className="gatekeeper-result-note">تم تحديث حالة التذكرة إلى «مستخدمة» ولن تُقبل مرة أخرى.</p>}
              <button type="button" className="btn btn-primary gatekeeper-result-acknowledge" onClick={onAcknowledgeResult}>موافق — فحص التذكرة التالية</button>
            </section>
          </div>;
        })()}
        <ScanHistory items={history} loading={historyLoading} />
      </div> : <div className="empty-state" role="alert">
        <strong>ما عندك صلاحية لواجهة البواب</strong><p>الواجهة دي مخصصة لحسابات البواب والمنظم المعتمدة فقط.</p>
        <button className="btn btn-outline" type="button" onClick={onClose}>العودة للملف الشخصي</button>
      </div>}
    </section>
  );
}
