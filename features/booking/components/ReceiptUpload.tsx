"use client";

import { useState, type ChangeEvent } from "react";
import { CreditCard } from "lucide-react";

type ReceiptUploadProps = {
  receipt: File | null;
  onReceiptChange: (file: File | null) => void;
};

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ReceiptUpload({ receipt, onReceiptChange }: ReceiptUploadProps) {
  const [validationError, setValidationError] = useState("");

  const handleReceiptChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] || null;

    // Reset the native input so the same file can be selected again after rejection.
    event.currentTarget.value = "";

    if (!file) return;

    if (!ALLOWED_RECEIPT_TYPES.has(file.type.toLowerCase())) {
      onReceiptChange(null);
      setValidationError("الملف غير مدعوم. اختر صورة بصيغة JPG أو PNG أو WebP فقط.");
      return;
    }

    if (file.size <= 0) {
      onReceiptChange(null);
      setValidationError("الصورة المختارة فارغة. اختر صورة إيصال صالحة.");
      return;
    }

    if (file.size > MAX_RECEIPT_SIZE) {
      onReceiptChange(null);
      setValidationError("حجم الصورة يتجاوز الحد المسموح به وهو 5 ميجابايت.");
      return;
    }

    setValidationError("");
    onReceiptChange(file);
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
      {validationError && (
        <p className="checkout-footnote" role="alert" aria-live="polite">
          {validationError}
        </p>
      )}
    </section>
  );
}
