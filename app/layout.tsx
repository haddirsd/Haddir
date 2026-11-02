import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "حاضر | فعاليات السودان في مكان واحد", description: "اكتشف الفعاليات القادمة واحجز تذكرتك بسهولة مع حاضر." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ar" dir="rtl"><body>{children}</body></html>; }
