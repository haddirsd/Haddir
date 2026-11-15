"use client";

import type { CustomerTicket } from "../types";

export async function downloadTicketAsImage(
  ticket: CustomerTicket,
  formatEventDate: (value: string) => string,
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1280;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  await document.fonts.ready;
  ctx.fillStyle = "#eef6f9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(48, 40, 984, 1200);
  ctx.strokeStyle = "#d8ecf3";
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 40, 984, 1200);

  const brandImg = new Image();
  const brandLoaded = new Promise<void>((resolve, reject) => {
    brandImg.onload = () => resolve();
    brandImg.onerror = () => reject(new Error("Haddir logo failed"));
  });
  brandImg.src = "/ticket.svg";
  await brandLoaded;
  ctx.drawImage(brandImg, 790, 58, 160, 76);

  ctx.direction = "rtl";
  ctx.textAlign = "right";
  const right = 950;
  ctx.fillStyle = "#52707a";
  ctx.font = "26px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText("تذكرة دخول إلكترونية", right, 168);
  ctx.strokeStyle = "#b9d9e2";
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.moveTo(100, 198);
  ctx.lineTo(980, 198);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#52707a";
  ctx.font = "24px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText("الفعالية", right, 250);
  ctx.fillStyle = "#082028";
  ctx.font = "bold 42px 'IBM Plex Sans Arabic',Arial";
  const eventTitle = String(ticket.events?.title || "فعالية");
  ctx.fillText(eventTitle.length > 38 ? eventTitle.slice(0, 38) + "…" : eventTitle, right, 310);

  const drawMeta = (label: string, value: string, x: number, y: number, width: number) => {
    ctx.textAlign = "right";
    ctx.direction = "rtl";
    ctx.fillStyle = "#71858b";
    ctx.font = "22px 'IBM Plex Sans Arabic',Arial";
    ctx.fillText(label, x, y);
    ctx.fillStyle = "#15343c";
    ctx.font = "bold 25px 'IBM Plex Sans Arabic',Arial";
    const safeValue = value.length > 27 ? value.slice(0, 27) + "…" : value;
    ctx.fillText(safeValue, x, y + 39, width);
  };

  drawMeta("نوع التذكرة", String(ticket.ticket_types?.name || "تذكرة"), 950, 390, 380);
  drawMeta("رقم الحجز", String(ticket.bookings?.booking_number || "—"), 500, 390, 360);
  drawMeta("الموقع", String(ticket.events?.venue || "—"), 950, 490, 380);
  drawMeta(
    "التاريخ",
    ticket.events?.is_continuous
      ? "مستمر"
      : ticket.events?.starts_at
        ? formatEventDate(ticket.events.starts_at)
        : "—",
    500,
    490,
    360,
  );
  drawMeta("عدد الأشخاص", String(ticket.booking_items?.quantity || 1) + " أشخاص", 950, 590, 380);

  ctx.strokeStyle = "#d8ecf3";
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.moveTo(100, 650);
  ctx.lineTo(980, 650);
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
  ctx.drawImage(img, 380, 675, 320, 320);

  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillStyle = "#71858b";
  ctx.font = "22px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText("امسح الرمز للتحقق من التذكرة", 540, 1025);
  ctx.fillStyle = "#075985";
  ctx.font = "bold 46px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText(String(ticket.ticket_code || ""), 540, 1090);
  ctx.fillStyle = "#f1f8fa";
  ctx.fillRect(48, 1120, 984, 120);
  ctx.fillStyle = "#276d7b";
  ctx.font = "bold 23px 'IBM Plex Sans Arabic',Arial";
  ctx.fillText("احتفظ بالتذكرة وأبرزها عند الدخول", 540, 1188);

  const link = document.createElement("a");
  link.download = "haddir-ticket-" + String(ticket.ticket_code || ticket.id) + ".png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
