import { altegioErrorResponse, altegioRequest, requirePositiveInteger } from "../../../../lib/altegio";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const locationId = requirePositiveInteger(body?.locationId, "locationId");
    const phone = String(body?.phone || "").trim();
    const fullname = String(body?.name || "").trim();
    if (!phone || !fullname) return Response.json({ ok: false, code: "CONTACT_REQUIRED" }, { status: 400 });

    await altegioRequest(`/book_code/${locationId}`, {
      method: "POST",
      body: JSON.stringify({ phone, fulname: fullname }),
    });
    return Response.json({ ok: true, sent: true });
  } catch (error) {
    return altegioErrorResponse(error);
  }
}
