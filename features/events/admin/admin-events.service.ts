import { getSupabaseBrowserClient } from "../../../lib/supabase";
import type { AdminEventEditorData, AdminEventFormValues, AdminEventRow, AdminTicketForm, AdminEventAccountForm } from "./admin-events.types";

export async function listAdminEvents(): Promise<{ data: AdminEventRow[]; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: [], error: "تعذر الاتصال بقاعدة البيانات." };
  const { data, error } = await supabase.from("events")
    .select("id,title,category,city,venue,starts_at,ends_at,is_continuous,status,created_at,is_trending,description,address,location_url,cover_image_url,platform_fee_percent")
    .order("created_at", { ascending: false }).limit(100);
  return { data: (data || []) as AdminEventRow[], error: error?.message || null };
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
  const [{ count: bookings, error: bookingsError }, { count: tickets, error: ticketsError }] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  if (bookingsError || ticketsError) return { message: "", error: "تعذر التحقق من ارتباطات الفعالية قبل الحذف." };
  if ((bookings || 0) > 0 || (tickets || 0) > 0) {
    const { error } = await supabase.from("events").update({ status: "cancelled", is_trending: false }).eq("id", eventId);
    if (error) return { message: "", error: "تعذر إلغاء الفعالية: " + error.message };
    const { error: ticketError } = await supabase.from("ticket_types").update({ is_active: false }).eq("event_id", eventId);
    if (ticketError) return { message: "", error: "أُلغيت الفعالية لكن تعذر إيقاف أنواع التذاكر: " + ticketError.message };
    return { message: "الفعالية مرتبطة بحجوزات/تذاكر؛ ألغيناها وأخفيناها مع الاحتفاظ بالسجلات.", error: null };
  }
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  return error ? { message: "", error: "تعذر حذف الفعالية: " + error.message } : { message: "تم حذف الفعالية نهائياً.", error: null };
}

export async function publishDraftAdminEvent(eventId: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "تعذر الاتصال بقاعدة البيانات." };
  const { error } = await supabase.from("events").update({ status: "published" }).eq("id", eventId).eq("status", "draft");
  return { error: error?.message ? "تعذر نشر الفعالية: " + error.message : null };
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

  if (!eventForm.title.trim() || !eventForm.city.trim() || !eventForm.venue.trim() || (!eventForm.is_continuous && !eventForm.starts_at))
    return { message: null, error: "أكمل اسم الفعالية والمدينة والمكان وموعد البداية، أو فعّل خيار التذكرة المستمرة." };
  if (!eventForm.is_continuous && eventForm.ends_at && new Date(eventForm.ends_at) <= new Date(eventForm.starts_at))
    return { message: null, error: "موعد نهاية الفعالية لازم يكون بعد موعد البداية." };
  if (eventAccountForms.some(account => !account.account_name.trim() || !account.account_number.trim() || !account.beneficiary.trim()))
    return { message: null, error: "أكمل اسم ورقم كل حساب أو أزله من القائمة." };
  if (!ticketForms.length || ticketForms.some(ticket =>
    !ticket.name.trim() || ticket.price === "" ||
    !Number.isFinite(Number(ticket.price)) || Number(ticket.price) < 0 ||
    (ticket.quantity_total.trim() !== "" && (!Number.isInteger(Number(ticket.quantity_total)) || Number(ticket.quantity_total) < Math.max(1, ticket.quantity_sold))) ||
    (ticket.sales_start_at && ticket.sales_end_at && new Date(ticket.sales_end_at) <= new Date(ticket.sales_start_at))
  )) return { message: null, error: "راجع فئات التذاكر: اسم التذكرة والسعر مطلوبان، والكمية الاختيارية لا تقل عن الكمية المباعة، ونهاية البيع بعد بدايته." };

  let coverUrl = eventForm.cover_image_url.trim() || null;
  if (coverFile) {
    if (!coverFile.type.startsWith("image/")) return { message: null, error: "الملف المختار ليس صورة." };
    if (coverFile.size > 10 * 1024 * 1024) return { message: null, error: "حجم الصورة أكبر من 10 ميجابايت." };
    const extension = (coverFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = user.id + "/" + crypto.randomUUID() + "." + extension;
    const { error } = await supabase.storage.from("event-covers").upload(path, coverFile, {
      contentType: coverFile.type, upsert: false, cacheControl: "31536000",
    });
    if (error) return { message: null, error: "تعذر رفع صورة الغلاف: " + error.message };
    coverUrl = supabase.storage.from("event-covers").getPublicUrl(path).data.publicUrl;
  }

  const eventPayload = {
    title: eventForm.title.trim(), description: eventForm.description.trim() || null,
    category: eventForm.category.trim() || null, city: eventForm.city.trim() || null,
    venue: eventForm.venue.trim() || null, address: eventForm.address.trim() || null,
    location_url: eventForm.location_url.trim() || null,
    starts_at: eventForm.is_continuous ? null : new Date(eventForm.starts_at).toISOString(),
    ends_at: eventForm.is_continuous || !eventForm.ends_at ? null : new Date(eventForm.ends_at).toISOString(),
    is_continuous: eventForm.is_continuous,
    cover_image_url: coverUrl, is_trending: eventForm.is_trending,
    platform_fee_percent: Math.min(100, Math.max(0, Number(eventForm.platform_fee_percent) || 0)),
  };

  if (editingEventId) {
    const { error: updateError } = await supabase.from("events").update(eventPayload).eq("id", editingEventId);
    if (updateError) return { message: null, error: "تعذر تحديث الفعالية: " + updateError.message };
    const { data: existingTickets, error: existingError } = await supabase.from("ticket_types")
      .select("id,quantity_sold").eq("event_id", editingEventId);
    if (existingError) return { message: null, error: "تم تحديث الفعالية لكن تعذر تحميل التذاكر: " + existingError.message };

    const keptIds = ticketForms.map(ticket => ticket.id).filter(Boolean) as string[];
    for (const ticket of ticketForms) {
      if (!ticket.name.trim() || Number(ticket.price) < 0 || (ticket.quantity_total.trim() !== "" && (!Number.isInteger(Number(ticket.quantity_total)) || Number(ticket.quantity_total) < Math.max(1, ticket.quantity_sold))))
        return { message: null, error: "راجع بيانات التذاكر: الكمية لا يمكن أن تقل عن المباع." };
      const payload = {
        name: ticket.name.trim(), description: ticket.description.trim() || null,
        price: Number(ticket.price), currency: ticket.currency, quantity_total: ticket.quantity_total.trim() === "" ? null : Number(ticket.quantity_total),
        sales_start_at: ticket.sales_start_at ? new Date(ticket.sales_start_at).toISOString() : null,
        sales_end_at: ticket.sales_end_at ? new Date(ticket.sales_end_at).toISOString() : null,
        is_active: ticket.is_active,
      };
      const result = ticket.id
        ? await supabase.from("ticket_types").update(payload).eq("id", ticket.id)
        : await supabase.from("ticket_types").insert({ ...payload, event_id: editingEventId, quantity_sold: 0 });
      if (result.error) return { message: null, error: "تم تحديث بيانات الفعالية لكن تعذر حفظ التذاكر: " + result.error.message };
    }

    for (const oldTicket of (existingTickets || []).filter((ticket: any) => !keptIds.includes(ticket.id))) {
      if (Number(oldTicket.quantity_sold) > 0) {
        await supabase.from("ticket_types").update({ is_active: false }).eq("id", oldTicket.id);
        continue;
      }
      const { count } = await supabase.from("booking_items").select("id", { count: "exact", head: true }).eq("ticket_type_id", oldTicket.id);
      if ((count || 0) > 0) await supabase.from("ticket_types").update({ is_active: false }).eq("id", oldTicket.id);
      else await supabase.from("ticket_types").delete().eq("id", oldTicket.id);
    }

    const { data: existingAccounts, error: existingAccountsError } = await supabase.from("event_payment_accounts")
      .select("id").eq("event_id", editingEventId);
    if (existingAccountsError) return { message: null, error: "تم تحديث الفعالية لكن تعذر تحميل حساباتها الحالية: " + existingAccountsError.message };
    const retainedIds = eventAccountForms.map(account => account.id).filter(Boolean) as string[];
    for (const oldAccount of (existingAccounts || []).filter((account: any) => !retainedIds.includes(account.id))) {
      const { error } = await supabase.from("event_payment_accounts").delete().eq("id", oldAccount.id).eq("event_id", editingEventId);
      if (error) return { message: null, error: "تم تحديث الفعالية لكن تعذر إزالة حساب دفع: " + error.message };
    }
    for (let index = 0; index < eventAccountForms.length; index++) {
      const account = eventAccountForms[index];
      const payload = {
        account_name: account.account_name.trim(), account_number: account.account_number.trim(),
        beneficiary: account.beneficiary.trim(), is_active: account.is_active,
        sort_order: account.sort_order ?? (index + 1) * 10,
      };
      const result = account.id
        ? await supabase.from("event_payment_accounts").update(payload).eq("id", account.id).eq("event_id", editingEventId)
        : await supabase.from("event_payment_accounts").insert({ ...payload, event_id: editingEventId });
      if (result.error) return { message: null, error: "تم تحديث الفعالية لكن تعذر حفظ حساباتها: " + result.error.message };
    }
    return { message: "تم تحديث الفعالية وجميع أنواع التذاكر وحسابات الدفع.", error: null };
  }

  const slug = eventForm.title.trim().toLowerCase().normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9\\u0600-\\u06ff]+/g, "-")
    .replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 7);
  const { data: event, error: eventError } = await supabase.from("events")
    .insert({ ...eventPayload, slug, status: "draft", created_by: user.id }).select("id").single();
  if (eventError || !event) return { message: null, error: "تعذر إنشاء الفعالية: " + (eventError?.message || "خطأ غير معروف") };

  const { error: ticketError } = await supabase.from("ticket_types").insert(ticketForms.map(ticket => ({
    event_id: event.id, name: ticket.name.trim(), description: ticket.description.trim() || null,
    price: Number(ticket.price), currency: ticket.currency, quantity_total: ticket.quantity_total.trim() === "" ? null : Number(ticket.quantity_total),
    quantity_sold: 0, sales_start_at: ticket.sales_start_at ? new Date(ticket.sales_start_at).toISOString() : null,
    sales_end_at: ticket.sales_end_at ? new Date(ticket.sales_end_at).toISOString() : null, is_active: ticket.is_active,
  })));
  if (ticketError) {
    await supabase.from("events").delete().eq("id", event.id);
    return { message: null, error: "لم يتم حفظ نوع التذكرة، وتم التراجع عن إنشاء الفعالية: " + ticketError.message };
  }

  if (eventAccountForms.length) {
    const { error } = await supabase.from("event_payment_accounts").insert(eventAccountForms.map((account, index) => ({
      event_id: event.id, account_name: account.account_name.trim(), account_number: account.account_number.trim(),
      beneficiary: account.beneficiary.trim(), is_active: account.is_active, sort_order: account.sort_order ?? (index + 1) * 10,
    })));
    if (error) {
      await supabase.from("events").delete().eq("id", event.id);
      return { message: null, error: "تعذر حفظ حسابات الدفع، وتم التراجع عن إنشاء الفعالية: " + error.message };
    }
  }
  return { message: "تم إنشاء الفعالية ونوع التذكرة كمسودة بنجاح.", error: null };
}
