"use client";

// One-time consent gate shown before organizer permissions are activated.

import { useState } from "react";
import { ShieldCheck, FileText } from "lucide-react";

type Props = {
  onAccept: () => Promise<{ error: string | null }>;
};

export function OrganizerTermsConsent({ onAccept }: Props) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    if (!checked || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await onAccept();
      if (result.error) setError(result.error);
    } catch {
      setError("تعذر حفظ الموافقة حالياً. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legal-consent-backdrop" role="presentation">
      <section className="legal-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="legal-consent-title">
        <header className="legal-consent-head">
          <span className="privacy-eyebrow"><ShieldCheck size={15}/> حاضر • تفعيل دور المنظم</span>
          <h2 id="legal-consent-title">قبل تفعيل صلاحيات المنظم</h2>
          <p>تم تغيير دور حسابك إلى منظم/صاحب فعالية. يلزم الاطلاع على الشروط والموافقة عليها مرة واحدة قبل إتاحة صلاحيات هذا الدور.</p>
        </header>
        <div className="legal-consent-content">
          <section><h3>مسؤولية تنظيم الفعالية</h3><p>حاضِر منصة لتسهيل عرض الفعاليات والحجوزات وتوفير التذاكر، وليست الجهة المنظمة أو المنفذة. أنت مسؤول عن التنظيم والتنفيذ وصحة المعلومات والخدمات المعلن عنها.</p></section>
          <section><h3>الأسعار والعمولة</h3><p>تحدد سعر التذكرة بنفسك، وتُخصم عمولة حاضِر من مستحقاتك وفق النسبة المتفق عليها لكل فعالية، دون إضافة عمولة من حاضِر على المشتري.</p></section>
          <section><h3>الإلغاء والتأجيل والاسترداد</h3><p>عند التأجيل، تحدث حاضِر التاريخ والوقت، وتتولى أنت التواصل مع المشترين. وعند الإلغاء، تتعاون مع حاضِر لإعادة المبالغ المستحقة. وإذا كانت الأموال قد حُولت إليك مباشرة، تتابعك حاضِر وتطالبك بإعادتها دون أن تلتزم بالدفع من أموالها الخاصة نيابة عنك.</p></section>
          <section><h3>الشكاوى وبيانات المشترين</h3><p>تتحمل معالجة الشكاوى المتعلقة بالتنظيم والتنفيذ الميداني. وتلتزم بسرية بيانات المشترين، ولا تستخدمها للتسويق أو لأي غرض خارج تنفيذ الفعالية إلا بموافقتهم أو بمسوغ قانوني.</p></section>
          <section><h3>سياسات المنصة والخصوصية</h3><p>يجوز لحاضِر رفض نشر الفعالية أو تعليقها أو إزالتها عند مخالفة القانون أو سياسات المنصة أو نشر معلومات مضللة، مع مراعاة الحجوزات القائمة وحقوق المشترين. وتوضح سياسة الخصوصية كيفية التعامل مع البيانات.</p></section>
          <a className="btn btn-outline" href="/?tab=profile&legal=1#legal-documents" target="_blank" rel="noreferrer"><FileText size={16}/> قراءة الوثائق كاملة</a>
        </div>
        <footer className="legal-consent-footer">
          <label className="legal-consent-check"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)}/><span>قرأت ووافقت على شروط وأحكام المنظم والأحكام العامة وسياسة الخصوصية.</span></label>
          {error && <p className="profile-save-error" role="alert">{error}</p>}
          <div className="legal-consent-actions"><button type="button" className="btn btn-primary" disabled={!checked || saving} onClick={() => void accept()}>{saving ? "جارٍ حفظ الموافقة..." : "تأكيد الموافقة وتفعيل الدور"}</button></div>
        </footer>
      </section>
    </div>
  );
}
