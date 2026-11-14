"use client";

import type { Dispatch, SetStateAction } from "react";
import { UserRound } from "lucide-react";
import { HaddirDialog } from "../../components/ui/HaddirDialog";
import { AccountDialogs, type AccountDialog } from "../../features/customer-account/components/AccountDialogs";

type BookingGate = "login" | "phone" | null;

type AppOverlaysProps = {
  uiNotice: string;
  onCloseNotice: () => void;
  accountDialog: AccountDialog;
  deleteEmailInput: string;
  setDeleteEmailInput: Dispatch<SetStateAction<string>>;
  deletingAccount: boolean;
  onConfirmSignOut: () => void;
  onContinueDelete: () => void;
  onExecuteDelete: () => void;
  onCloseAccountDialog: () => void;
  bookingGate: BookingGate;
  onContinueBookingGate: () => void;
  onCloseBookingGate: () => void;
};

export function AppOverlays({
  uiNotice,
  onCloseNotice,
  accountDialog,
  deleteEmailInput,
  setDeleteEmailInput,
  deletingAccount,
  onConfirmSignOut,
  onContinueDelete,
  onExecuteDelete,
  onCloseAccountDialog,
  bookingGate,
  onContinueBookingGate,
  onCloseBookingGate,
}: AppOverlaysProps) {
  return (
    <>
      {uiNotice && (
        <HaddirDialog
          open
          title="تنبيه من حاضر"
          description={uiNotice}
          confirmLabel="حسناً"
          onConfirm={onCloseNotice}
          onCancel={onCloseNotice}
        />
      )}

      <AccountDialogs
        accountDialog={accountDialog}
        deleteEmailInput={deleteEmailInput}
        setDeleteEmailInput={setDeleteEmailInput}
        deletingAccount={deletingAccount}
        onConfirmSignOut={onConfirmSignOut}
        onContinueDelete={onContinueDelete}
        onExecuteDelete={onExecuteDelete}
        onClose={onCloseAccountDialog}
      />

      {bookingGate && (
        <div className="booking-gate-backdrop" role="presentation">
          <section
            className="booking-gate-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-gate-title"
          >
            <span className="booking-gate-icon">
              <UserRound size={28} />
            </span>
            <h2 id="booking-gate-title">
              {bookingGate === "phone"
                ? "أضف رقم جوالك لإكمال الحجز"
                : "سجّل الدخول لإكمال الحجز"}
            </h2>
            <p>
              {bookingGate === "phone"
                ? "باقي خطوة واحدة! أضف رقم جوالك عشان نقدر نكمل حجزك ونتواصل معاك عند الحاجة."
                : "تحتاج تسجّل الدخول أولاً عشان نربط الحجز بحسابك ونقدر نتابع تذكرتك."}
            </p>
            <button
              type="button"
              className="booking-gate-primary"
              onClick={onContinueBookingGate}
            >
              {bookingGate === "phone"
                ? "إضافة رقم الجوال"
                : "الانتقال لتسجيل الدخول"}
            </button>
            <button
              type="button"
              className="booking-gate-secondary"
              onClick={onCloseBookingGate}
            >
              لاحقاً
            </button>
          </section>
        </div>
      )}
    </>
  );
}
