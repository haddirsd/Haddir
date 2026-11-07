"use client";

import { ArrowLeft, CheckCircle2 } from "lucide-react";

export type TicketTierOption = {
  id: string;
  name: string;
  description: string;
  price: string;
  priceValue: number;
  currency: string;
  available: number;
  availableNow: boolean;
};

type TicketSelectionProps = {
  tiers: TicketTierOption[];
  selectedTier: number;
  tierChosen: boolean;
  ticketCount: number;
  eventStatus: string;
  ticketTypesError: string;
  totalLabel: string;
  onSelectTier: (index: number) => void;
  onQuantityChange: (quantity: number) => void;
  onContinue: () => void;
  onRetry: () => void;
};

export function TicketSelection({
  tiers,
  selectedTier,
  tierChosen,
  ticketCount,
  eventStatus,
  ticketTypesError,
  totalLabel,
  onSelectTier,
  onQuantityChange,
  onContinue,
  onRetry,
}: TicketSelectionProps) {
  const tier = tiers[selectedTier];
  const maxQuantity = tier ? Math.min(5, tier.available) : 0;
  const unavailableStatuses = ["تم البيع بالكامل", "بدأت", "انتهت", "غير متاح", "البيع غير متاح حالياً"];
  const canContinue = !!tier && tierChosen && tier.availableNow &&
    tier.available >= ticketCount && !unavailableStatuses.includes(eventStatus);

  return (
    <>
      <section className="detail-section detail-ticket-section">
        <div className="tier-heading"><h2>فئات التذاكر</h2><span>اختر فئة للمتابعة</span></div>
        {ticketTypesError ? (
          <div className="empty-state" role="alert">
            <strong>تعذر تحميل فئات التذاكر</strong>
            <p>{ticketTypesError}</p>
            <button className="btn btn-outline" onClick={onRetry}>إعادة المحاولة</button>
          </div>
        ) : tiers.length ? (
          <div className="tier-list">
            {tiers.map((option, index) => (
              <button
                type="button"
                key={option.id}
                className={"tier-card " + (selectedTier === index && tierChosen ? "tier-selected" : "")}
                aria-pressed={selectedTier === index && tierChosen}
                disabled={!option.availableNow || option.available <= 0}
                onClick={() => onSelectTier(index)}
              >
                <span className="tier-radio">{selectedTier === index && tierChosen ? <CheckCircle2 size={17} /> : null}</span>
                <span className="tier-copy">
                  <strong className="tier-name">{option.name}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
                <strong className="tier-price">{option.price}</strong>
                <small className="tier-availability">
                  {option.availableNow ? `متبقي ${option.available} تذكرة` : option.available <= 0 ? "نفدت التذاكر" : "البيع غير متاح حالياً"}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">لم تُضف فئات تذاكر لهذه الفعالية بعد.</div>
        )}
      </section>

      {tierChosen && tier && (
        <section className="detail-quantity quantity-reveal">
          <div className="quantity-heading">
            <h3>عدد التذاكر</h3>
            <span>المتاح: {maxQuantity} تذاكر</span>
          </div>
          <div className="quantity-control">
            <button type="button" aria-label="تقليل عدد التذاكر" disabled={ticketCount <= 1} onClick={() => onQuantityChange(Math.max(1, ticketCount - 1))}>−</button>
            <strong>{ticketCount}</strong>
            <button type="button" aria-label="زيادة عدد التذاكر" disabled={ticketCount >= maxQuantity} onClick={() => onQuantityChange(Math.min(maxQuantity, ticketCount + 1))}>+</button>
          </div>
        </section>
      )}

      {tierChosen && tier && (
        <div className="detail-booking-dock actionable-footer">
          <div className="detail-dock-summary">
            <small>المبلغ الإجمالي <span className="ticket-count-badge">{ticketCount} تذاكر</span></small>
            <strong>{totalLabel}</strong>
            <span>{tier.name}</span>
          </div>
          <button className="btn btn-primary pay-button" disabled={!canContinue} onClick={onContinue}>
            ادفع الآن <ArrowLeft size={18} />
          </button>
        </div>
      )}
    </>
  );
}
