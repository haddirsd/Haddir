import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "./PwaRegistration";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F6F4FF",
};

export const metadata: Metadata = {
  title: "حاضر | فعاليات السودان في مكان واحد",
  description: "اكتشف الفعاليات القادمة واحجز تذكرتك بسهولة مع حاضر.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "حاضر",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{var saved=localStorage.getItem('haddir-theme');var dark=saved?saved==='dark':!!window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';var meta=document.querySelector('meta[name=\"theme-color\"]');if(meta)meta.setAttribute('content',dark?'#1D135D':'#F6F4FF');}catch(_){document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light';}})();",
          }}
        />
      </head>
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
