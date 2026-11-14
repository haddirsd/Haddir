"use client";

import { CalendarDays, MapPin } from "lucide-react";
import type { AdminEventRole, AdminEventRow } from "./admin-events.types";

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  published: "منشورة",
  cancelled: "ملغاة",
  completed: "مكتملة",
};
const fmt = (value: unknown) => value == null || value === "" ? "—" : String(value);

type Props = {
  rows: AdminEventRow[];
  role: AdminEventRole;
  loading: boolean;
  onEdit: (event: AdminEventRow) => void;
  onDelete: (event: AdminEventRow) => void;
  onPublish: (eventId: string) => void;
};

export default function AdminEventCards({
  rows,
  role,
  loading,
  onEdit,
  onDelete,
  onPublish,
}: Props) {
  const canManage = role === "owner" || role === "admin";

  return (
    <div className="admin-event-cards">
      {rows.length === 0 ? (
        <p className="admin-no-data">لا توجد فعاليات حتى الآن. أضف أول فعالية من الزر بالأعلى.</p>
      ) : rows.map((event) => (
        <article className="admin-event-card" key={event.id}>
          <div className="admin-event-card-main">
            <div className="admin-event-card-title">
              <h4>{event.title || "فعالية بدون عنوان"}</h4>
              <span className={"admin-event-status status-" + (event.status || "draft")}>
                {statusLabels[event.status] || fmt(event.status)}
              </span>
            </div>
            <div className="admin-event-card-meta">
              <span><b>التصنيف:</b> {fmt(event.category)}</span>
              <span><b>المدينة:</b> {fmt(event.city)}</span>
              <span><b>المكان:</b> {fmt(event.venue)}</span>
              <span><CalendarDays size={14} aria-hidden="true"/> <b>الموعد:</b> {event.is_continuous ? "مستمر" : event.starts_at ? new Date(event.starts_at).toLocaleString("ar-SD-u-nu-latn") : "—"}</span>
              {event.address ? <span><MapPin size={14} aria-hidden="true"/> {event.address}</span> : null}
            </div>
          </div>
          {canManage && (
            <div className="admin-event-card-actions">
              <button className="admin-event-edit" type="button" disabled={loading} onClick={() => onEdit(event)}>تعديل</button>
              <button className="admin-event-delete" type="button" disabled={loading} onClick={() => onDelete(event)}>حذف</button>
              {event.status === "draft" ? (
                <button className="admin-create-button" type="button" disabled={loading} onClick={() => onPublish(event.id)}>نشر الفعالية</button>
              ) : null}
              {event.is_trending ? <small>رائج الآن</small> : null}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
