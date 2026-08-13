import { randomUUID } from "node:crypto";
import { verifyTelegramInitData } from "../../../../lib/telegram";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const input = body?.appointment || {};
  if (!input?.serviceId || !input?.specialistId || !input?.date || !input?.time || !input?.name) return Response.json({ ok: false, error: "INVALID_APPOINTMENT" }, { status: 400 });

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const identity = token && typeof body?.initData === "string" ? verifyTelegramInitData(body.initData, token) : null;
  const appointment = {
    id: randomUUID(),
    serviceId: String(input.serviceId),
    specialistId: String(input.specialistId),
    date: String(input.date),
    time: String(input.time),
    name: identity?.name || String(input.name).trim(),
    phone: typeof input.phone === "string" ? input.phone.trim() : "",
    lang: typeof input.lang === "string" ? input.lang : "ru",
    telegramChatId: identity?.chatId || undefined,
    telegramUsername: identity?.username || undefined,
    source: identity ? "telegram" : "web",
    createdAt: new Date().toISOString(),
  };

  const backend = (process.env.CLINIC_BACKEND_URL || "").replace(/\/$/, "");
  if (backend) {
    try {
      const response = await fetch(`${backend}/booking/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.CLINIC_BACKEND_TOKEN ? { Authorization: `Bearer ${process.env.CLINIC_BACKEND_TOKEN}` } : {}) },
        body: JSON.stringify(appointment),
        cache: "no-store",
      });
      if (!response.ok) return Response.json({ ok: false, error: "BACKEND_BOOKING_FAILED" }, { status: 502 });
      const data = await response.json().catch(() => null);
      return Response.json({ ok: true, appointment: data?.appointment || appointment, mode: "backend" });
    } catch { return Response.json({ ok: false, error: "BACKEND_UNAVAILABLE" }, { status: 502 }); }
  }

  return Response.json({ ok: true, appointment, mode: "prototype" });
}
