"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2 } from "lucide-react";

type BookingSuccessProps = {
  bookingNumber: string;
  eventTitle: string;
  ticketCount: number;
  totalLabel: string;
  onGoNotifications: () => void;
};

export function BookingSuccess({
  bookingNumber,
  eventTitle,
  ticketCount,
  totalLabel,
  onGoNotifications,
}: BookingSuccessProps) {
  const [mounted, setMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDarkMode(Boolean(document.querySelector(".app-shell.theme-dark")));
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className={"booking-success-backdrop" + (darkMode ? " theme-dark" : "")} role="presentation">
      <section
        className="booking-success booking-success-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
        aria-describedby="booking-success-description"
        dir="rtl"
      >
        <span className="success-mark"><CheckCircle2 size={34} /></span>
        <span className="section-kicker">تم بنجاح</span>
        <h1 id="booking-success-title">استلمنا طلب حجزك!</h1>
        <p id="booking-success-description">
          تم استلام إثبات الدفع للحجز <strong>{bookingNumber}</strong> لفعالية{" "}
          <strong>{eventTitle}</strong>، وأُرسل الآن لفريق حاضر للمراجعة. ستصدر التذكرة ورمز QR بعد اعتماد الدفع.
        </p>
        <div className="success-summary">
          <span>عدد التذاكر</span>
          <strong>{ticketCount}</strong>
          <span>الإجمالي</span>
          <strong>{totalLabel}</strong>
        </div>
        <button className="btn btn-primary pay-button booking-success-confirm" type="button" onClick={onGoNotifications}>
          موافقة
        </button>
      </section>
    </div>,
    document.body
  );
}
