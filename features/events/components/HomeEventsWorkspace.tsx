"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import type { EventItem } from "../events.types";

type HomeEventsWorkspaceProps = {
  events: EventItem[];
  loading: boolean;
  error: string;
  onOpenEvent: (eventId: string) => void;
  onRetry: () => void;
};

export function HomeEventsWorkspace({
  events,
  loading,
  error,
  onOpenEvent,
  onRetry,
}: HomeEventsWorkspaceProps) {
  const trendingEvents = events.filter((event) => event.isTrending);
  const trendingDisplayEvents = [...trendingEvents].reverse();
  const trendingLoopEvents =
    trendingDisplayEvents.length > 1
      ? [...trendingDisplayEvents, ...trendingDisplayEvents, ...trendingDisplayEvents]
      : trendingDisplayEvents;
  const trendingCarouselRef = useRef<HTMLDivElement | null>(null);
  const trendingPausedRef = useRef(false);
  const trendingIndexRef = useRef(0);

  const syncTrendingIndex = () => {
    const carousel = trendingCarouselRef.current;
    if (!carousel) return;
    const cards = Array.from(
      carousel.querySelectorAll<HTMLElement>(".trending-card")
    );
    const center = carousel.getBoundingClientRect().left + carousel.clientWidth / 2;
    let nearestIndex = trendingIndexRef.current;
    let nearestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    trendingIndexRef.current = nearestIndex;
  };

  const pauseTrending = () => {
    syncTrendingIndex();
    trendingPausedRef.current = true;
  };

  const resumeTrending = () => {
    syncTrendingIndex();
    trendingPausedRef.current = false;
  };

  useEffect(() => {
    const count = trendingEvents.length;
    const carousel = trendingCarouselRef.current;
    if (count < 2 || !carousel) return;

    let resetTimer: number | undefined;

    const centerCard = (cardIndex: number, behavior: ScrollBehavior) => {
      const cards = carousel.querySelectorAll<HTMLElement>(".trending-card");
      const card = cards[cardIndex];
      if (!card) return;
      const box = carousel.getBoundingClientRect();
      const rect = card.getBoundingClientRect();
      const left =
        rect.left -
        box.left +
        carousel.scrollLeft -
        (carousel.clientWidth - card.clientWidth) / 2;

      if (behavior === "auto") {
        carousel.style.scrollBehavior = "auto";
        carousel.scrollLeft = left;
        carousel.style.scrollBehavior = "";
      } else {
        carousel.scrollTo({ left, behavior });
      }
    };

    trendingIndexRef.current = count * 2 - 1;
    const initialFrame = window.requestAnimationFrame(() =>
      centerCard(trendingIndexRef.current, "auto")
    );

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

    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.clearInterval(interval);
      if (resetTimer !== undefined) window.clearTimeout(resetTimer);
    };
  }, [trendingEvents.length]);

  return (
    <section className="home-discovery redesigned-home" id="events">
      <div className="container">
        {loading ? (
          <div className="empty-state">
            <strong>جاري تحميل الفعاليات...</strong>
          </div>
        ) : error ? (
          <div className="empty-state" role="alert">
            <strong>ما قدرنا نحمّل الفعاليات</strong>
            <p>{error}</p>
            <button className="btn btn-outline" onClick={onRetry}>
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <>
            <section className="trending-section">
              <div className="redesign-section-head">
                <div className="redesign-title">
                  <h2>رائج الآن</h2>
                  <span className="trending-dot" aria-hidden="true" />
                </div>
              </div>
              {trendingEvents.length ? (
                <div
                  ref={trendingCarouselRef}
                  className="trending-carousel hide-scrollbar"
                  dir="ltr"
                  onMouseEnter={pauseTrending}
                  onMouseLeave={resumeTrending}
                  onTouchStart={pauseTrending}
                  onTouchEnd={resumeTrending}
                  onTouchCancel={resumeTrending}
                  onScroll={syncTrendingIndex}
                >
                  {trendingLoopEvents.map((event, index) => (
                    <article
                      className="trending-card snap-item"
                      key={event.id + "-loop-" + index}
                      role="button"
                      tabIndex={index >= trendingEvents.length ? -1 : 0}
                      aria-hidden={index >= trendingEvents.length}
                      aria-label={"عرض تفاصيل " + event.title}
                      onClick={() => onOpenEvent(event.id)}
                      onKeyDown={(keyboardEvent) => {
                        if (
                          keyboardEvent.key === "Enter" ||
                          keyboardEvent.key === " "
                        ) {
                          keyboardEvent.preventDefault();
                          onOpenEvent(event.id);
                        }
                      }}
                    >
                      <div className={"trending-card-media " + event.cover}>
                        {event.coverImageUrl ? (
                          <img
                            src={event.coverImageUrl}
                            alt={index >= trendingEvents.length ? "" : event.title}
                            loading="lazy"
                          />
                        ) : (
                          <span className="trending-placeholder">✦</span>
                        )}
                        <div className="trending-overlay" />
                        <span className="trending-category">{event.category}</span>
                        <span className="trending-price">{event.price}</span>
                        <div className="trending-card-copy">
                          <h3>{event.title}</h3>
                          <div>
                            <CalendarDays size={14} />
                            <span>{event.date} · {event.time}</span>
                          </div>
                          <div>
                            <MapPin size={14} />
                            <span>{event.venue || event.place}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">ما في فعاليات رائجة حالياً.</div>
              )}
            </section>

            <section className="more-events redesigned-more">
              <div className="redesign-section-head">
                <h2>فعاليات أخرى</h2>
                <span>{events.filter((event) => !event.isTrending).length} فعاليات</span>
              </div>
              {events.some((event) => !event.isTrending) ? (
                <div className="event-list">
                  {events
                    .filter((event) => !event.isTrending)
                    .map((event) => (
                      <article
                        className="event-list-card event-card-clickable"
                        key={event.id}
                        role="button"
                        tabIndex={0}
                        aria-label={"عرض تفاصيل " + event.title}
                        onClick={() => onOpenEvent(event.id)}
                        onKeyDown={(keyboardEvent) => {
                          if (
                            keyboardEvent.key === "Enter" ||
                            keyboardEvent.key === " "
                          ) {
                            keyboardEvent.preventDefault();
                            onOpenEvent(event.id);
                          }
                        }}
                      >
                        <div className={"event-list-thumb " + event.cover}>
                          {event.coverImageUrl ? (
                            <img src={event.coverImageUrl} alt={event.title} loading="lazy" />
                          ) : (
                            <span>✦</span>
                          )}
                        </div>
                        <div className="event-list-info">
                          <h3>{event.title}</h3>
                          <div className="event-list-top">
                            <span>{event.category}</span>
                            <strong>{event.price}</strong>
                          </div>
                          <p>
                            <CalendarDays size={13} />
                            {event.date} · {event.time}
                          </p>
                          <p>
                            <MapPin size={13} />
                            {event.venue || event.place}
                          </p>
                        </div>
                      </article>
                    ))}
                </div>
              ) : (
                <div className="empty-state">ما في فعاليات أخرى حالياً.</div>
              )}
            </section>
          </>
        )}
      </div>
    </section>
  );
}
