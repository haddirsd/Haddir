import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "./PwaRegistration";
import { PushDiagnostics } from "./PushDiagnostics";
import "./globals.css";
import "../components/layout/responsive-nav.css";
import "./desktop.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#5B2EFF",
};

export const metadata: Metadata = {
  title: "حاضر | فعاليات السودان في مكان واحد",
  description: "اكتشف الفعاليات القادمة واحجز تذكرتك بسهولة مع حاضر.",
  appleWebApp: {
    capable: true,
    title: "حاضر",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192-brand.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icons/icon-512-brand.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{var saved=localStorage.getItem('haddir-theme');var dark=saved?saved==='dark':!!window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.classList.toggle('theme-dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light';var meta=document.querySelector('meta[name=\\\"theme-color\\\"]');if(meta)meta.setAttribute('content','#5B2EFF');}catch(_){document.documentElement.dataset.theme='light';document.documentElement.classList.remove('theme-dark');document.documentElement.style.colorScheme='light';}})();",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){window.addEventListener('beforeinstallprompt',function(event){event.preventDefault();window.__haddirInstallPrompt=event;window.dispatchEvent(new Event('haddir:beforeinstallprompt'));});window.addEventListener('appinstalled',function(){window.__haddirInstallPrompt=null;});})();",
          }}
        />
      </head>
      <body>
        <PwaRegistration />
        <PushDiagnostics />
        {children}
      </body>
    </html>
  );
}
