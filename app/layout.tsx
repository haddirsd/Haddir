import type { Metadata } from "next";
import { PwaRegistration } from "./PwaRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "حاضر | فعاليات السودان في مكان واحد",
  description: "اكتشف الفعاليات القادمة واحجز تذكرتك بسهولة مع حاضر.",
  manifest: "/manifest.webmanifest",
  themeColor: "#2c8da0",
  appleWebApp: {
    capable: true,
    title: "حاضر",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml", sizes: "any" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/Haddir_App_Icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{var saved=localStorage.getItem('haddir-theme');var dark=saved?saved==='dark':!!window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';var meta=document.querySelector('meta[name=\"theme-color\"]');if(meta)meta.setAttribute('content',dark?'#030b0e':'#2c8da0');}catch(_){document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light';}})();",
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
