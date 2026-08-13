export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const chatId = String(body?.chatId || "").trim();
  const text = String(body?.text || "").trim().slice(0, 3900);
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) return Response.json({ ok: false, error: "TELEGRAM_NOT_CONFIGURED" }, { status: 503 });
  if (!chatId || !text) return Response.json({ ok: false, error: "MESSAGE_REQUIRED" }, { status: 400 });
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text }) });
  const data = await response.json().catch(() => null);
  return Response.json({ ok: response.ok, telegram: data }, { status: response.ok ? 200 : 502 });
}
