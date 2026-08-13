export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) return Response.json({ ok: false, configured: false });
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: "no-store" });
    const data = await response.json();
    return Response.json({ ok: response.ok && data?.ok === true, configured: true, bot: data?.result ? { id: data.result.id, username: data.result.username, firstName: data.result.first_name } : null });
  } catch { return Response.json({ ok: false, configured: true }, { status: 502 }); }
}
