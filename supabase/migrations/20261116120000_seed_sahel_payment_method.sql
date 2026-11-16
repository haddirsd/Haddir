-- Repair the missing Sahel payment method seed without rewriting historical migrations.
insert into public.payment_methods (
  id,
  name,
  account_details,
  beneficiary,
  instructions,
  is_active,
  sort_order
)
values (
  'sahel',
  'ساهل',
  'أدخل بيانات الدفع من لوحة التحكم',
  'حاضر للفعاليات',
  'حوّل المبلغ الموضح ثم ارفع صورة الإيصال.',
  false,
  30
)
on conflict (id) do nothing;
