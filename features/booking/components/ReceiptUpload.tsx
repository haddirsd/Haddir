"use client";

import type { ChangeEvent } from "react";
import { CreditCard } from "lucide-react";

type ReceiptUploadProps = {
  receipt: File | null;
  onReceiptChange: (file: File | null) => void;
};

export function ReceiptUpload({ receipt, onReceiptChange }: ReceiptUploadProps) {
  const handleReceiptChange = (event: ChangeEvent<HTMLInputElement>) => {
    onReceiptChange(event.target.files?.[0] || null);
    // Allow selecting the same file again after replacing or clearing it.
    event.currentTarget.value = "";
  };

  return (
    <section className="checkout-section">
      <h2>إيصال التحويل</h2>
      <label className="receipt-upload">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleReceiptChange}
        />
        <span className="upload-symbol"><CreditCard size={20} /></span>
        <strong>{receipt ? receipt.name : "ارفع صورة إيصال التحويل"}</strong>
        <small>ارفع صورة إيصال التحويل الفعلية فقط (JPG أو PNG أو WebP) · بحد أقصى 5 ميجابايت</small>
        <span className="upload-action">{receipt ? "تغيير صورة الإيصال" : "اضغط هنا لاختيار صورة الإيصال"}</span>
      </label>
    </section>
  );
}
