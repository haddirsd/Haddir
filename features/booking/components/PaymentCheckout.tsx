"use client";

import type { FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import type { EventPaymentAccount } from "../booking.types";
import { CheckoutSummary } from "./CheckoutSummary";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { ReceiptUpload } from "./ReceiptUpload";

type CheckoutEvent = {
  title: string;
  cover: string;
  coverImageUrl: string | null;
  tiers: Array<{ name: string; price: string; priceValue: number; currency: string }>;
};

type PaymentCheckoutProps = {
  event: CheckoutEvent;
  selectedTier: number;
  ticketCount: number;
  totalLabel: string;
  accounts: EventPaymentAccount[];
  paymentMethod: string;
  onPaymentMethodChange: (value: string) => void;
  accountCopied: boolean;
  onCopyAccount: (accountNumber: string) => void;
  receipt: File | null;
  onReceiptChange: (file: File | null) => void;
  bookingError: string;
  bookingSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function PaymentCheckout({
  event,
  selectedTier,
  ticketCount,
  totalLabel,
  accounts,
  paymentMethod,
  onPaymentMethodChange,
  accountCopied,
  onCopyAccount,
  receipt,
  onReceiptChange,
  bookingError,
  bookingSubmitting,
  onSubmit,
}: PaymentCheckoutProps) {
  return (
    <form className="checkout-form" onSubmit={onSubmit}>
      <span className="section-kicker">الخطوة الثالثة من الحجز</span>
      <h1>إتمام الحجز</h1>
      <p>راجع تفاصيل حجزك وأكمل بيانات الدفع.</p>

      <CheckoutSummary
        event={event}
        selectedTier={selectedTier}
        totalLabel={totalLabel}
      />

      <PaymentMethodSelector
        accounts={accounts}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={onPaymentMethodChange}
        accountCopied={accountCopied}
        onCopyAccount={onCopyAccount}
      />

      {paymentMethod ? (
        <ReceiptUpload receipt={receipt} onReceiptChange={onReceiptChange} />
      ) : (
        <section className="checkout-section receipt-locked" aria-live="polite">
          <h2>إرفاق إيصال التحويل</h2>
          <p>اختَر البنك أو حساب التحويل أولاً، وبعدها سيظهر لك زر إرفاق صورة الإيصال.</p>
        </section>
      )}

      {bookingError && <p className="checkout-footnote" role="alert">{bookingError}</p>}
      <p className="checkout-footnote">
        سيتم مراجعة الإيصال وتحديث حالة طلبك عبر الإشعارات. لا يتم إصدار التذكرة إلا بعد اعتماد الدفع.
      </p>

      {receipt && (
        <div className="checkout-submit-dock">
          <button
            className="btn btn-primary pay-button"
            type="submit"
            disabled={bookingSubmitting || accounts.length === 0}
          >
            {bookingSubmitting ? "جاري رفع الإيصال وإرسال الطلب..." : "إرسال طلب الدفع للمراجعة"}
            <ArrowLeft size={17} />
          </button>
        </div>
      )}
    </form>
  );
}
