import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { EventItem, PublicEventsResult } from "../types";

import { formatEventDate, formatMoney } from "../utils/events.formatters";

const EVENT_SELECT =
  "id,title,category,city,venue,starts_at,ends_at,is_continuous,description,status,is_trending,cover_image_url,location_url";
const TICKET_SELECT =
  "id,event_id,name,description,price,currency,quantity_total,quantity_sold,sales_start_at,sales_end_at,is_active";

function mapPublishedEvent(event: any, ticketRows: any[], index: number): EventItem {
  const now = Date.now();
  const tiers = ticketRows
    .filter((ticket: any) => ticket.event_id === event.id && ticket.is_active)
    .map((ticket: any) => {
      const unlimited = ticket.quantity_total == null;
      const total = unlimited ? -1 : Math.max(0, Number(ticket.quantity_total) || 0);
      const sold = Math.max(0, Number(ticket.quantity_sold) || 0);
      const available = unlimited ? Number.POSITIVE_INFINITY : Math.max(0, total - sold);
      const starts = ticket.sales_start_at ? new Date(ticket.sales_start_at).getTime() : 0;
      const ends = ticket.sales_end_at ? new Date(ticket.sales_end_at).getTime() : Infinity;

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
        availableNow:
          (unlimited || available > 0) &&
          (event.is_continuous ||
            (!!event.starts_at &&
              (event.ends_at
                ? new Date(event.ends_at).getTime()
                : new Date(event.starts_at).getTime()) > now)) &&
          now >= starts &&
          now <= ends,
      };
    });

  const eventStartsAt = event.starts_at ? new Date(event.starts_at).getTime() : Infinity;
  const eventEndsAt = event.ends_at ? new Date(event.ends_at).getTime() : Infinity;
  const eventStarted = !event.is_continuous && eventStartsAt <= now;
  const eventEnded = !event.is_continuous && !!event.ends_at && eventEndsAt <= now;
  const status = eventEnded
    ? "انتهت"
    : eventStarted
      ? "بدأت"
      : tiers.length === 0
        ? "غير متاح"
        : tiers.every((tier) => tier.available <= 0)
          ? "تم البيع بالكامل"
          : tiers.every((tier) => !tier.availableNow)
            ? "البيع غير متاح حالياً"
            : "متوفر";

  return {
    id: event.id,
    startsAt: event.starts_at || null,
    date: event.is_continuous ? "تذكرة مستمرة" : formatEventDate(event.starts_at),
    title: event.title,
    place: event.city || "",
    category: event.category || "فعاليات",
    price: tiers[0]?.price || "—",
    cover: ["cover-one", "cover-two", "cover-three"][index % 3],
    coverImageUrl: event.cover_image_url || null,
    tag: event.category || "فعالية",
    time: event.is_continuous
      ? "متاح طوال اليوم"
      : new Intl.DateTimeFormat("ar-SD-u-nu-latn", {
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
    isContinuous: !!event.is_continuous,
    tiers,
  };
}

export async function getPublishedEvents(): Promise<PublicEventsResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("status", "published")
    .order("starts_at", { ascending: true, nullsFirst: false });

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
      .select(TICKET_SELECT)
      .in("event_id", eventIds)
      .order("created_at", { ascending: true });

    if (ticketError) {
      console.error("Could not load ticket types", ticketError);
      ticketTypesError =
        "تعذر تحميل فئات وأسعار التذاكر من قاعدة البيانات. " +
        (ticketError.message || "");
    } else {
      ticketRows = ticketData || [];
    }
  }

  return {
    events: eventRows.map((event: any, index: number) =>
      mapPublishedEvent(event, ticketRows, index)
    ),
    ticketTypesError,
  };
}

export async function getPublishedEventById(
  eventId: string,
  index = 0
): Promise<{ event: EventItem | null; ticketTypesError: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");

  const { data: event, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("Could not refresh public event", error);
    throw new Error(error.message || "تعذر تحديث الفعالية.");
  }
  if (!event) return { event: null, ticketTypesError: "" };

  const { data: ticketRows, error: ticketError } = await supabase
    .from("ticket_types")
    .select(TICKET_SELECT)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (ticketError) {
    console.error("Could not refresh event ticket types", ticketError);
    return {
      event: mapPublishedEvent(event, [], index),
      ticketTypesError:
        "تعذر تحميل فئات وأسعار التذاكر من قاعدة البيانات. " +
        (ticketError.message || ""),
    };
  }

  return {
    event: mapPublishedEvent(event, ticketRows || [], index),
    ticketTypesError: "",
  };
}
