"use client";

import type { ChangeEvent, FormEvent } from "react";
import { ArrowLeft, Copy, CreditCard } from "lucide-react";
import type { EventPaymentAccount } from "../booking.types";

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
  const selectedAccount = accounts.find((account) => account.id === paymentMethod);
  const handleReceiptChange = (event: ChangeEvent<HTMLInputElement>) => {
    onReceiptChange(event.target.files?.[0] || null);
  };

  return (
    <form className="checkout-form" onSubmit={onSubmit}>
      <span className="section-kicker">الخطوة الثالثة من الحجز</span>
      <h1>إتمام الحجز</h1>
      <p>راجع تفاصيل حجزك وأكمل بيانات الدفع.</p>
      <div className="checkout-event">
        <span className={"checkout-thumb event-cover " + event.cover}>
          {event.coverImageUrl ? (
            <img className="event-cover-image" src={event.coverImageUrl} alt="" />
          ) : (
            <span className="cover-symbol">✦</span>
          )}
        </span>
        <div>
          <strong>{event.title}</strong>
          <small>{event.tiers[selectedTier].name}</small>
        </div>
      </div>
      <div className="checkout-total">
        <span>الإجمالي</span>
        <strong>{totalLabel}</strong>
      </div>

      <section className="checkout-section">
        <h2>طريقة الدفع</h2>
        <label className="checkout-label">
          <span>اختر حساب التحويل</span>
          <select
            required
            value={paymentMethod}
            onChange={(change) => onPaymentMethodChange(change.target.value)}
            disabled={accounts.length === 0}
          >
            <option value="" disabled>اضغط هنا لاختيار طريقة الدفع</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.account_name}</option>
            ))}
          </select>
        </label>
        <div className="account-details">
          {paymentMethod && (
            <>
              <div className="account-number-card">
                <small>رقم الحساب</small>
                <strong dir="ltr">{selectedAccount?.account_number || "—"}</strong>
                <button
                  type="button"
                  className="copy-account-button"
                  disabled={!selectedAccount?.account_number}
                  onClick={() => onCopyAccount(selectedAccount?.account_number || "")}
                >
                  <Copy size={15} />{accountCopied ? "تم النسخ" : "نسخ الرقم"}
                </button>
              </div>
              <div>
                <small>اسم المستفيد</small>
                <strong>{selectedAccount?.beneficiary || "—"}</strong>
              </div>
            </>
          )}
        </div>
        {paymentMethod && (
          <p className="account-note">
            حوّل المبلغ الموضح أعلاه إلى حساب الدفع المحدد، ثم ارفع صورة الإيصال لإرسال طلبك للمراجعة.
          </p>
        )}
        {!accounts.length && (
          <p className="checkout-footnote" role="alert">
            لم تُضف حسابات دفع لهذه الفعالية بعد. يرجى التواصل مع منظم الفعالية.
          </p>
        )}
      </section>

      <section className="checkout-section">
        <h2>إيصال التحويل</h2>
        <label className="receipt-upload">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleReceiptChange} />
          <span className="upload-symbol"><CreditCard size={20} /></span>
          <strong>{receipt ? receipt.name : "ارفع صورة إيصال التحويل"}</strong>
          <small>JPG أو PNG أو WebP · بحد أقصى 5 ميجابايت</small>
          <span className="upload-action">{receipt ? "تغيير الصورة" : "اختيار صورة"}</span>
        </label>
      </section>
      {bookingError && <p className="checkout-footnote" role="alert">{bookingError}</p>}
      <p className="checkout-footnote">
        سيتم مراجعة الإيصال وتحديث حالة طلبك عبر الإشعارات. لا يتم إصدار التذكرة إلا بعد اعتماد الدفع.
      </p>
      {receipt && (
        <div className="checkout-submit-dock">
          <button className="btn btn-primary pay-button" type="submit" disabled={bookingSubmitting || accounts.length === 0}>
            {bookingSubmitting ? "جاري رفع الإيصال وإرسال الطلب..." : "إرسال طلب الدفع للمراجعة"} <ArrowLeft size={17} />
          </button>
        </div>
      )}
    </form>
  );
}
