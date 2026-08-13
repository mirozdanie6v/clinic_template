import { verifyTelegramInitData } from "../../../../lib/telegram";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const initData = typeof body?.initData === "string" ? body.initData.trim() : "";
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) return Response.json({ ok: false, error: "TELEGRAM_NOT_CONFIGURED" }, { status: 503 });
  const identity = verifyTelegramInitData(initData, token);
  if (!identity) return Response.json({ ok: false, error: "INVALID_TELEGRAM_INIT_DATA" }, { status: 401 });
  return Response.json({ ok: true, ...identity });
}
