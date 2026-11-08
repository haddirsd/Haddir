"use client";

import type { FormEvent } from "react";
import { ArrowLeft, CalendarDays, ExternalLink, MapPin, Share2, Wallet } from "lucide-react";
import type { EventItem } from "../events.types";
import type { EventPaymentAccount } from "../../booking/booking.types";
import { PaymentCheckout } from "../../booking/components/PaymentCheckout";
import { BookingSuccess } from "../../booking/components/BookingSuccess";
import { TicketSelection } from "../../booking/components/TicketSelection";
import { formatMoney } from "../events.formatters";

type EventDetailWorkspaceProps = {
  event: EventItem;
  showPayment: boolean;
  selectedTier: number;
  tierChosen: boolean;
  ticketCount: number;
  ticketTypesError: string;
  paymentAccounts: EventPaymentAccount[];
  paymentMethod: string;
  receipt: File | null;
  bookingDone: boolean;
  bookingNumber: string;
  bookingError: string;
  bookingSubmitting: boolean;
  accountCopied: boolean;
  onClose: () => void;
  onSelectTier: (index: number) => void;
  onQuantityChange: (quantity: number) => void;
  onContinueToPayment: () => void;
  onRetryTicketTypes: () => void;
  onBackToDetails: () => void;
  onPaymentMethodChange: (value: string) => void;
  onCopyAccount: (accountNumber: string) => void;
  onReceiptChange: (file: File | null) => void;
  onSubmitBooking: (event: FormEvent<HTMLFormElement>) => void;
  onGoNotifications: () => void;
};

export function EventDetailWorkspace({
  event,
  showPayment,
  selectedTier,
  tierChosen,
  ticketCount,
  ticketTypesError,
  paymentAccounts,
  paymentMethod,
  receipt,
  bookingDone,
  bookingNumber,
  bookingError,
  bookingSubmitting,
  accountCopied,
  onClose,
  onSelectTier,
  onQuantityChange,
  onContinueToPayment,
  onRetryTicketTypes,
  onBackToDetails,
  onPaymentMethodChange,
  onCopyAccount,
  onReceiptChange,
  onSubmitBooking,
  onGoNotifications,
}: EventDetailWorkspaceProps) {
  const tier = event.tiers[selectedTier];
  const totalLabel = tier
    ? tier.price === "مجاناً"
      ? "مجاناً"
      : formatMoney(tier.priceValue * ticketCount, tier.currency)
    : "—";

  return (
    <section className="event-detail-page" aria-label={"تفاصيل " + event.title}>
      {!showPayment ? (
        <div className="detail-sheet event-detail-layout" aria-label={"تفاصيل " + event.title}>
          <div className="detail-sticky-controls" aria-label="أدوات تفاصيل الفعالية">
            <button className="detail-sticky-back" aria-label="الرجوع من تفاصيل الفعالية" onClick={onClose}>
              <ArrowLeft size={20} />
            </button>
            <div className="detail-sticky-actions">
              <span className="detail-sticky-category">{event.category || "فعالية"}</span>
              <button
                className="detail-sticky-share"
                aria-label="مشاركة الفعالية"
                onClick={async () => {
                  const eventUrl = new URL(window.location.pathname, window.location.origin);
                  eventUrl.searchParams.set("event", String(event.id));
                  try {
                    if (navigator.share) {
                      await navigator.share({
                        title: event.title,
                        text: "شوف الفعالية دي على حاضر",
                        url: eventUrl.toString(),
                      });
                    } else {
                      await navigator.clipboard.writeText(eventUrl.toString());
                      alert("تم نسخ رابط الفعالية");
                    }
                  } catch (error) {
                    if (error instanceof Error && error.name !== "AbortError") {
                      alert("تعذر مشاركة الفعالية حالياً.");
                    }
                  }
                }}
              >
                <Share2 size={18} />
              </button>
            </div>
          </div>
          <div className={"detail-cover event-cover " + event.cover}>
            {event.coverImageUrl && (
              <img className="event-cover-image" src={event.coverImageUrl} alt={event.title} />
            )}
            <div className="detail-cover-shade" />
            <div className="detail-cover-title">
              <h1>{event.title}</h1>
            </div>
            {!event.coverImageUrl && <span className="cover-symbol">✦</span>}
          </div>

          <div className="detail-content">
            <div className="detail-main">
              <section className="detail-quick-info" aria-label="معلومات الفعالية">
                <div className="quick-info-row">
                  <span className="quick-info-icon calendar-icon"><CalendarDays size={21} /></span>
                  <div>
                    <small>التاريخ والوقت</small>
                    <strong>{event.date}</strong>
                    <span>{event.time || "يحدد لاحقاً"}</span>
                  </div>
                </div>
                <a className="quick-info-row quick-location-row" href={event.map || "#"} target="_blank" rel="noreferrer">
                  <span className="quick-info-icon location-icon"><MapPin size={21} /></span>
                  <div>
                    <small>المكان والموقع</small>
                    <strong>{event.venue || event.place || "يحدد لاحقاً"}</strong>
                    <span>{event.place || "عرض الاتجاهات على الخريطة"} · اضغط لعرض الموقع</span>
                  </div>
                  <ExternalLink size={16} />
                </a>
              </section>

              <section className="detail-section detail-about">
                <h2>عن الفعالية</h2>
                <p>{event.about || "تفاصيل الفعالية ستُضاف قريباً."}</p>
              </section>

              <TicketSelection
                tiers={event.tiers}
                selectedTier={selectedTier}
                tierChosen={tierChosen}
                ticketCount={ticketCount}
                eventStatus={event.status}
                ticketTypesError={ticketTypesError}
                totalLabel={totalLabel}
                onSelectTier={onSelectTier}
                onQuantityChange={onQuantityChange}
                onContinue={onContinueToPayment}
                onRetry={onRetryTicketTypes}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="detail-sheet event-detail-layout payment-sheet">
          <div className="checkout-topbar">
            <div className="checkout-back-group">
              <button type="button" className="detail-glass-button checkout-back-icon" aria-label="العودة للتفاصيل" onClick={onBackToDetails}>
                <ArrowLeft size={20} />
              </button>
              <span>العودة للتفاصيل</span>
            </div>
            <span className="checkout-wallet-icon" aria-label="المحفظة"><Wallet size={23} /></span>
          </div>

          <div className="payment-screen">
            <div className="booking-steps" aria-label="خطوات الحجز">
              <span className="step-done">١. اختيار الفئة</span>
              <span className="step-done">٢. مراجعة الحجز</span>
              <span className="step-current">٣. الدفع</span>
            </div>

            {!tier ? (
              <div className="empty-state" role="alert">
                <strong>فئة التذكرة المحددة غير متاحة.</strong>
                <p>ارجع لتفاصيل الفعالية واختر فئة متاحة قبل إكمال الدفع.</p>
                <button type="button" className="btn btn-outline" onClick={onBackToDetails}>العودة للتفاصيل</button>
              </div>
            ) : !bookingDone ? (
              <PaymentCheckout
                event={event}
                selectedTier={selectedTier}
                ticketCount={ticketCount}
                totalLabel={totalLabel}
                accounts={paymentAccounts}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={onPaymentMethodChange}
                accountCopied={accountCopied}
                onCopyAccount={onCopyAccount}
                receipt={receipt}
                onReceiptChange={onReceiptChange}
                bookingError={bookingError}
                bookingSubmitting={bookingSubmitting}
                onSubmit={onSubmitBooking}
              />
            ) : (
              <BookingSuccess
                bookingNumber={bookingNumber}
                eventTitle={event.title}
                ticketCount={ticketCount}
                totalLabel={totalLabel}
                onGoNotifications={onGoNotifications}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
