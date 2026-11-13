"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EventCard } from "./EventCard";
import { EventFilters } from "./EventFilters";
import type { EventItem } from "../types";

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
    if (count < 2 || !carousel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
        <EventFilters value={searchQuery} onChange={setSearchQuery} />

        {loading ? (
          <div className="empty-state" role="status"><span className="home-loading-mark" aria-hidden="true" /><strong>جاري تحميل الفعاليات...</strong></div>
        ) : error ? (
          <div className="empty-state" role="alert"><strong>ما قدرنا نحمّل الفعاليات</strong><p>{error}</p><button className="btn btn-outline" onClick={onRetry}>إعادة المحاولة</button></div>
        ) : normalizedQuery && filteredEvents.length === 0 ? (
          <div className="empty-state"><strong>ما لقينا فعاليات مطابقة</strong><p>جرّب كلمة بحث مختلفة أو امسح البحث لعرض كل الفعاليات.</p><button className="btn btn-outline" onClick={() => setSearchQuery("")}>عرض كل الفعاليات</button></div>
        ) : (
          <>
            {!normalizedQuery && <section className="trending-section">
              <div className="redesign-section-head"><div className="redesign-title"><h2>رائج الآن</h2><span className="trending-dot" aria-hidden="true" /></div></div>
              {trendingEvents.length ? (
                <div ref={trendingCarouselRef} className="trending-carousel hide-scrollbar" dir="ltr"
                  onMouseEnter={pauseTrending} onMouseLeave={resumeTrending} onTouchStart={pauseTrending}
                  onTouchEnd={resumeTrending} onTouchCancel={resumeTrending} onScroll={syncTrendingIndex}>
                  {trendingLoopEvents.map((event, index) => (
                    <EventCard key={event.id + "-loop-" + index} event={event} variant="trending"
                      clone={index < trendingEvents.length || index >= trendingEvents.length * 2}
                      onOpen={onOpenEvent} />
                  ))}
                </div>
              ) : <div className="empty-state">ما في فعاليات رائجة حالياً.</div>}
            </section>}

            <section className="more-events redesigned-more">
              <div className="redesign-section-head"><h2>{normalizedQuery ? "نتائج البحث" : "بقية الفعاليات"}</h2><span>{displayedEvents.length} فعالية</span></div>
              {displayedEvents.length ? <div className="event-list">
                {displayedEvents.map((event) => (
                  <EventCard key={event.id} event={event} variant="list" onOpen={onOpenEvent} />
                ))}
              </div> : <div className="empty-state">ما في فعاليات أخرى حالياً.</div>}
            </section>
          </>
        )}
      </div>
    </section>
  );
}
