import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramIdentity = {
  chatId: string;
  userId: string;
  username: string | null;
  name: string | null;
  languageCode: string | null;
};

export function verifyTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 86400): TelegramIdentity | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") || "";
  if (!/^[a-f0-9]{64}$/i.test(receivedHash)) return null;
  params.delete("hash");
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > maxAgeSeconds) return null;
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const received = Buffer.from(receivedHash, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const user = JSON.parse(params.get("user") || "{}");
    if (!user?.id) return null;
    return {
      chatId: String(user.id),
      userId: String(user.id),
      username: typeof user.username === "string" ? user.username : null,
      name: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
      languageCode: typeof user.language_code === "string" ? user.language_code : null,
    };
  } catch { return null; }
}
