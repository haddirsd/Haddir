"use client";

import type { FormEvent } from "react";

export function ManualTicketEntry({
  code, loading, disabled, onCodeChange, onSubmit,
}: {
  code: string;
  loading: boolean;
  disabled: boolean;
  onCodeChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="gatekeeper-manual-form" onSubmit={handleSubmit}>
      <label className="gatekeeper-input" htmlFor="gatekeeper-manual-code">كود التذكرة — 10 أرقام فقط</label>
      <div>
        <input
          id="gatekeeper-manual-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{10}"
          maxLength={10}
          minLength={10}
          value={code}
          onChange={event => onCodeChange(event.target.value.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[^0-9]/g, "").slice(0, 10))}
          placeholder="0000000000"
          dir="ltr"
          autoComplete="off"
          aria-describedby="gatekeeper-manual-hint"
        />
        <button type="submit" className="btn btn-outline" disabled={disabled || loading || !/^[0-9]{10}$/.test(code)}>
          {loading ? "جاري الفحص..." : "تحقق ودخول"}
        </button>
      </div>
      <small id="gatekeeper-manual-hint">أدخل عشرة أرقام متتالية دون حروف أو رموز.</small>
    </form>
  );
}
