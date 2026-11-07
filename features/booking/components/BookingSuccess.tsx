"use client";

import { Bell, CheckCircle2 } from "lucide-react";

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
  return (
    <div className="booking-success">
      <span className="success-mark"><CheckCircle2 size={34} /></span>
      <span className="section-kicker">تم بنجاح</span>
      <h1>استلمنا طلب حجزك!</h1>
      <p>
        تم استلام إثبات الدفع للحجز <strong>{bookingNumber}</strong> لفعالية{" "}
        <strong>{eventTitle}</strong>، وأُرسل الآن لفريق حاضر للمراجعة. ستصدر التذكرة ورمز QR بعد اعتماد الدفع.
      </p>
      <div className="success-summary">
        <span>عدد التذاكر</span>
        <strong>{ticketCount}</strong>
        <span>الإجمالي</span>
        <strong>{totalLabel}</strong>
      </div>
      <button className="btn btn-primary pay-button" onClick={onGoNotifications}>
        مراجعة الإشعارات <Bell size={17} />
      </button>
    </div>
  );
}
