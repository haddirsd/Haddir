"use client";

import { Copy } from "lucide-react";
import { HaddirSelect } from "../../../components/ui/HaddirSelect";
import type { EventPaymentAccount } from "../booking.types";

type PaymentMethodSelectorProps = {
  accounts: EventPaymentAccount[];
  paymentMethod: string;
  onPaymentMethodChange: (value: string) => void;
  accountCopied: boolean;
  onCopyAccount: (accountNumber: string) => void;
};

export function PaymentMethodSelector({
  accounts,
  paymentMethod,
  onPaymentMethodChange,
  accountCopied,
  onCopyAccount,
}: PaymentMethodSelectorProps) {
  const selectedAccount = accounts.find((account) => account.id === paymentMethod);

  return (
    <section className="checkout-section">
      <h2>طريقة الدفع</h2>
      <label className="checkout-label">
        <span>اختر حساب التحويل</span>
        <HaddirSelect
          value={paymentMethod}
          onChange={onPaymentMethodChange}
          disabled={accounts.length === 0}
          ariaLabel="اختيار حساب التحويل"
          placeholder="اضغط هنا لاختيار طريقة الدفع"
          options={accounts.map(account=>({value:account.id,label:account.account_name}))}
        />
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
  );
}
