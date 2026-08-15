import { altegioErrorResponse, altegioRequest, requirePositiveInteger } from "../../../../lib/altegio";
import { validateBookingSelection } from "../../../../lib/clinic-booking";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const locationId = requirePositiveInteger(body?.locationId, "locationId");
    const serviceId = requirePositiveInteger(body?.serviceId, "serviceId");
    const staffId = requirePositiveInteger(body?.staffId, "staffId");
    if (!validateBookingSelection(locationId, serviceId, staffId)) return Response.json({ ok: false, code: "BOOKING_SELECTION_NOT_ALLOWED" }, { status: 400 });

    const datetime = String(body?.datetime || "").trim();
    const name = String(body?.name || "").trim();
    const phone = String(body?.phone || "").trim();
    const email = String(body?.email || "").trim();
    const code = String(body?.code || "").trim();
    if (!datetime || !name || !phone) return Response.json({ ok: false, code: "BOOKING_DETAILS_REQUIRED" }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}T/.test(datetime)) return Response.json({ ok: false, code: "INVALID_DATETIME" }, { status: 400 });

    const appointment = { id: 1, services: [serviceId], staff_id: staffId, datetime };
    await altegioRequest(`/book_check/${locationId}`, { method: "POST", body: JSON.stringify({ appointments: [appointment] }) });

    const company = await altegioRequest(`/company/${locationId}?forBooking=1`).catch(() => null);
    const phoneConfirmation = Boolean(company?.data?.phone_confirmation);
    if (phoneConfirmation && !code) {
      return Response.json({ ok: false, code: "PHONE_CONFIRMATION_REQUIRED", phoneConfirmation: true }, { status: 428 });
    }

    const payload: Record<string, unknown> = {
      phone,
      fullname: name,
      appointments: [appointment],
      type: "mobile",
      notify_by_sms: 0,
      notify_by_email: 0,
      comment: "EVO Mini App",
    };
    if (email) payload.email = email;
    if (code) payload.code = code;

    const result = await altegioRequest(`/book_record/${locationId}`, { method: "POST", body: JSON.stringify(payload) });
    const record = Array.isArray(result?.data) ? result.data[0] : null;
    if (!record?.record_id) return Response.json({ ok: false, code: "ALTEGIO_RECORD_MISSING" }, { status: 502 });

    return Response.json({
      ok: true,
      mode: "altegio",
      appointment: {
        id: String(record.record_id),
        recordId: record.record_id,
        recordHash: record.record_hash || null,
        serviceId: String(body?.runtimeServiceId || serviceId),
        specialistId: String(body?.runtimeSpecialistId || staffId),
        date: datetime.slice(0, 10),
        time: datetime.slice(11, 16),
        datetime,
        name,
        phone,
        createdAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    return altegioErrorResponse(error);
  }
}
