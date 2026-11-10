"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, MapPin, Search, Ticket } from "lucide-react";
import type { EventItem } from "../events.types";

type HomeEventsWorkspaceProps = {
  events: EventItem[];
  loading: boolean;
  error: string;
  onOpenEvent: (eventId: string) => void;
  onRetry: () => void;
};

export function HomeEventsWorkspace({ events, loading, error, onOpenEvent, onRetry }: HomeEventsWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ar");
  const filteredEvents = useMemo(() => {
    if (!normalizedQuery) return events;
    return events.filter((event) =>
      [event.title, event.category, event.venue, event.place]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("ar").includes(normalizedQuery))
    );
  }, [events, normalizedQuery]);

  const trendingEvents = filteredEvents.filter((event) => event.isTrending);
  const otherEvents = filteredEvents.filter((event) => !event.isTrending);
  const displayedEvents = normalizedQuery ? filteredEvents : otherEvents;
  const trendingDisplayEvents = [...trendingEvents].reverse();
  const trendingLoopEvents = trendingDisplayEvents.length > 1
    ? [...trendingDisplayEvents, ...trendingDisplayEvents, ...trendingDisplayEvents]
    : trendingDisplayEvents;
  const trendingCarouselRef = useRef<HTMLDivElement | null>(null);
  const trendingPausedRef = useRef(false);
  const trendingIndexRef = useRef(0);

  const syncTrendingIndex = () => {
    const carousel = trendingCarouselRef.current;
    if (!carousel) return;
    const cards = Array.from(carousel.querySelectorAll<HTMLElement>(".trending-card"));
    const center = carousel.getBoundingClientRect().left + carousel.clientWidth / 2;
    let nearestIndex = trendingIndexRef.current;
    let nearestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
    });
    trendingIndexRef.current = nearestIndex;
  };
  const pauseTrending = () => { syncTrendingIndex(); trendingPausedRef.current = true; };
  const resumeTrending = () => { syncTrendingIndex(); trendingPausedRef.current = false; };

  useEffect(() => {
    const count = trendingEvents.length;
    const carousel = trendingCarouselRef.current;
    if (count < 2 || !carousel) return;
    const centerCard = (cardIndex: number, behavior: ScrollBehavior) => {
      const card = carousel.querySelectorAll<HTMLElement>(".trending-card")[cardIndex];
      if (!card) return;
      const box = carousel.getBoundingClientRect();
      const rect = card.getBoundingClientRect();
      const left = rect.left - box.left + carousel.scrollLeft - (carousel.clientWidth - card.clientWidth) / 2;
      if (behavior === "auto") {
        carousel.style.scrollBehavior = "auto";
        carousel.scrollLeft = left;
        carousel.style.scrollBehavior = "";
      } else carousel.scrollTo({ left, behavior });
    };
    trendingIndexRef.current = count * 2 - 1;
    const initialFrame = window.requestAnimationFrame(() => centerCard(trendingIndexRef.current, "auto"));
    const interval = window.setInterval(() => {
      if (trendingPausedRef.current) return;
      const nextIndex = trendingIndexRef.current - 1;
      if (nextIndex < count - 1) {
        trendingIndexRef.current = count * 2 - 1;
        centerCard(trendingIndexRef.current, "auto");
        return;
      }
      trendingIndexRef.current = nextIndex;
      centerCard(nextIndex, "smooth");
    }, 3000);
    return () => { window.cancelAnimationFrame(initialFrame); window.clearInterval(interval); };
  }, [trendingEvents.length]);

  return (
    <section className="home-discovery redesigned-home" id="events">
      <div className="container">
        <div className="home-search" role="search">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="ابحث عن فعالية أو مكان..." aria-label="ابحث عن فعالية أو مكان" />
          {searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label="مسح البحث">×</button>}
        </div>

        {loading ? (
          <div className="empty-state" role="status"><span className="home-loading-mark" aria-hidden="true" /><strong>جاري تحميل الفعاليات...</strong></div>
        ) : error ? (
          <div className="empty-state" role="alert"><strong>ما قدرنا نحمّل الفعاليات</strong><p>{error}</p><button className="btn btn-outline" onClick={onRetry}>إعادة المحاولة</button></div>
        ) : normalizedQuery && filteredEvents.length === 0 ? (
          <div className="empty-state"><strong>ما لقينا فعاليات مطابقة</strong><p>جرّب كلمة بحث مختلفة أو امسح البحث لعرض كل الفعاليات.</p><button className="btn btn-outline" onClick={() => setSearchQuery("")}>عرض كل الفعاليات</button></div>
        ) : (
          <>
            {!normalizedQuery && <section className="trending-section">
              <div className="redesign-section-head"><div className="redesign-title"><span className="trending-dot" aria-hidden="true" /><h2>رائج الآن</h2></div></div>
              {trendingEvents.length ? (
                <div ref={trendingCarouselRef} className="trending-carousel hide-scrollbar" dir="ltr"
                  onMouseEnter={pauseTrending} onMouseLeave={resumeTrending} onTouchStart={pauseTrending}
                  onTouchEnd={resumeTrending} onTouchCancel={resumeTrending} onScroll={syncTrendingIndex}>
                  {trendingLoopEvents.map((event, index) => {
                    const isClone = index < trendingEvents.length || index >= trendingEvents.length * 2;
                    return <article className="trending-card snap-item" key={event.id + "-loop-" + index}
                      role="button" tabIndex={isClone ? -1 : 0} aria-hidden={isClone}
                      aria-label={"عرض تفاصيل " + event.title} onClick={() => onOpenEvent(event.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenEvent(event.id); } }}>
                      <div className={"trending-card-media " + event.cover}>
                        {event.coverImageUrl ? <img src={event.coverImageUrl} alt={isClone ? "" : event.title} loading="lazy" /> : <span className="trending-placeholder">✦</span>}
                        <div className="trending-overlay" />
                        <span className="trending-category">{event.category}</span><span className="trending-price">{event.price}</span>
                        <div className="trending-card-copy"><h3>{event.title}</h3>
                          <div><CalendarDays size={14} /><span>{event.date} · {event.time}</span></div>
                          <div><MapPin size={14} /><span>{event.venue || event.place}</span></div>
                        </div>
                      </div>
                    </article>;
                  })}
                </div>
              ) : <div className="empty-state">ما في فعاليات رائجة حالياً.</div>}
            </section>}

            <section className="more-events redesigned-more">
              <div className="redesign-section-head"><h2>{normalizedQuery ? "نتائج البحث" : "بقية الفعاليات"}</h2><span>{displayedEvents.length} فعالية</span></div>
              {displayedEvents.length ? <div className="event-list">
                {displayedEvents.map((event) => (
                  <article className="event-list-card event-card-clickable ticket-style-card" key={event.id}
                    role="button" tabIndex={0} aria-label={"عرض تفاصيل " + event.title}
                    onClick={() => onOpenEvent(event.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenEvent(event.id); } }}>
                    <span className="ticket-notch ticket-notch-right" aria-hidden="true" />
                    <span className="ticket-notch ticket-notch-left" aria-hidden="true" />
                    <div className="event-list-main">
                      <div className="event-list-thumb">
                        {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} loading="lazy" /> : <span>✦</span>}
                      </div>
                      <div className="event-list-info">
                        <span className="event-category-chip">{event.category}</span>
                        <h3>{event.title}</h3>
                        <div className="event-list-meta">
                          <p><MapPin size={13} /><span>{event.venue || event.place}</span></p>
                          <p><CalendarDays size={13} /><span>{event.date} · {event.time}</span></p>
                        </div>
                      </div>
                    </div>
                    <div className="ticket-card-perforation" aria-hidden="true"><span /></div>
                    <div className="ticket-card-footer">
                      <strong className="event-list-price">{event.price}</strong>
                    </div>
                  </article>
                ))}
              </div> : <div className="empty-state">ما في فعاليات أخرى حالياً.</div>}
            </section>
          </>
        )}
      </div>
    </section>
  );
}
