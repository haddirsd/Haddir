import type { Metadata } from "next";
import HomeClient from "./HomeClient";

type PageProps = {
  searchParams: Promise<{ event?: string | string[] }>;
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://haddir-ticket.vercel.app";
const defaultImage = "/icons/icon-512.png";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const eventId = Array.isArray(params.event) ? params.event[0] : params.event;
  const metadataBase = new URL(siteUrl);

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
        const response = await fetch(`${supabaseUrl}/rest/v1/events?${query.toString()}`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          next: { revalidate: 60 },
        });
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
          const event = rows[0];
          if (event) {
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
        }
      } catch (error) {
        console.error("Could not generate event social metadata", error);
      }
    }
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
