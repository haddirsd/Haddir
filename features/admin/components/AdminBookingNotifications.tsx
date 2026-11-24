"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, LoaderCircle, RefreshCw } from "lucide-react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { PushNotificationSettings } from "../../customer-account/components/PushNotificationSettings";

type BookingNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  booking_id: string | null;
};

export default function AdminBookingNotifications({ userId }: { userId: string | null }) {
  const [rows, setRows] = useState<BookingNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      setError("تعذر تحديد حساب المستخدم الحالي.");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      setError("تعذر الاتصال بقاعدة البيانات.");
      return;
    }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("notifications")
      .select("id,title,message,type,is_read,created_at,booking_id")
      .eq("user_id", userId)
      .eq("type", "new_booking")
      .order("created_at", { ascending: false })
      .limit(50);

    if (queryError) {
      setError("تعذر تحميل إشعارات الحجوزات: " + queryError.message);
    } else {
      setRows((data || []) as BookingNotification[]);
      setError("");
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId) {
      void refresh();
      return;
    }

    let alive = true;
    const load = async () => {
      if (alive) await refresh();
    };
    void load();

    const channel = supabase
      .channel("admin-booking-notifications-" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: "user_id=eq." + userId },
        () => { void load(); },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const markRead = async (notificationId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId) return;
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", userId);
    if (updateError) {
      setError("تعذر تحديث حالة الإشعار: " + updateError.message);
      return;
    }
    setRows((current) => current.map((row) => row.id === notificationId ? { ...row, is_read: true } : row));
  };

  const unreadCount = rows.filter((row) => !row.is_read).length;

  return (
    <section className="admin-panel" aria-labelledby="admin-booking-notifications-title">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 id="admin-booking-notifications-title">طلبات الحجز الجديدة</h2>
          <p>إشعارات الحجوزات المرسلة إلى حسابك بصفة مالك المنصة أو مشرف إداري.</p>
        </div>
        <button type="button" className="admin-refresh" onClick={() => void refresh()} disabled={loading}>
          {loading ? <LoaderCircle size={15} /> : <RefreshCw size={15} />}
          تحديث
        </button>
      </div>

      <PushNotificationSettings userId={userId} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 12px" }}>
        <Bell size={18} />
        <strong>سجل إشعارات الحجز</strong>
        <span style={{ fontSize: 12, opacity: .7 }}>غير المقروء: {unreadCount.toLocaleString("ar-SD-u-nu-latn")}</span>
      </div>

      {error ? (
        <div className="admin-notice" role="alert">{error}</div>
      ) : loading ? (
        <div className="admin-notice" role="status"><LoaderCircle size={16} /> جاري تحميل إشعارات الحجز...</div>
      ) : rows.length === 0 ? (
        <div className="admin-notice">لا توجد طلبات حجز جديدة مسجلة في حسابك حتى الآن.</div>
      ) : (
        <div className="admin-activity-list">
          {rows.map((row) => (
            <article className="admin-activity-item" key={row.id}>
              <div className="admin-activity-item-rail"><span><Bell size={16} /></span></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong>{row.title}</strong>
                  <span style={{ fontSize: 11, opacity: .7 }}>{row.is_read ? "مقروء" : "جديد"}</span>
                </div>
                <p>{row.message}</p>
                <small>{new Date(row.created_at).toLocaleString("ar-SD-u-nu-latn")}</small>
                {!row.is_read && (
                  <button type="button" className="admin-refresh" style={{ marginTop: 8 }} onClick={() => void markRead(row.id)}>
                    <CheckCheck size={14} /> تحديد كمقروء
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <p style={{ marginTop: 12, fontSize: 11, opacity: .65 }}>يعرض آخر 50 إشعار حجز. تُحدّث القائمة تلقائياً عند وصول إشعار جديد.</p>
    </section>
  );
}
