"use client";

import type { CustomerTicket } from "../types";

export async function downloadTicketAsImage(
  ticket: CustomerTicket,
  formatEventDate: (value: string) => string,
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  await document.fonts.ready;
  ctx.fillStyle = "#eef6f9";
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = "#fff";
  ctx.fillRect(48, 48, 984, 1254);
  ctx.strokeStyle = "#d8ecf3";
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, 984, 1254);
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  const right = 950;

  const brandImg = new Image();
  const brandLoaded = new Promise<void>((resolve, reject) => {
    brandImg.onload = () => resolve();
    brandImg.onerror = () => reject(new Error("Haddir logo failed"));
  });
  brandImg.src = "/ticket.svg";
  await brandLoaded;
  ctx.drawImage(brandImg, 790, 70, 160, 80);

  ctx.fillStyle = "#52707a";
  ctx.font = "26px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText("تذكرة دخول إلكترونية", right, 190);
  ctx.strokeStyle = "#b9d9e2";
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.moveTo(100, 230);
  ctx.lineTo(980, 230);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#52707a";
  ctx.font = "26px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText("الفعالية", right, 300);
  ctx.fillStyle = "#082028";
  ctx.font = "bold 44px 'IBM Plex Sans Arabic',Arial";
  const eventTitle = String(ticket.events?.title || "فعالية");
  ctx.fillText(eventTitle.length > 32 ? eventTitle.slice(0, 32) + "…" : eventTitle, right, 365);

  ctx.fillStyle = "#52707a";
  ctx.font = "24px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText("نوع التذكرة", right, 455);
  ctx.fillText("رقم الحجز", 520, 455);
  ctx.fillStyle = "#082028";
  ctx.font = "bold 27px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText(String(ticket.ticket_types?.name || "تذكرة"), right, 500);
  ctx.fillText(String(ticket.bookings?.booking_number || "—"), 520, 500);

  ctx.fillStyle = "#52707a";
  ctx.font = "24px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText("الموقع", right, 575);
  ctx.fillText("التاريخ", 520, 575);
  ctx.fillStyle = "#082028";
  ctx.font = "bold 25px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText(String(ticket.events?.venue || "—"), right, 620);
  ctx.fillText(
    ticket.events?.is_continuous
      ? "مستمر"
      : ticket.events?.starts_at
        ? formatEventDate(ticket.events.starts_at)
        : "—",
    520,
    620,
  );

  ctx.strokeStyle = "#d8ecf3";
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.moveTo(100, 675);
  ctx.lineTo(980, 675);
  ctx.stroke();
  ctx.setLineDash([]);

  const qr = document.querySelector(
    '[data-ticket-id="' + String(ticket.id) + '"] .haddir-ticket-qr svg',
  );
  if (!qr) throw new Error("QR unavailable");
  const svg = new XMLSerializer().serializeToString(qr);
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("QR image failed"));
  });
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await loaded;
  ctx.drawImage(img, 360, 700, 360, 360);

  ctx.fillStyle = "#52707a";
  ctx.font = "23px 'IBM Plex Sans Arabic',Arial";
  ctx.textAlign = "center";
  ctx.fillText("امسح الرمز للتحقق من التذكرة", 540, 1100);
  ctx.fillStyle = "#075985";
  ctx.font = "bold 48px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText(String(ticket.ticket_code || ""), 540, 1170);
  ctx.fillStyle = "#d8ecf3";
  ctx.fillRect(48, 1200, 984, 102);
  ctx.fillStyle = "#075985";
  ctx.font = "bold 23px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText("احتفظ بالتذكرة وأبرزها عند الدخول", 540, 1262);

  const link = document.createElement("a");
  link.download = "haddir-ticket-" + String(ticket.ticket_code || ticket.id) + ".png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
