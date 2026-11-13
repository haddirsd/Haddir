"use client";

type BookingSummaryProps = {
  event: {
    title: string;
    cover: string;
    coverImageUrl: string | null;
    tiers: Array<{ name: string; price: string; priceValue: number; currency: string }>;
  };
  selectedTier: number;
  totalLabel: string;
};

export function BookingSummary({ event, selectedTier, totalLabel }: BookingSummaryProps) {
  const tier = event.tiers[selectedTier];
  return (
    <>
      <div className="checkout-event">
        <span className={"checkout-thumb event-cover " + event.cover}>
          {event.coverImageUrl ? <img className="event-cover-image" src={event.coverImageUrl} alt="" /> : <span className="cover-symbol">✦</span>}
        </span>
        <div><strong>{event.title}</strong><small>{tier?.name || "فئة التذكرة"}</small></div>
      </div>
      <div className="checkout-total"><span>الإجمالي</span><strong>{totalLabel}</strong></div>
    </>
  );
}
