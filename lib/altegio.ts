const ALTEGIO_API_BASE = "https://api.alteg.io/api/v1";
const ACCEPT = "application/vnd.api.v2+json";

export class AltegioApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(message: string, status = 502, code = "ALTEGIO_API_ERROR", details: unknown = null) {
    super(message);
    this.name = "AltegioApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function altegioConfigured() {
  return Boolean(process.env.ALTEGIO_PARTNER_TOKEN?.trim());
}

export function requirePositiveInteger(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new AltegioApiError(`${label} must be a positive integer`, 400, "INVALID_PARAMETER");
  return number;
}

export async function altegioRequest(path: string, init: RequestInit = {}) {
  const token = process.env.ALTEGIO_PARTNER_TOKEN?.trim();
  if (!token) throw new AltegioApiError("Altegio partner token is not configured", 503, "ALTEGIO_NOT_CONFIGURED");
  if (!path.startsWith("/")) throw new AltegioApiError("Invalid Altegio API path", 500, "INVALID_API_PATH");

  const response = await fetch(`${ALTEGIO_API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: ACCEPT,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }

  if (!response.ok || payload?.success === false) {
    const message = payload?.meta?.message || payload?.message || `Altegio API returned ${response.status}`;
    throw new AltegioApiError(message, response.status || 502, "ALTEGIO_UPSTREAM_ERROR", payload);
  }
  return payload;
}

export function altegioErrorResponse(error: unknown) {
  if (error instanceof AltegioApiError) {
    return Response.json({ ok: false, code: error.code, error: error.message, details: error.details }, { status: error.status });
  }
  return Response.json({ ok: false, code: "ALTEGIO_INTERNAL_ERROR", error: "Altegio integration failed" }, { status: 500 });
}
