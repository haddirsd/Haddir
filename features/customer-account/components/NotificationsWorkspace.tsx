"use client";

import { Bell, CalendarDays, CheckCircle2, Sparkles } from "lucide-react";
import type { CustomerNotification } from "../types";
import { SkeletonState } from "../../../components/ui/SkeletonState";

export type { CustomerNotification } from "../types";

type NotificationsWorkspaceProps = {
  loading: boolean;
  error: string;
  notifications: CustomerNotification[];
  filteredNotifications: CustomerNotification[];
  filter: "unread" | "read";
  unreadCount: number;
  totalCount: number;
  filteredTotal: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onFilterChange: (filter: "unread" | "read") => void;
  onMarkAllRead: () => void;
  onOpenNotification: (notification: CustomerNotification) => void;
  onToggleRead: (notification: CustomerNotification, isRead: boolean) => void;
};

function notificationKind(type: string) {
  if (type === "ticket_approved" || type === "ticket_checked_in" || type === "payment_rejected" || type === "booking_expired" || type === "new_booking") return "booking";
  if (type === "event_started" || String(type || "").startsWith("event_reminder_")) return "event";
  return "system";
}

export function NotificationsWorkspace({
  loading,
  error,
  notifications,
  filteredNotifications,
  filter,
  unreadCount,
  totalCount,
  filteredTotal,
  page,
  pageSize,
  onPageChange,
  onFilterChange,
  onMarkAllRead,
  onOpenNotification,
  onToggleRead,
}: NotificationsWorkspaceProps) {
  return (
    <section className="screen container notifications-screen">
      {loading ? <SkeletonState variant="notifications" count={5} label="جاري تحميل الإشعارات..." /> : error ? <div className="empty-state" role="alert">{error}</div> : (
        <div className="notifications-layout">
          <aside className="notifications-summary-card" aria-label="ملخص الإشعارات">
            <span className="notifications-summary-label">ملخص الإشعارات</span>
            <strong className="notifications-summary-count">{unreadCount}</strong>
            <span className="notifications-summary-caption">إشعار غير مقروء</span>
            <small className="notifications-summary-total">{totalCount} إجمالي الإشعارات</small>
            <button type="button" className="notification-mark-all" onClick={onMarkAllRead} disabled={!unreadCount}>
              تعليم الكل
            </button>
          </aside>

          <div className="notifications-feed">
            <div className="notification-filters" role="tablist" aria-label="تصفية الإشعارات">
              <button type="button" className={filter === "unread" ? "active" : ""} onClick={() => onFilterChange("unread")}>
                غير مقروءة <span>{unreadCount}</span>
              </button>
              <button type="button" className={filter === "read" ? "active" : ""} onClick={() => onFilterChange("read")}>
                مقروءة
              </button>
            </div>

            {filteredNotifications.length === 0 ? <div className="empty-state">
              <Bell size={26} />
              <strong>{notifications.length === 0 ? "ما عندك إشعارات حالياً" : filter === "unread" ? "ما عندك إشعارات غير مقروءة" : "ما عندك إشعارات مقروءة"}</strong>
              <p>حتظهر هنا تحديثات حجوزاتك والفعاليات ونظام حاضر.</p>
            </div> : <div className="notification-list">
              {filteredNotifications.map((notification) => {
                const kind = notificationKind(notification.type);
                return <article key={notification.id} className={"notification-item " + (notification.is_read ? "is-read" : "is-unread")}>
                  <button type="button" className="notification-open" onClick={() => onOpenNotification(notification)} aria-label={"فتح الإشعار: " + notification.title}>
                    <span className={"notification-icon " + kind}>
                      {kind === "booking" ? (notification.type === "ticket_approved" ? <CheckCircle2 size={19} /> : <Bell size={19} />) : kind === "event" ? <CalendarDays size={19} /> : <Sparkles size={19} />}
                    </span>
                    <span className="notification-copy">
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                      <small>{new Date(notification.created_at).toLocaleString("ar-SD-u-nu-latn")}</small>
                    </span>
                    <span className="notification-state">{notification.is_read ? "مقروء" : "جديد"}</span>
                  </button>
                  {!notification.is_read && <button type="button" className="notification-toggle-read" onClick={() => onToggleRead(notification, true)}>تحديد كمقروء</button>}
                </article>;
              })}
            </div>}
            {filteredTotal > pageSize && <div className="admin-pagination" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,margin:"14px 0"}}>
              <button type="button" className="admin-refresh" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>السابق</button>
              <span>صفحة {page.toLocaleString("ar-SD-u-nu-latn")} من {Math.max(1, Math.ceil(filteredTotal / pageSize)).toLocaleString("ar-SD-u-nu-latn")} · {filteredTotal.toLocaleString("ar-SD-u-nu-latn")} إشعار</span>
              <button type="button" className="admin-refresh" disabled={loading || page >= Math.ceil(filteredTotal / pageSize)} onClick={() => onPageChange(page + 1)}>التالي</button>
            </div>}
          </div>
        </div>
      )}
    </section>
  );
}
