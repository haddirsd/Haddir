"use client";

type SkeletonVariant = "events" | "tickets" | "notifications" | "admin-cards" | "admin-table" | "dashboard";

type SkeletonStateProps = {
  variant: SkeletonVariant;
  count?: number;
  label?: string;
  className?: string;
};

export function SkeletonState({ variant, count = 3, label = "جاري تحميل البيانات...", className = "" }: SkeletonStateProps) {
  const items = Array.from({ length: count }, (_, index) => index);
  return (
    <div className={["haddir-skeleton", `haddir-skeleton-${variant}`, className].filter(Boolean).join(" ")} role="status" aria-label={label}>
      <span className="haddir-skeleton-sr">{label}</span>
      {variant === "dashboard" ? (
        <div className="haddir-skeleton-metrics" aria-hidden="true">{items.map((item) => <div className="haddir-skeleton-metric" key={item}><i /><b /><span /></div>)}</div>
      ) : variant === "admin-table" ? (
        <div className="haddir-skeleton-table" aria-hidden="true">
          <div className="haddir-skeleton-table-head"><i /><i /><i /><i /></div>
          {items.map((item) => <div className="haddir-skeleton-table-row" key={item}><i /><i /><i /><i /></div>)}
        </div>
      ) : (
        <div className="haddir-skeleton-list" aria-hidden="true">
          {items.map((item) => <div className="haddir-skeleton-item" key={item}>
            {(variant === "events" || variant === "tickets") && <i className="haddir-skeleton-media" />}
            {variant === "notifications" && <i className="haddir-skeleton-avatar" />}
            <span className="haddir-skeleton-copy"><b /><i /><i /></span>
            {(variant === "admin-cards" || variant === "tickets") && <i className="haddir-skeleton-chip" />}
          </div>)}
        </div>
      )}
    </div>
  );
}
