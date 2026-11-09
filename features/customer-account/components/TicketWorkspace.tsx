"use client";

import { CalendarDays, Download, Ticket, UserRound } from "lucide-react";
import { QRCodeSVG as QrCodeSVG } from "qrcode.react";

export type CustomerTicket = {
  id: string;
  status: string;
  ticket_code: string;
  events?: { title?: string; starts_at?: string; venue?: string; cover_image_url?: string | null } | null;
  ticket_types?: { name?: string } | null;
  bookings?: { booking_number?: string } | null;
  booking_items?: { quantity?: number } | null;
};

type TicketWorkspaceProps = {
  loading: boolean;
  error: string;
  tickets: CustomerTicket[];
  filter: "new" | "used";
  expandedTicketId: string | null;
  onFilterChange: (filter: "new" | "used") => void;
  onToggleTicket: (ticketId: string) => void;
  onDownloadTicket: (ticket: CustomerTicket) => void;
  formatEventDate: (value: string) => string;
};

export function TicketWorkspace({
  loading,
  error,
  tickets,
  filter,
  expandedTicketId,
  onFilterChange,
  onToggleTicket,
  onDownloadTicket,
  formatEventDate,
}: TicketWorkspaceProps) {
  const visibleTickets = tickets.filter((ticket) => ticket.status === (filter === "new" ? "valid" : "used"));

  return (
    <section className="screen container tickets-screen">
      {loading ? <div className="empty-state">جاري تحميل تذاكرك...</div> : error ? <div className="empty-state" role="alert">{error}</div> : <>
        <div className="ticket-tabs" role="tablist" aria-label="حالة التذاكر">
          <button type="button" role="tab" aria-selected={filter === "new"} className={filter === "new" ? "active" : ""} onClick={() => onFilterChange("new")}>
            تذاكر جديدة <span>{tickets.filter((ticket) => ticket.status === "valid").length}</span>
          </button>
          <button type="button" role="tab" aria-selected={filter === "used"} className={filter === "used" ? "active" : ""} onClick={() => onFilterChange("used")}>
            تذاكر مستخدمة <span>{tickets.filter((ticket) => ticket.status === "used").length}</span>
          </button>
        </div>

        {visibleTickets.length === 0 ? <div className="empty-state">
          <Ticket size={28} />
          <strong>{filter === "new" ? "ما عندك تذاكر جديدة حالياً" : "ما عندك تذاكر مستخدمة حالياً"}</strong>
          <p>{filter === "new" ? "بعد قبول إثبات الدفع، حتظهر تذاكرك هنا." : "التذاكر التي يتم تأكيد دخولها عند البوابة حتظهر هنا."}</p>
        </div> : <div className="ticket-list">
          {visibleTickets.map((ticket) => <div className="ticket-card-wrap" key={ticket.id} data-ticket-id={ticket.id}>
            <button type="button" className="ticket-preview-card" aria-expanded={expandedTicketId === ticket.id} onClick={() => onToggleTicket(ticket.id)}>
              <span className="ticket-preview-image">
                {ticket.events?.cover_image_url ? <img src={ticket.events.cover_image_url} alt={ticket.events?.title || "صورة الفعالية"} loading="lazy" /> : <span className="ticket-preview-fallback"><Ticket size={25} /></span>}
              </span>
              <span className="ticket-preview-copy">
                <strong>{ticket.events?.title || "فعالية"}</strong>
                <span><CalendarDays size={13} />{ticket.events?.starts_at ? formatEventDate(ticket.events.starts_at) : "التاريخ غير محدد"}</span>
                <span><UserRound size={13} />عدد الأشخاص: {ticket.booking_items?.quantity || 1}</span>
              </span>
              <span className={"ticket-preview-status " + (ticket.status === "used" ? "used" : "")}>{ticket.status === "used" ? "مستخدمة" : "جديدة"}</span>
            </button>

            {expandedTicketId === ticket.id && <div className="ticket-expanded-panel">
              <article className="haddir-ticket">
                <div className="haddir-ticket-head"><img className="haddir-ticket-logo" src="/Haddir_Logo_Blue.svg" alt="حاضر" /><span className="ticket-confirmed">{ticket.status === "valid" ? "تذكرة صالحة" : ticket.status === "used" ? "تم استخدامها" : ticket.status}</span></div>
                <div className="haddir-ticket-event"><small>تذكرة دخول</small><h2>{ticket.events?.title || "فعالية"}</h2></div>
                <div className="haddir-ticket-meta">
                  <div><small>نوع التذكرة</small><strong>{ticket.ticket_types?.name || "تذكرة"}</strong></div>
                  <div><small>رقم الحجز</small><strong>{ticket.bookings?.booking_number || "—"}</strong></div>
                  <div><small>الموقع</small><strong>{ticket.events?.venue || "—"}</strong></div>
                  <div><small>التاريخ</small><strong>{ticket.events?.starts_at ? formatEventDate(ticket.events.starts_at) : "—"}</strong></div>
                  <div><small>عدد الأشخاص</small><strong>{ticket.booking_items?.quantity || 1} أشخاص</strong></div>
                </div>
                <div className="haddir-ticket-qr"><QrCodeSVG value={ticket.ticket_code} size={220} level="H" includeMargin /><small>امسح الرمز للتحقق من التذكرة، أو أدخل الكود يدوياً عند البوابة</small></div>
                <div className="haddir-ticket-code"><small>كود الدخول · 10 أرقام</small><strong dir="ltr">{ticket.ticket_code}</strong></div>
                <div className="haddir-ticket-footer">احتفظ بتذكرتك وأبرزها عند الدخول</div>
              </article>
              <button className="btn btn-outline pay-button" type="button" onClick={() => onDownloadTicket(ticket)}><Download size={17} /> حفظ التذكرة كصورة</button>
            </div>}
          </div>)}
        </div>}
      </>}
    </section>
  );
}
