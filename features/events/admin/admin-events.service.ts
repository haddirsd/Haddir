import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { optimizeImageToWebp } from "../../../lib/images/optimize-image";
import type { AdminEventEditorData, AdminEventFormValues, AdminEventRow, AdminTicketForm, AdminEventAccountForm } from "./admin-events.types";

const ADMIN_EVENTS_PAGE_SIZE = 25;
const parseDateTime = (value: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function listAdminEvents(page = 1): Promise<{ data: AdminEventRow[]; total: number; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: [], total: 0, error: "تعذر الاتصال بقاعدة البيانات." };

  const safePage = Math.max(1, Math.floor(page));
  const from = (safePage - 1) * ADMIN_EVENTS_PAGE_SIZE;
  const { data, count, error } = await supabase.from("events")
    .select("id,title,category,city,venue,starts_at,ends_at,is_continuous,status,created_at,is_trending,description,address,location_url,cover_image_url,platform_fee_percent", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + ADMIN_EVENTS_PAGE_SIZE - 1);

  if (error) return { data: [], total: 0, error: error.message };
  return { data: (data || []) as AdminEventRow[], total: count || 0, error: null };
}

const toLocalInput = (value: string | null) => value
  ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  : "";

export async function getAdminEventEditorData(eventId: string): Promise<{ data: AdminEventEditorData | null; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: "تعذر الاتصال بقاعدة البيانات." };
  const [accountsResult, ticketsResult] = await Promise.all([
    supabase.from("event_payment_accounts").select("id,account_name,account_number,beneficiary,is_active,sort_order").eq("event_id", eventId).order("sort_order"),
    supabase.from("ticket_types").select("id,name,description,price,currency,quantity_total,quantity_sold,sales_start_at,sales_end_at,is_active").eq("event_id", eventId).order("created_at", { ascending: true }),
  ]);
  if (accountsResult.error) return { data: null, error: "تعذر تحميل حسابات الفعالية: " + accountsResult.error.message };
  if (ticketsResult.error) return { data: null, error: "تعذر تحميل أنواع التذاكر: " + ticketsResult.error.message };
  const paymentAccounts: AdminEventAccountForm[] = (accountsResult.data || []).map((account: any) => ({
    id: account.id, account_name: account.account_name, account_number: account.account_number,
    beneficiary: account.beneficiary || "", is_active: account.is_active, sort_order: account.sort_order,
  }));
  const tickets: AdminTicketForm[] = (ticketsResult.data || []).map((ticket: any) => ({
    id: ticket.id, name: ticket.name, description: ticket.description || "", price: String(ticket.price),
    currency: String(ticket.currency || "SDG").trim(), quantity_total: ticket.quantity_total == null ? "" : String(ticket.quantity_total),
    quantity_sold: Number(ticket.quantity_sold || 0), sales_start_at: toLocalInput(ticket.sales_start_at),
    sales_end_at: toLocalInput(ticket.sales_end_at), is_active: ticket.is_active !== false,
  }));
  return { data: { paymentAccounts, tickets }, error: null };
}

export async function deleteOrCancelAdminEvent(eventId: string): Promise<{ message: string; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { message: "", error: "تعذر الاتصال بقاعدة البيانات." };

  const { data: prepared, error: prepareError } = await supabase.rpc("prepare_settled_event_deletion", {
    p_event_id: eventId,
    p_settlement_confirmed: true,
  });
  if (prepareError || !prepared) {
    return { message: "", error: "تعذر تجهيز الحذف الآمن: " + (prepareError?.message || "لم تصل استجابة من قاعدة البيانات.") };
  }

  const preparedPayload = prepared as { receipt_paths?: unknown; cover_paths?: unknown };
  const receiptPaths = Array.isArray(preparedPayload.receipt_paths) ? preparedPayload.receipt_paths as string[] : [];
  const coverPaths = Array.isArray(preparedPayload.cover_paths) ? preparedPayload.cover_paths as string[] : [];

  if (receiptPaths.length) {
    const { error } = await supabase.storage.from("payment-receipts").remove(receiptPaths);
    if (error) return { message: "", error: "لم تكتمل إزالة إيصالات الدفع؛ أبقينا سجلات الفعالية كما هي. أعد المحاولة بعد معالجة الخطأ: " + error.message };
  }
  if (coverPaths.length) {
    const { error } = await supabase.storage.from("event-covers").remove(coverPaths);
    if (error) return { message: "", error: "لم تكتمل إزالة صور الفعالية؛ أبقينا سجلاتها كما هي. أعد المحاولة بعد معالجة الخطأ: " + error.message };
  }

  const { data: finalized, error: finalizeError } = await supabase.rpc("finalize_settled_event_deletion", {
    p_event_id: eventId,
    p_settlement_confirmed: true,
  });
  const finalizedPayload = finalized as { success?: boolean } | null;
  if (finalizeError || finalizedPayload?.success !== true) {
    return { message: "", error: "تم تجهيز الإحصائيات وإزالة الملفات، لكن لم تكتمل إزالة سجلات الفعالية: " + (finalizeError?.message || "تعذر تأكيد الحذف النهائي.") };
  }

  return { message: "تم حذف الفعالية وبياناتها التشغيلية وإيصالاتها، مع الاحتفاظ بإحصائيات حاضر الإجمالية.", error: null };
}

export async function markAdminEventCompleted(eventId: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "تعذر الاتصال بقاعدة البيانات." };
  const { error } = await supabase.rpc("admin_complete_event", { p_event_id: eventId });
  return { error: error ? "تعذر إنهاء الفعالية: " + error.message : null };
}

export async function publishDraftAdminEvent(eventId: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "تعذر الاتصال بقاعدة البيانات." };
  const { data, error } = await supabase.from("events")
    .update({ status: "published" })
    .eq("id", eventId)
    .eq("status", "draft")
    .select("id");
  if (error) return { error: "تعذر نشر الفعالية: " + error.message };
  if (!data?.length) return { error: "لم يتم نشر الفعالية: المسودة غير موجودة أو لا تملك صلاحية نشرها." };
  return { error: null };
}


export type SaveAdminEventInput = {
  eventForm: AdminEventFormValues;
  ticketForms: AdminTicketForm[];
  eventAccountForms: AdminEventAccountForm[];
  coverFile: File | null;
  editingEventId: string | null;
};

export async function saveAdminEvent(input: SaveAdminEventInput): Promise<{ message: string | null; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { message: null, error: "تعذر الاتصال بقاعدة البيانات." };
  const { eventForm, ticketForms, eventAccountForms, coverFile, editingEventId } = input;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: null, error: "انتهت الجلسة، سجل الدخول مرة أخرى." };

  const startsAt = eventForm.is_continuous ? null : parseDateTime(eventForm.starts_at);
  const endsAt = eventForm.is_continuous || !eventForm.ends_at ? null : parseDateTime(eventForm.ends_at);

  if (!eventForm.title.trim() || !eventForm.city.trim() || !eventForm.venue.trim() || (!eventForm.is_continuous && !startsAt))
    return { message: null, error: "أكمل اسم الفعالية والمدينة والمكان وموعد بداية صالح، أو فعّل خيار التذكرة المستمرة." };
  if (!eventForm.is_continuous && eventForm.ends_at && !endsAt)
    return { message: null, error: "أدخل تاريخاً ووقتاً صالحين لنهاية الفعالية." };
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime())
    return { message: null, error: "موعد نهاية الفعالية لازم يكون بعد موعد البداية." };
  if (eventAccountForms.some(account => !account.account_name.trim() || !account.account_number.trim() || !account.beneficiary.trim()))
    return { message: null, error: "أكمل اسم ورقم كل حساب أو أزله من القائمة." };
  const hasInvalidTicketDates = ticketForms.some(ticket => {
    const salesStartAt = parseDateTime(ticket.sales_start_at);
    const salesEndAt = parseDateTime(ticket.sales_end_at);
    return (!!ticket.sales_start_at && !salesStartAt)
      || (!!ticket.sales_end_at && !salesEndAt)
      || (!!salesStartAt && !!salesEndAt && salesEndAt.getTime() <= salesStartAt.getTime());
  });

  if (!ticketForms.length || hasInvalidTicketDates || ticketForms.some(ticket =>
    !ticket.name.trim() || ticket.price === "" ||
    !Number.isFinite(Number(ticket.price)) || Number(ticket.price) < 0 ||
    (ticket.quantity_total.trim() !== "" && (!Number.isInteger(Number(ticket.quantity_total)) || Number(ticket.quantity_total) < Math.max(1, ticket.quantity_sold)))
  )) return { message: null, error: "راجع فئات التذاكر: اسم التذكرة والسعر مطلوبان، والكمية الاختيارية لا تقل عن الكمية المباعة، وتواريخ البيع صالحة ونهايته بعد بدايته." };

  let coverUrl = eventForm.cover_image_url.trim() || null;
  let uploadedCoverPath: string | null = null;
  if (coverFile) {
    if (coverFile.size > 10 * 1024 * 1024) return { message: null, error: "حجم الصورة الأصلية أكبر من 10 ميجابايت." };
    let optimizedCover: File;
    try {
      optimizedCover = await optimizeImageToWebp(coverFile, {
        maxDimension: 1920,
        quality: 0.86,
        maxOutputBytes: 10 * 1024 * 1024,
      });
    } catch (error) {
      return { message: null, error: error instanceof Error ? error.message : "تعذر تحسين صورة الغلاف." };
    }
    uploadedCoverPath = user.id + "/" + crypto.randomUUID() + ".webp";
    const { error } = await supabase.storage.from("event-covers").upload(uploadedCoverPath, optimizedCover, {
      contentType: "image/webp", upsert: false, cacheControl: "31536000",
    });
    if (error) return { message: null, error: "تعذر رفع صورة الغلاف: " + error.message };
    coverUrl = supabase.storage.from("event-covers").getPublicUrl(uploadedCoverPath).data.publicUrl;
  }

  const eventPayload: Record<string, unknown> = {
    title: eventForm.title.trim(), description: eventForm.description.trim() || null,
    category: eventForm.category.trim() || null, city: eventForm.city.trim() || null,
    venue: eventForm.venue.trim() || null, address: eventForm.address.trim() || null,
    location_url: eventForm.location_url.trim() || null,
    starts_at: startsAt?.toISOString() ?? null,
    ends_at: endsAt?.toISOString() ?? null,
    is_continuous: eventForm.is_continuous,
    cover_image_url: coverUrl, is_trending: eventForm.is_trending,
    platform_fee_percent: Math.min(100, Math.max(0, Number(eventForm.platform_fee_percent) || 0)),
  };

  if (!editingEventId) {
    const slug = eventForm.title.trim().toLowerCase().normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
      .replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 7);
    eventPayload.slug = slug;
  }

  const ticketPayload = ticketForms.map(ticket => ({
    id: ticket.id || null,
    name: ticket.name.trim(), description: ticket.description.trim() || null,
    price: Number(ticket.price), currency: ticket.currency,
    quantity_total: ticket.quantity_total.trim() === "" ? null : Number(ticket.quantity_total),
    sales_start_at: parseDateTime(ticket.sales_start_at)?.toISOString() ?? null,
    sales_end_at: parseDateTime(ticket.sales_end_at)?.toISOString() ?? null,
    is_active: ticket.is_active,
  }));
  const accountPayload = eventAccountForms.map((account, index) => ({
    id: account.id || null,
    account_name: account.account_name.trim(), account_number: account.account_number.trim(),
    beneficiary: account.beneficiary.trim(), is_active: account.is_active,
    sort_order: account.sort_order ?? (index + 1) * 10,
  }));

  const { data: savedEventId, error: saveError } = await supabase.rpc("save_admin_event", {
    p_event_id: editingEventId,
    p_event: eventPayload,
    p_tickets: ticketPayload,
    p_accounts: accountPayload,
  });

  if (saveError || !savedEventId) {
    if (uploadedCoverPath) {
      await supabase.storage.from("event-covers").remove([uploadedCoverPath]);
    }
    return {
      message: null,
      error: "لم يتم حفظ التغييرات؛ تم التراجع عن العملية بالكامل: " + (saveError?.message || "تعذر تأكيد حفظ الفعالية."),
    };
  }

  return {
    message: editingEventId
      ? "تم تحديث الفعالية والتذاكر وحسابات الدفع معاً بنجاح."
      : "تم إنشاء الفعالية والتذاكر وحسابات الدفع كمسودة في عملية واحدة.",
    error: null,
  };
}
