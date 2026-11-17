"use client";

import { useState } from "react";
import { Megaphone, Send } from "lucide-react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function AdminBroadcastNotifications() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const send = async () => {
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();
    if (!trimmedTitle || !trimmedMessage || sending) return;
    if (!confirming) {
      setConfirming(true);
      setFeedback(null);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ type: "error", text: "تعذر الاتصال بقاعدة البيانات حالياً." });
      setConfirming(false);
      return;
    }

    setSending(true);
    setFeedback(null);
    const { data, error } = await supabase.rpc("admin_send_broadcast_notification", {
      p_title: trimmedTitle,
      p_message: trimmedMessage,
    });
    setSending(false);
    setConfirming(false);

    if (error) {
      setFeedback({ type: "error", text: "تعذر إرسال الإشعار: " + error.message });
      return;
    }

    const recipientCount = Number(data) || 0;
    setTitle("");
    setMessage("");
    setFeedback({
      type: "success",
      text: recipientCount
        ? `تم إرسال الإشعار بنجاح إلى ${recipientCount.toLocaleString("ar")} حساب.`
        : "تم تنفيذ الإرسال، لكن لم يتم العثور على حسابات مستلمة.",
    });
  };

  const handleFieldChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setConfirming(false);
    setFeedback(null);
  };

  return (
    <section className="admin-broadcast-panel" aria-labelledby="admin-broadcast-title">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 13, background: "rgba(35,126,142,.11)", color: "#237e8e" }}>
          <Megaphone size={21} />
        </span>
        <div>
          <h2 id="admin-broadcast-title">إرسال إشعار جماعي</h2>
          <p>اكتب عنوان الإشعار وتفاصيله لتصل إلى جميع حسابات حاضر المسجلة.</p>
        </div>
      </div>

      <label className="admin-broadcast-label" htmlFor="admin-broadcast-title-input">عنوان الإشعار</label>
      <input
        id="admin-broadcast-title-input"
        type="text"
        className="admin-broadcast-textarea"
        style={{ minHeight: 54, resize: "none" }}
        value={title}
        maxLength={120}
        placeholder="مثال: تنبيه من حاضر"
        onChange={(event) => handleFieldChange(setTitle, event.target.value)}
        disabled={sending}
        required
      />
      <div className="admin-broadcast-meta">
        <span>العنوان الذي سيظهر أعلى الإشعار.</span>
        <span>{title.length.toLocaleString("ar")} / ١٢٠</span>
      </div>

      <label className="admin-broadcast-label" htmlFor="admin-broadcast-message">تفاصيل الإشعار</label>
      <textarea
        id="admin-broadcast-message"
        className="admin-broadcast-textarea"
        value={message}
        maxLength={1000}
        placeholder="اكتب تفاصيل الإشعار هنا..."
        onChange={(event) => handleFieldChange(setMessage, event.target.value)}
        disabled={sending}
        required
      />
      <div className="admin-broadcast-meta">
        <span>سيظهر العنوان والتفاصيل داخل التطبيق، ويصلان خارجياً لمن فعّل الإشعارات.</span>
        <span>{message.length.toLocaleString("ar")} / ١٠٠٠</span>
      </div>

      <div className="admin-broadcast-actions">
        <button type="button" className="admin-broadcast-send" onClick={send} disabled={!title.trim() || !message.trim() || sending}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Send size={16} />
            {sending ? "جارٍ الإرسال..." : confirming ? "تأكيد الإرسال للجميع" : "إرسال للجميع"}
          </span>
        </button>
        {confirming && (
          <button type="button" className="admin-broadcast-cancel" onClick={() => setConfirming(false)} disabled={sending}>
            إلغاء
          </button>
        )}
      </div>

      {feedback && <div className={"admin-broadcast-feedback " + feedback.type} role="status">{feedback.text}</div>}
      {confirming && <p style={{ marginTop: 12, color: "#a56a24" }}>تأكيد أخير: سيتم إرسال العنوان والتفاصيل إلى جميع حسابات حاضر.</p>}
    </section>
  );
}
