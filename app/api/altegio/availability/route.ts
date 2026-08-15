import { altegioConfigured, altegioErrorResponse, altegioRequest, requirePositiveInteger } from "../../../../lib/altegio";

function queryId(params: URLSearchParams, name: string) {
  return requirePositiveInteger(params.get(name), name);
}

export async function GET(request: Request) {
  try {
    if (!altegioConfigured()) return Response.json({ ok: false, configured: false, code: "ALTEGIO_NOT_CONFIGURED" }, { status: 503 });
    const url = new URL(request.url);
    const locationId = queryId(url.searchParams, "locationId");
    const serviceId = queryId(url.searchParams, "serviceId");
    const staffId = queryId(url.searchParams, "staffId");
    const date = url.searchParams.get("date")?.trim() || "";

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ ok: false, code: "INVALID_DATE" }, { status: 400 });
      const params = new URLSearchParams();
      params.append("service_ids[]", String(serviceId));
      const result = await altegioRequest(`/book_times/${locationId}/${staffId}/${date}?${params.toString()}`);
      const slots = Array.isArray(result?.data) ? result.data.map((item: any) => ({
        time: String(item?.time || ""),
        datetime: String(item?.datetime || ""),
        seanceLength: Number(item?.seance_length || item?.session_length || 0),
      })).filter((item: any) => item.time && item.datetime) : [];
      return Response.json({ ok: true, configured: true, mode: "live", date, slots });
    }

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 60);
    const iso = (value: Date) => value.toISOString().slice(0, 10);
    const params = new URLSearchParams();
    params.append("service_ids[]", String(serviceId));
    params.set("staff_id", String(staffId));
    params.set("date_from", iso(now));
    params.set("date_to", iso(end));

    const [datesResult, companyResult] = await Promise.all([
      altegioRequest(`/book_dates/${locationId}?${params.toString()}`),
      altegioRequest(`/company/${locationId}?forBooking=1`).catch(() => null),
    ]);
    const dates = Array.isArray(datesResult?.data?.booking_dates) ? datesResult.data.booking_dates.map(String) : [];
    return Response.json({
      ok: true,
      configured: true,
      mode: "live",
      dates,
      phoneConfirmation: Boolean(companyResult?.data?.phone_confirmation),
      timezone: companyResult?.data?.timezone_name || null,
    });
  } catch (error) {
    return altegioErrorResponse(error);
  }
}
