"use client";

import { useEffect, useMemo, useState } from "react";

type Language = "ru" | "en" | "vi";
type Slot = { time: string; datetime: string; seanceLength?: number };
type BookingResult = { id: string; serviceId: string; specialistId: string; date: string; time: string; name: string; phone: string; createdAt?: string };

type Props = {
  language: Language;
  locationId?: string | number;
  locationName: string;
  serviceId?: string | number;
  runtimeServiceId?: string;
  serviceName: string;
  staffId?: string | number;
  runtimeSpecialistId?: string;
  staffName: string;
  publicBookingUrl?: string;
  initialName?: string;
  initialPhone?: string;
  onContactChange?: (contact: { name: string; phone: string }) => void;
  onBooked?: (appointment: BookingResult) => void;
};

const text = {
  ru: { loading: "Проверяем свободное время…", date: "Выберите дату", time: "Выберите время", details: "Ваши данные", name: "Имя", phone: "Телефон", email: "Email — необязательно", code: "Код из SMS", sendCode: "Отправить код", resend: "Отправить ещё раз", confirm: "Подтвердить запись", booked: "Запись создана", bookedNote: "Время подтверждено в системе EVO.", emptyDates: "Свободных дат пока нет.", emptyTimes: "На эту дату свободного времени нет.", fallback: "Встроенная запись временно недоступна. Можно продолжить в официальной форме EVO.", openFallback: "Открыть официальную запись", retry: "Повторить", error: "Не удалось получить данные Altegio." },
  en: { loading: "Checking live availability…", date: "Choose a date", time: "Choose a time", details: "Your details", name: "Name", phone: "Phone", email: "Email — optional", code: "SMS code", sendCode: "Send code", resend: "Send again", confirm: "Confirm booking", booked: "Booking confirmed", bookedNote: "The time is confirmed in EVO's system.", emptyDates: "No available dates right now.", emptyTimes: "No available times on this date.", fallback: "Embedded booking is temporarily unavailable. You can continue in EVO's official booking form.", openFallback: "Open official booking", retry: "Retry", error: "Could not load Altegio data." },
  vi: { loading: "Đang kiểm tra lịch trống…", date: "Chọn ngày", time: "Chọn giờ", details: "Thông tin của bạn", name: "Họ tên", phone: "Điện thoại", email: "Email — không bắt buộc", code: "Mã SMS", sendCode: "Gửi mã", resend: "Gửi lại", confirm: "Xác nhận đặt lịch", booked: "Đã đặt lịch", bookedNote: "Thời gian đã được xác nhận trong hệ thống EVO.", emptyDates: "Hiện chưa có ngày trống.", emptyTimes: "Ngày này hiện không còn giờ trống.", fallback: "Đặt lịch tích hợp tạm thời không khả dụng. Bạn có thể tiếp tục trong biểu mẫu chính thức của EVO.", openFallback: "Mở đặt lịch chính thức", retry: "Thử lại", error: "Không thể tải dữ liệu Altegio." },
} as const;

function numeric(value: string | number | undefined) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

export default function AltegioLiveBooking(props: Props) {
  const t = text[props.language];
  const locationId = numeric(props.locationId);
  const serviceId = numeric(props.serviceId);
  const staffId = numeric(props.staffId);
  const [mode, setMode] = useState<"loading" | "live" | "fallback">("loading");
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [phoneConfirmation, setPhoneConfirmation] = useState(false);
  const [contact, setContact] = useState({ name: props.initialName || "", phone: props.initialPhone || "", email: "" });
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<BookingResult | null>(null);

  const query = useMemo(() => new URLSearchParams({ locationId: String(locationId), serviceId: String(serviceId), staffId: String(staffId) }), [locationId, serviceId, staffId]);

  async function loadDates() {
    if (!locationId || !serviceId || !staffId) { setMode("fallback"); return; }
    setMode("loading");
    setError("");
    try {
      const response = await fetch(`/api/altegio/availability?${query.toString()}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.configured) { setMode("fallback"); return; }
      setDates(Array.isArray(data.dates) ? data.dates : []);
      setPhoneConfirmation(Boolean(data.phoneConfirmation));
      setMode("live");
    } catch { setMode("fallback"); }
  }

  useEffect(() => {
    setSelectedDate("");
    setSlots([]);
    setSelectedSlot(null);
    setCode("");
    setCodeSent(false);
    setBooked(null);
    loadDates();
  }, [locationId, serviceId, staffId]);

  async function chooseDate(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlots([]);
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(query);
      params.set("date", date);
      const response = await fetch(`/api/altegio/availability?${params.toString()}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.code || "AVAILABILITY_FAILED");
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch { setError(t.error); }
    finally { setLoading(false); }
  }

  function updateContact(field: "name" | "phone" | "email", value: string) {
    setContact((current) => {
      const next = { ...current, [field]: value };
      props.onContactChange?.({ name: next.name, phone: next.phone });
      return next;
    });
    if (field === "phone") { setCodeSent(false); setCode(""); }
  }

  async function sendCode() {
    if (!contact.name.trim() || !contact.phone.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/altegio/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, serviceId, staffId, name: contact.name.trim(), phone: contact.phone.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.code || "CODE_FAILED");
      setCodeSent(true);
    } catch { setError(t.error); }
    finally { setLoading(false); }
  }

  async function createBooking() {
    if (!selectedSlot || !contact.name.trim() || !contact.phone.trim()) return;
    if (phoneConfirmation && !codeSent) { await sendCode(); return; }
    if (phoneConfirmation && !code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/altegio/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          serviceId,
          staffId,
          runtimeServiceId: props.runtimeServiceId,
          runtimeSpecialistId: props.runtimeSpecialistId,
          datetime: selectedSlot.datetime,
          name: contact.name.trim(),
          phone: contact.phone.trim(),
          email: contact.email.trim(),
          code: code.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 428 && data?.code === "PHONE_CONFIRMATION_REQUIRED") {
        setPhoneConfirmation(true);
        if (!codeSent) await sendCode();
        return;
      }
      if (!response.ok || !data?.appointment?.id) throw new Error(data?.code || "BOOKING_FAILED");
      const appointment = data.appointment as BookingResult;
      setBooked(appointment);
      props.onBooked?.(appointment);
    } catch { setError(t.error); }
    finally { setLoading(false); }
  }

  if (mode === "loading") return <div className="live-booking-card"><span className="live-badge">ALTEGIO · LIVE</span><p>{t.loading}</p></div>;
  if (mode === "fallback") return <div className="live-booking-card"><span className="live-badge">ALTEGIO</span><h3>{props.serviceName}</h3><p>{props.staffName} · {props.locationName}</p><p>{t.fallback}</p><div className="booking-actions"><button className="secondary-button" onClick={loadDates}>{t.retry}</button>{props.publicBookingUrl && <button className="primary-button" onClick={() => window.open(props.publicBookingUrl, "_blank", "noopener,noreferrer")}>{t.openFallback} ↗</button>}</div></div>;
  if (booked) return <div className="success-state"><div className="success-icon">✓</div><h2>{t.booked}</h2><p>{t.bookedNote}</p><div className="review-card"><div className="review-row"><small>{props.locationName}</small><b>{props.serviceName}</b></div><div className="review-row"><small>{props.staffName}</small><b>{booked.date} · {booked.time}</b></div></div></div>;

  return <div className="live-booking-card">
    <span className="live-badge">ALTEGIO · LIVE</span>
    <h3>{props.serviceName}</h3>
    <p>{props.staffName} · {props.locationName}</p>

    <div className="step-label"><h2>{t.date}</h2></div>
    {dates.length ? <div className="date-grid">{dates.slice(0, 28).map((date) => { const value = new Date(`${date}T12:00:00`); const locale = props.language === "vi" ? "vi-VN" : props.language === "en" ? "en-US" : "ru-RU"; return <button key={date} className={selectedDate === date ? "selected" : ""} onClick={() => chooseDate(date)}><small>{value.toLocaleDateString(locale, { weekday: "short" })}</small><b>{value.getDate()}</b></button>; })}</div> : <p className="privacy-note">{t.emptyDates}</p>}

    {selectedDate && <><div className="step-label"><h2>{t.time}</h2></div>{loading && !slots.length ? <p>{t.loading}</p> : slots.length ? <div className="time-grid">{slots.map((slot) => <button key={slot.datetime} className={selectedSlot?.datetime === slot.datetime ? "selected" : ""} onClick={() => setSelectedSlot(slot)}>{slot.time}</button>)}</div> : <p className="privacy-note">{t.emptyTimes}</p>}</>}

    {selectedSlot && <div className="contact-form">
      <div className="step-label"><h2>{t.details}</h2></div>
      <label>{t.name}<input autoComplete="name" value={contact.name} onChange={(event) => updateContact("name", event.target.value)} /></label>
      <label>{t.phone}<input type="tel" inputMode="tel" autoComplete="tel" value={contact.phone} onChange={(event) => updateContact("phone", event.target.value)} placeholder="+84" /></label>
      <label>{t.email}<input type="email" autoComplete="email" value={contact.email} onChange={(event) => updateContact("email", event.target.value)} /></label>
      {phoneConfirmation && codeSent && <label>{t.code}<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} /></label>}
      {phoneConfirmation && <button className="secondary-button" disabled={loading || !contact.name.trim() || !contact.phone.trim()} onClick={sendCode}>{codeSent ? t.resend : t.sendCode}</button>}
      {error && <div className="privacy-note">{error}</div>}
      <button className="primary-button" disabled={loading || !contact.name.trim() || !contact.phone.trim() || (phoneConfirmation && (!codeSent || !code.trim()))} onClick={createBooking}>{t.confirm}</button>
    </div>}
  </div>;
}
