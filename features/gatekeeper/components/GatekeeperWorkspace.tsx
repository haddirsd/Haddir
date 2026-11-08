"use client";

import type { RefObject } from "react";
import { ClipboardList, ScanLine } from "lucide-react";
import type { GatekeeperScanHistoryItem, GatekeeperScanStats, GatekeeperTicketActionResult } from "../gatekeeper.types";
import { ManualTicketEntry } from "./ManualTicketEntry";
import { QrScanner } from "./QrScanner";
import { ScanHistory } from "./ScanHistory";

type AssignedEvent = { events?: { title?: string; venue?: string; city?: string; starts_at?: string } } | null;

export function GatekeeperWorkspace({
  userRole, assignedEvent, online, counts, loading, code, result, manualEntryOpen,
  scannerOpen, history, historyLoading, videoRef, onOpenScanner, onOpenManual,
  onCodeChange, onManualSubmit, onClose,
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
  onClose: () => void;
}) {
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
        {scannerOpen && <QrScanner videoRef={videoRef} />}
        {manualEntryOpen && <ManualTicketEntry code={code} loading={loading} disabled={!assignedEvent} onCodeChange={onCodeChange} onSubmit={onManualSubmit} />}
        {result && <div className={"gatekeeper-result " + (result.status === "checked_in" ? "valid" : result.status === "used" ? "used" : result.status === "not_found" ? "invalid" : "error")}>
          <strong>{result.status === "checked_in" ? "مقبولة — تم تسجيل استخدامها بنجاح" : result.status === "used" ? "مستخدمة — تم استخدام هذه التذكرة من قبل" : result.status === "not_found" ? "مزوّرة — هذا الكود غير صادر من نظام حاضر" : result.message}</strong>
          {result.ticket_code && <div className="gatekeeper-result-details">
            <span>اسم المشتري: {result.buyer_name || result.attendee_name || "—"}</span><span>الفعالية: {result.event_title || "—"}</span><span>فئة التذكرة: {result.ticket_type || "—"}</span>
            {result.attendee_count != null && <span>عدد الأفراد في الحجز: {result.attendee_count}</span>}<span>الكود: {result.ticket_code}</span>
          </div>}
          {result.status === "checked_in" && <p>تم تحديث حالة التذكرة في النظام إلى «مستخدمة»، ولن تُقبل مرة أخرى.</p>}
        </div>}
        <ScanHistory items={history} loading={historyLoading} />
      </div> : <div className="empty-state" role="alert">
        <strong>ما عندك صلاحية لواجهة البواب</strong><p>الواجهة دي مخصصة لحسابات البواب والمنظم المعتمدة فقط.</p>
        <button className="btn btn-outline" type="button" onClick={onClose}>العودة للملف الشخصي</button>
      </div>}
    </section>
  );
}
