import type { GatekeeperScanHistoryItem } from "../gatekeeper.types";
import { SkeletonState } from "../../../components/ui/SkeletonState";

export function ScanHistory({
  items, loading, error, onRetry,
}: {
  items: GatekeeperScanHistoryItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <section className="gatekeeper-manual-history" aria-label="سجل عمليات الدخول">
      <div className="gatekeeper-manual-history-head">
        <strong>سجل عمليات الدخول</strong><span>{items.length} عملية</span>
      </div>
      {loading&&!error ? <SkeletonState variant="notifications" count={3} label="جاري تحميل سجل عمليات الدخول..." />
        : error ? <p className="gatekeeper-history-empty" role="alert">{error} <button type="button" onClick={onRetry}>إعادة المحاولة</button></p>
        : items.length === 0 ? <p className="gatekeeper-history-empty">ما في عمليات مسح أو إدخال مسجلة حتى الآن.</p>
        : <div className="gatekeeper-history-list">
          {items.map(item => (
            <article className="gatekeeper-history-item" key={item.id}>
              <div className="gatekeeper-history-code" dir="ltr">
                {item.ticket_code || "—"}
                <small className="gatekeeper-history-method">{item.entry_method === "manual" ? "إدخال يدوي" : "QR"}</small>
              </div>
              <div className="gatekeeper-history-meta">
                <strong className={item.outcome === "accepted" ? "accepted" : item.outcome === "used" ? "used" : item.outcome === "forged" ? "forged" : "invalid"}>
                  {item.outcome === "accepted" ? "مقبولة — تم الدخول" : item.outcome === "used" ? "محاولة دخول مكررة" : item.outcome === "forged" ? "كود غير موجود" : "تذكرة غير صالحة"}
                </strong>
                <small>{item.gatekeeper_name || "بواب الفعالية"} · {item.scanned_at ? new Date(item.scanned_at).toLocaleString("ar-SD-u-nu-latn") : "—"}</small>
              </div>
            </article>
          ))}
        </div>}
    </section>
  );
}
