"use client";

import { CalendarDays, MapPin } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { EventItem } from "../types";

type EventCardProps = {
  event: EventItem;
  variant: "trending" | "list";
  onOpen: (eventId: string) => void;
  clone?: boolean;
};

export function EventCard({ event, variant, onOpen, clone = false }: EventCardProps) {
  const open = () => onOpen(event.id);
  const handleKeyDown = (eventKey: KeyboardEvent<HTMLElement>) => {
    if (eventKey.key === "Enter" || eventKey.key === " ") {
      eventKey.preventDefault();
      open();
    }
  };

  if (variant === "trending") {
    return (
      <article className="trending-card snap-item" role="button" tabIndex={clone ? -1 : 0}
        aria-hidden={clone} aria-label={"عرض تفاصيل " + event.title}
        onClick={open} onKeyDown={handleKeyDown}>
        <div className={"trending-card-media " + event.cover}>
          {event.coverImageUrl ? <img src={event.coverImageUrl} alt={clone ? "" : event.title} loading="lazy" decoding="async" /> : <span className="trending-placeholder">✦</span>}
          <div className="trending-overlay" />
          <span className="trending-category">{event.category}</span>
          <span className="trending-price">{event.price}</span>
          <div className="trending-card-copy">
            <h3>{event.title}</h3>
            <div><CalendarDays size={14} /><span>{event.date} · {event.time}</span></div>
            <div><MapPin size={14} /><span>{event.venue || event.place}</span></div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="event-list-card event-card-clickable ticket-style-card" role="button"
      tabIndex={0} aria-label={"عرض تفاصيل " + event.title} onClick={open} onKeyDown={handleKeyDown}>
      <div className="event-list-main">
        <div className="event-list-thumb">
          {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} loading="lazy" decoding="async" /> : <span>✦</span>}
        </div>
        <div className="event-list-info">
          <h3>{event.title}</h3>
          <span className="event-category-chip">{event.category}</span>
          <div className="event-list-meta">
            <p><MapPin size={13} /><span>{event.venue || event.place}</span></p>
            <p><CalendarDays size={13} /><span>{event.date} · {event.time}</span></p>
          </div>
        </div>
      </div>
      <div className="ticket-card-perforation" aria-hidden="true"><span /></div>
      <div className="ticket-card-footer"><strong className="event-list-price">{event.price}</strong></div>
    </article>
  );
}
