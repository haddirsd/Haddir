"use client";

import { useState } from "react";
import { Megaphone, Send } from "lucide-react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function AdminBroadcastNotifications() {
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const send = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
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
      p_message: trimmed,
    });
    setSending(false);
    setConfirming(false);

    if (error) {
      setFeedback({ type: "error", text: "تعذر إرسال الإشعار: " + error.message });
      return;
    }

    const recipientCount = Number(data) || 0;
    setMessage("");
    setFeedback({
      type: "success",
      text: recipientCount
        ? `تم إرسال الإشعار بنجاح إلى ${recipientCount.toLocaleString("ar")} حساب.`
        : "تم تنفيذ الإرسال، لكن لم يتم العثور على حسابات مستلمة.",
    });
  };

  return (
    <section className="admin-broadcast-panel" aria-labelledby="admin-broadcast-title">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 13, background: "rgba(35,126,142,.11)", color: "#237e8e" }}>
          <Megaphone size={21} />
        </span>
        <div>
          <h2 id="admin-broadcast-title">إرسال إشعار جماعي</h2>
          <p>اكتب رسالة لتصل إلى جميع حسابات حاضر المسجلة.</p>
        </div>
      </div>

      <label className="admin-broadcast-label" htmlFor="admin-broadcast-message">نص الإشعار</label>
      <textarea
        id="admin-broadcast-message"
        className="admin-broadcast-textarea"
        value={message}
        maxLength={1000}
        placeholder="اكتب نص الإشعار هنا..."
        onChange={(event) => {
          setMessage(event.target.value);
          setConfirming(false);
          setFeedback(null);
        }}
        disabled={sending}
      />
      <div className="admin-broadcast-meta">
        <span>سيظهر الإشعار داخل التطبيق، ويصل خارجياً لمن فعّل الإشعارات.</span>
        <span>{message.length.toLocaleString("ar")} / ١٠٠٠</span>
      </div>

      <div className="admin-broadcast-actions">
        <button type="button" className="admin-broadcast-send" onClick={send} disabled={!message.trim() || sending}>
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
      {confirming && <p style={{ marginTop: 12, color: "#a56a24" }}>تأكيد أخير: سيتم إرسال هذه الرسالة إلى جميع حسابات حاضر.</p>}
    </section>
  );
}
