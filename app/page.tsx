import type { Metadata } from "next";
import HomeClient from "./HomeClient";

type PageProps = {
  searchParams: Promise<{ event?: string | string[] }>;
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://haddir-ticket.vercel.app";
const defaultImage = "/icons/icon-512.png";

function logSocialMetadataMetrics(metrics: {
  result: string;
  startedAt: number;
  queryMs: number | null;
  requestCount: number;
  httpStatus?: number;
}) {
  console.info(JSON.stringify({
    event: "performance.social_metadata",
    result: metrics.result,
    duration_ms: Number((performance.now() - metrics.startedAt).toFixed(1)),
    data_query_ms: metrics.queryMs,
    rest_request_count: metrics.requestCount,
    ...(metrics.httpStatus ? { http_status: metrics.httpStatus } : {}),
  }));
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const metadataStartedAt = performance.now();
  const params = await searchParams;
  const eventId = Array.isArray(params.event) ? params.event[0] : params.event;
  const metadataBase = new URL(siteUrl);
  let dataQueryMs: number | null = null;
  let restRequestCount = 0;
  let metricResult = "default_metadata";
  let restHttpStatus: number | undefined;
  let queryStartedAt: number | null = null;

  if (eventId) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const query = new URLSearchParams({
          select: "id,title,description,cover_image_url,starts_at,city,venue,status",
          id: `eq.${eventId}`,
          status: "eq.published",
          limit: "1",
        });
        queryStartedAt = performance.now();
        restRequestCount += 1;
        const response = await fetch(`${supabaseUrl}/rest/v1/events?${query.toString()}`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          next: { revalidate: 60 },
        });
        restHttpStatus = response.status;
        if (response.ok) {
          const rows = (await response.json()) as Array<{
            id: string;
            title: string;
            description: string | null;
            cover_image_url: string | null;
            starts_at: string | null;
            city: string | null;
            venue: string | null;
          }>;
          dataQueryMs = Number((performance.now() - queryStartedAt).toFixed(1));
          const event = rows[0];
          if (event) {
            metricResult = "event_found";
            const title = `${event.title} | حاضر`;
            const description = [
              event.description?.trim(),
              event.venue || event.city,
              event.starts_at
                ? new Intl.DateTimeFormat("ar-SD", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.starts_at))
                : "",
            ].filter(Boolean).join(" · ").slice(0, 300) || "اكتشف الفعالية واحجز تذكرتك عبر حاضر.";
            const image = event.cover_image_url || defaultImage;
            const url = new URL(`/?event=${encodeURIComponent(event.id)}`, metadataBase);

            logSocialMetadataMetrics({
              result: metricResult,
              startedAt: metadataStartedAt,
              queryMs: dataQueryMs,
              requestCount: restRequestCount,
            });
            return {
              metadataBase,
              title,
              description,
              alternates: { canonical: url },
              openGraph: {
                type: "website",
                locale: "ar_SD",
                siteName: "حاضر | Haddir",
                title,
                description,
                url,
                images: [{ url: image, width: 1200, height: 630, alt: event.title }],
              },
              twitter: {
                card: "summary_large_image",
                title,
                description,
                images: [image],
              },
            };
          }
          metricResult = "event_not_found";
        } else {
          dataQueryMs = Number((performance.now() - queryStartedAt).toFixed(1));
          metricResult = "rest_request_failed";

          let restError: {
            code?: string;
            message?: string;
            hint?: string;
          } = {};
          try {
            const errorBody = await response.clone().json() as {
              code?: unknown;
              message?: unknown;
              hint?: unknown;
            };
            if (typeof errorBody.code === "string") {
              restError.code = errorBody.code.slice(0, 80);
            }
            if (typeof errorBody.message === "string") {
              restError.message = errorBody.message.slice(0, 240);
            }
            if (typeof errorBody.hint === "string") {
              restError.hint = errorBody.hint.slice(0, 240);
            }
          } catch {
            // Keep the diagnostic log safe when Supabase returns a non-JSON error.
          }

          console.warn(JSON.stringify({
            event: "performance.social_metadata_error",
            http_status: response.status,
            ...(restError.code ? { error_code: restError.code } : {}),
            ...(restError.message ? { error_message: restError.message } : {}),
            ...(restError.hint ? { error_hint: restError.hint } : {}),
          }));
        }
      } catch {
        if (queryStartedAt !== null && dataQueryMs === null) {
          dataQueryMs = Number((performance.now() - queryStartedAt).toFixed(1));
        }
        metricResult = "metadata_fetch_error";
      }
    } else {
      metricResult = "supabase_configuration_missing";
    }
    logSocialMetadataMetrics({
      result: metricResult,
      startedAt: metadataStartedAt,
      queryMs: dataQueryMs,
      requestCount: restRequestCount,
      httpStatus: restHttpStatus,
    });
  }

  const title = "حاضر | فعاليات السودان في مكان واحد";
  const description = "اكتشف الفعاليات القادمة واحجز تذكرتك بسهولة مع حاضر.";
  return {
    metadataBase,
    title,
    description,
    openGraph: {
      type: "website",
      locale: "ar_SD",
      siteName: "حاضر | Haddir",
      title,
      description,
      url: metadataBase,
      images: [{ url: defaultImage, width: 512, height: 512, alt: "حاضر | Haddir" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [defaultImage],
    },
  };
}

export default function Page() {
  return <HomeClient />;
}
