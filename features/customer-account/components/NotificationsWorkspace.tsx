"use client";

import { Bell, CalendarDays, CheckCircle2, Sparkles } from "lucide-react";
import { PushNotificationSettings } from "./PushNotificationSettings";

export type CustomerNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  booking_id?: string | null;
};

type NotificationsWorkspaceProps = {
  userId: string | null;
  loading: boolean;
  error: string;
  notifications: CustomerNotification[];
  filteredNotifications: CustomerNotification[];
  filter: "unread" | "read";
  unreadCount: number;
  onFilterChange: (filter: "unread" | "read") => void;
  onMarkAllRead: () => void;
  onOpenNotification: (notification: CustomerNotification) => void;
  onToggleRead: (notification: CustomerNotification, isRead: boolean) => void;
};

function notificationKind(type: string) {
  if (type === "ticket_approved" || type === "ticket_checked_in" || type === "payment_rejected" || type === "booking_expired") return "booking";
  if (String(type || "").startsWith("event_reminder_")) return "event";
  return "system";
}

export function NotificationsWorkspace({
  userId,
  loading,
  error,
  notifications,
  filteredNotifications,
  filter,
  unreadCount,
  onFilterChange,
  onMarkAllRead,
  onOpenNotification,
  onToggleRead,
}: NotificationsWorkspaceProps) {
  return (
    <section className="screen container notifications-screen">
      <PushNotificationSettings userId={userId} />
      {loading ? <div className="empty-state motion-loading" role="status"><span className="haddir-loading-indicator" aria-hidden="true"/><span>جاري تحميل الإشعارات...</span></div> : error ? <div className="empty-state" role="alert">{error}</div> : <>
        <div className="notifications-toolbar">
          <div><strong>إشعاراتك</strong><small>{unreadCount} غير مقروء</small></div>
          <button type="button" className="notification-mark-all" onClick={onMarkAllRead} disabled={!unreadCount}>تعليم الكل كمقروء</button>
        </div>
        <div className="notification-filters" role="tablist" aria-label="تصفية الإشعارات">
          <button type="button" className={filter === "unread" ? "active" : ""} onClick={() => onFilterChange("unread")}>غير مقروءة <span>{unreadCount}</span></button>
          <button type="button" className={filter === "read" ? "active" : ""} onClick={() => onFilterChange("read")}>مقروءة</button>
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
      </>}
    </section>
  );
}
