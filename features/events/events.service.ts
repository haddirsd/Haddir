import { getSupabaseBrowserClient } from "../../lib/supabase";
import type { EventItem, PublicEventsResult } from "./events.types";

const formatEventDate = (value: string) =>
  new Intl.DateTimeFormat("ar-SD", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));

const currencyLabel = (currency: string) =>
  ({ SDG: "ج.س", SAR: "ر.س", AED: "د.إ", USD: "$", EGP: "ج.م" }[
    currency.trim().toUpperCase()
  ] || currency.trim().toUpperCase());

const formatMoney = (value: number, currency = "SDG") =>
  new Intl.NumberFormat("ar-SD").format(value) + " " + currencyLabel(currency);

export async function getPublishedEvents(): Promise<PublicEventsResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");

  const { data, error } = await supabase
    .from("events")
    .select("id,title,category,city,venue,starts_at,description,status,is_trending,cover_image_url,location_url")
    .eq("status", "published")
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("Could not load events", error);
    throw new Error(error.message || "تعذر تحميل الفعاليات.");
  }

  const eventRows = data || [];
  const eventIds = eventRows.map((event: any) => event.id);
  let ticketRows: any[] = [];
  let ticketTypesError = "";

  if (eventIds.length) {
    const { data: ticketData, error: ticketError } = await supabase
      .from("ticket_types")
      .select("id,event_id,name,description,price,currency,quantity_total,quantity_sold,sales_start_at,sales_end_at,is_active")
      .in("event_id", eventIds);

    if (ticketError) {
      console.error("Could not load ticket types", ticketError);
      ticketTypesError =
        "تعذر تحميل فئات وأسعار التذاكر من قاعدة البيانات. " +
        (ticketError.message || "");
    } else {
      ticketRows = ticketData || [];
    }
  }

  const now = Date.now();
  const events: EventItem[] = eventRows.map((event: any, index: number) => {
    const tiers = ticketRows
      .filter((ticket: any) => ticket.event_id === event.id && ticket.is_active)
      .map((ticket: any) => {
        const total = Math.max(0, Number(ticket.quantity_total) || 0);
        const sold = Math.max(0, Number(ticket.quantity_sold) || 0);
        const available = Math.max(0, total - sold);
        const starts = ticket.sales_start_at
          ? new Date(ticket.sales_start_at).getTime()
          : 0;
        const ends = ticket.sales_end_at
          ? new Date(ticket.sales_end_at).getTime()
          : Infinity;

        return {
          id: ticket.id,
          name: ticket.name,
          description: ticket.description || "",
          priceValue: Number(ticket.price),
          currency: String(ticket.currency || "SDG").trim(),
          price:
            Number(ticket.price) === 0
              ? "مجاناً"
              : formatMoney(Number(ticket.price), String(ticket.currency || "SDG")),
          quantityTotal: total,
          quantitySold: sold,
          available,
          availableNow: available > 0 && now >= starts && now <= ends,
        };
      });

    const eventEnded = new Date(event.starts_at).getTime() <= now;
    const status = eventEnded
      ? "انتهت"
      : tiers.length === 0
        ? "غير متاح"
        : tiers.every((tier) => tier.available <= 0)
          ? "تم البيع بالكامل"
          : tiers.every((tier) => !tier.availableNow)
            ? "البيع غير متاح حالياً"
            : "متوفر";

    return {
      id: event.id,
      date: formatEventDate(event.starts_at),
      title: event.title,
      place: event.city || "",
      category: event.category || "فعاليات",
      price: tiers[0]?.price || "—",
      cover: ["cover-one", "cover-two", "cover-three"][index % 3],
      coverImageUrl: event.cover_image_url || null,
      tag: event.category || "فعالية",
      time: new Intl.DateTimeFormat("ar-SD", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(event.starts_at)),
      venue: event.venue || event.city || "",
      status,
      map:
        event.location_url ||
        "https://www.google.com/maps/search/?api=1&query=" +
          encodeURIComponent((event.venue || "") + " " + (event.city || "")),
      about: event.description || "تفاصيل الفعالية ستُضاف قريباً.",
      isTrending: !!event.is_trending,
      tiers,
    };
  });

  return { events, ticketTypesError };
}
