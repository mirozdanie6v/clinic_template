"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { asset, clinicDefaults, services, specialists, translations } from "../app-data.js";

type Language = "ru" | "en" | "vi";
type Screen = "home" | "services" | "booking" | "ai" | "profile" | "specialists" | "admin";
type Localized = Record<Language, string>;
type ServiceItem = { id: string; name: Localized; price: Localized; desc: Localized; image: string; staffIds?: string[]; locationId?: string; externalId?: string | number };
type ServiceGroup = { id: string; title: Localized; note: Localized; image: string; items: ServiceItem[] };
type Specialist = { id: string; name: Localized; role: Localized; image: string; tags: string[]; serviceGroups: string[]; serviceIds?: string[]; locationId?: string; externalId?: string | number; bookable?: boolean };
type ClientLocation = { id: string; externalId?: string | number; name: string; publicName?: string; address?: string; phone?: string; hours?: string; lat?: number; lon?: number; primary?: boolean; bookingAvailable?: boolean; mapUrl?: string };
type ClientRuntime = { locations?: ClientLocation[]; integrations?: { booking?: { provider?: string; enabled?: boolean; bookingFormId?: string | number; publicUrl?: string } } };
type Appointment = { id: string; serviceId: string; specialistId: string; date: string; time: string; name: string; phone: string; telegramChatId?: string; createdAt?: string };
type TelegramSession = { chatId: string; userId: string; username?: string | null; name?: string | null };
type ChatMessage = { role: "user" | "assistant"; content: string; recommendedServiceId?: string | null };

const nav: Array<{ id: Exclude<Screen, "specialists" | "admin">; icon: string }> = [
  { id: "home", icon: "⌂" },
  { id: "services", icon: "☷" },
  { id: "booking", icon: "＋" },
  { id: "ai", icon: "✦" },
  { id: "profile", icon: "○" },
];

const copy = {
  ru: { location: "Филиал", live: "Реальное расписание", liveNote: "Вы выбрали филиал, услугу и специалиста. Доступные даты и время откроются в официальной онлайн-записи EVO.", openLive: "Открыть свободное время", noStaff: "Для этой услуги специалист сейчас не назначен в онлайн-записи. Уточните возможность у администратора.", writeAdmin: "Написать администратору", noServices: "В этом филиале пока нет услуг для отображения.", branchFirst: "Выберите филиал EVO", exact: "Показываем только специалистов, которые выполняют выбранную услугу." },
  en: { location: "Location", live: "Live availability", liveNote: "Your location, service and specialist are selected. Available dates and times will open in EVO's official booking flow.", openLive: "Open available times", noStaff: "No specialist is currently assigned to this service in online booking. Please ask the administrator.", writeAdmin: "Message administrator", noServices: "No services are available for this location yet.", branchFirst: "Choose an EVO location", exact: "Only specialists assigned to the selected service are shown." },
  vi: { location: "Chi nhánh", live: "Lịch trống thực tế", liveNote: "Bạn đã chọn chi nhánh, dịch vụ và chuyên gia. Ngày và giờ còn trống sẽ mở trong hệ thống đặt lịch chính thức của EVO.", openLive: "Xem giờ còn trống", noStaff: "Hiện chưa có chuyên gia được gán cho dịch vụ này trong hệ thống đặt lịch. Vui lòng liên hệ quản trị viên.", writeAdmin: "Nhắn quản trị viên", noServices: "Chi nhánh này hiện chưa có dịch vụ để hiển thị.", branchFirst: "Chọn chi nhánh EVO", exact: "Chỉ hiển thị chuyên gia thực hiện đúng dịch vụ đã chọn." },
} as const;

function mapUrl(location?: ClientLocation) {
  if (!location) return clinicDefaults.contacts?.mapUrl || "#";
  if (location.mapUrl) return location.mapUrl;
  if (location.lat != null && location.lon != null) return `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lon}`;
  return location.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}` : "#";
}

function telegramUrl() {
  const raw = String(clinicDefaults.contacts?.telegram || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//.test(raw)) return raw;
  return `https://t.me/${raw.replace(/^@/, "")}`;
}

export default function ProductionMiniApp() {
  const [lang, setLang] = useState<Language>("ru");
  const [screen, setScreen] = useState<Screen>("home");
  const [runtime, setRuntime] = useState<ClientRuntime | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [openGroup, setOpenGroup] = useState("");
  const [detail, setDetail] = useState<ServiceItem | null>(null);
  const [bookingStep, setBookingStep] = useState(0);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [contact, setContact] = useState({ name: "", phone: "" });
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [telegram, setTelegram] = useState<TelegramSession | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const t = translations[lang];
  const c = copy[lang];
  const serviceGroups = services as ServiceGroup[];
  const people = specialists as Specialist[];
  const allItems = useMemo(() => serviceGroups.flatMap((group) => group.items), [serviceGroups]);

  const fallbackLocation: ClientLocation = {
    id: "default",
    name: clinicDefaults.shortName,
    publicName: clinicDefaults.city,
    address: clinicDefaults.contacts?.address,
    phone: clinicDefaults.contacts?.phone,
    hours: clinicDefaults.hours,
    primary: true,
    mapUrl: clinicDefaults.contacts?.mapUrl,
  };
  const locations = runtime?.locations?.length ? runtime.locations : [fallbackLocation];
  const currentLocation = locations.find((item) => item.id === selectedLocationId) || locations.find((item) => item.primary) || locations[0];
  const groupsForLocation = useMemo(() => {
    if (!selectedLocationId || selectedLocationId === "default") return serviceGroups;
    return serviceGroups.filter((group) => group.items.some((item) => item.locationId === selectedLocationId));
  }, [selectedLocationId, serviceGroups]);
  const specialistsForLocation = useMemo(() => {
    if (!selectedLocationId || selectedLocationId === "default") return people;
    return people.filter((person) => person.locationId === selectedLocationId);
  }, [selectedLocationId, people]);
  const featured = groupsForLocation.flatMap((group) => group.items).slice(0, 3);
  const availableSpecialists = selectedService
    ? specialistsForLocation.filter((person) => (selectedService.staffIds || []).includes(person.id))
    : specialistsForLocation;
  const availableGroups = selectedSpecialist
    ? groupsForLocation.map((group) => ({ ...group, items: group.items.filter((item) => (selectedSpecialist.serviceIds || []).includes(item.id)) })).filter((group) => group.items.length)
    : groupsForLocation;
  const externalBooking = runtime?.integrations?.booking?.provider === "altegio" && runtime.integrations.booking.enabled !== false;
  const externalBookingUrl = useMemo(() => {
    const base = runtime?.integrations?.booking?.publicUrl || "";
    if (!base || !currentLocation?.externalId) return base;
    return base.replace(/\/company\/\d+\//, `/company/${currentLocation.externalId}/`);
  }, [runtime, currentLocation]);
  const totalBookingSteps = externalBooking ? 3 : 5;
  const slots = ["09:30", "11:00", "13:30", "15:00", "16:30"];
  const dates = useMemo(() => Array.from({ length: 5 }, (_, index) => {
    const value = new Date();
    value.setDate(value.getDate() + index + 1);
    const locale = lang === "vi" ? "vi-VN" : lang === "en" ? "en-US" : "ru-RU";
    return { value: value.toISOString().slice(0, 10), day: value.toLocaleDateString(locale, { weekday: "short" }), number: value.getDate() };
  }), [lang]);

  useEffect(() => {
    fetch("/client-data.json", { cache: "no-store" }).then(async (response) => response.ok ? response.json() : null).then((data) => data && setRuntime(data)).catch(() => undefined);
    const saved = window.localStorage.getItem(`${clinicDefaults.slug}-appointment`);
    if (saved) try { setAppointment(JSON.parse(saved)); } catch { /* stale local data */ }
    const profile = window.localStorage.getItem(`${clinicDefaults.slug}-profile`);
    if (profile) try { setContact(JSON.parse(profile)); } catch { /* stale local data */ }
  }, []);

  useEffect(() => {
    if (!locations.length) return;
    if (!selectedLocationId || !locations.some((item) => item.id === selectedLocationId)) {
      const initial = locations.find((item) => item.primary) || locations[0];
      setSelectedLocationId(initial.id);
    }
  }, [runtime]);

  useEffect(() => {
    if (!openGroup || !groupsForLocation.some((group) => group.id === openGroup)) setOpenGroup(groupsForLocation[0]?.id || "");
  }, [selectedLocationId, groupsForLocation, openGroup]);

  useEffect(() => {
    document.documentElement.lang = lang;
    const webApp = (window as any).Telegram?.WebApp;
    const initData = typeof webApp?.initData === "string" ? webApp.initData.trim() : "";
    if (!initData) return;
    webApp.ready?.();
    webApp.expand?.();
    fetch("/api/telegram/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData }) })
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        if (!ok || !data?.chatId) return;
        const session = { chatId: String(data.chatId), userId: String(data.userId || data.chatId), username: data.username || null, name: data.name || null };
        setTelegram(session);
        if (session.name) setContact((current) => ({ ...current, name: session.name || current.name }));
      }).catch(() => undefined);
  }, [lang]);

  function go(next: Screen) {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseLocation(id: string) {
    if (id === selectedLocationId) return;
    setSelectedLocationId(id);
    setSelectedService(null);
    setSelectedSpecialist(null);
    setDate("");
    setTime("");
    setBookingStep(0);
    setDetail(null);
  }

  function selectService(item: ServiceItem) {
    if (item.locationId && item.locationId !== selectedLocationId) setSelectedLocationId(item.locationId);
    setSelectedService(item);
    if (selectedSpecialist && !(item.staffIds || []).includes(selectedSpecialist.id)) setSelectedSpecialist(null);
  }

  function startBooking(item?: ServiceItem, person?: Specialist) {
    if (item?.locationId) setSelectedLocationId(item.locationId);
    else if (person?.locationId) setSelectedLocationId(person.locationId);
    setSelectedService(item || null);
    setSelectedSpecialist(person || null);
    if (item && person && !(item.staffIds || []).includes(person.id)) setSelectedSpecialist(null);
    setBookingStep(item ? (person ? 2 : 1) : 0);
    setDetail(null);
    go("booking");
  }

  function canContinue() {
    if (bookingStep === 0) return Boolean(selectedService);
    if (bookingStep === 1) return Boolean(selectedSpecialist);
    if (externalBooking && bookingStep === 2) return Boolean(externalBookingUrl);
    if (bookingStep === 2) return Boolean(date && time);
    if (bookingStep === 3) return Boolean(contact.name.trim() && (contact.phone.trim() || telegram?.chatId));
    return true;
  }

  async function submitBooking() {
    if (!selectedService || !selectedSpecialist || !date || !time || !contact.name.trim() || bookingLoading) return;
    setBookingLoading(true);
    setBookingError("");
    const webApp = (window as any).Telegram?.WebApp;
    const initData = typeof webApp?.initData === "string" ? webApp.initData.trim() : "";
    try {
      const response = await fetch("/api/booking/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, appointment: { serviceId: selectedService.id, specialistId: selectedSpecialist.id, date, time, name: contact.name.trim(), phone: contact.phone.trim(), lang } }) });
      const data = await response.json();
      if (!response.ok || !data?.appointment?.id) throw new Error(data?.error || "BOOKING_FAILED");
      const next = data.appointment as Appointment;
      setAppointment(next);
      window.localStorage.setItem(`${clinicDefaults.slug}-appointment`, JSON.stringify(next));
      window.localStorage.setItem(`${clinicDefaults.slug}-profile`, JSON.stringify(contact));
      setBookingStep(5);
    } catch {
      setBookingError(lang === "ru" ? "Не удалось создать запись. Попробуйте ещё раз." : lang === "vi" ? "Không thể tạo lịch hẹn. Vui lòng thử lại." : "Could not create the appointment. Please try again.");
    } finally { setBookingLoading(false); }
  }

  async function askAi(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || aiLoading) return;
    const nextMessages = [...messages, { role: "user" as const, content: text }].slice(-12);
    setMessages(nextMessages);
    setQuestion("");
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, messages: nextMessages }) });
      const data = await response.json();
      if (!response.ok || typeof data?.answer !== "string") throw new Error("AI_FAILED");
      setMessages((current) => [...current, { role: "assistant", content: data.answer, recommendedServiceId: data.recommendedServiceId || null }]);
    } catch {
      const fallback = lang === "ru" ? "ИИ-консультант пока выключен. Откройте каталог или запись." : lang === "vi" ? "Trợ lý AI hiện đang tắt. Hãy xem dịch vụ hoặc đặt lịch." : "The AI assistant is currently disabled. Browse services or booking.";
      setMessages((current) => [...current, { role: "assistant", content: fallback }]);
    } finally { setAiLoading(false); }
  }

  const title: Partial<Record<Screen, string>> = { services: t.services.title, specialists: t.specialists.title, booking: t.booking.title, ai: t.ai.title, profile: t.profile.title, admin: t.common.admin };

  function LocationSwitcher() {
    if (locations.length <= 1) return null;
    return <section className="location-panel"><div className="location-panel-title"><span>{c.location}</span><b>{currentLocation?.publicName || currentLocation?.name}</b></div><div className="location-pills">{locations.map((location) => <button key={location.id} className={location.id === selectedLocationId ? "active" : ""} onClick={() => chooseLocation(location.id)}><strong>{location.name.replace(/^EVO\s+/i, "")}</strong><small>{location.address || location.publicName || ""}</small></button>)}</div></section>;
  }

  function AdminLink() {
    const href = telegramUrl();
    return href ? <a className="inline-cta" href={href} target="_blank" rel="noopener noreferrer">{c.writeAdmin} →</a> : null;
  }

  return <main className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => go("home")}><span className="brand-mark" style={{ backgroundImage: `url(${clinicDefaults.logo})` }}>{clinicDefaults.shortName.slice(0, 1)}</span><span className="brand-copy"><b>{clinicDefaults.brandLine}</b><small>{currentLocation?.name || clinicDefaults.city}</small></span></button><div className="language-switch">{(["ru", "en", "vi"] as Language[]).map((code) => <button key={code} className={lang === code ? "active" : ""} onClick={() => setLang(code)}>{code.toUpperCase()}</button>)}</div></header>

    {screen !== "home" && <div className="page-heading"><button className="back-button" onClick={() => go("home")}>←</button><div><span>{currentLocation?.name || clinicDefaults.city}</span><h1>{title[screen]}</h1></div></div>}
    {screen === "home" && <Home />}
    {screen === "services" && <Services />}
    {screen === "specialists" && <Specialists />}
    {screen === "booking" && <Booking />}
    {screen === "ai" && <Ai />}
    {screen === "profile" && <Profile />}
    {screen === "admin" && <Admin />}

    {screen !== "admin" && <nav className="bottom-nav">{nav.map((item) => <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => item.id === "booking" ? startBooking() : go(item.id)}><span className="nav-icon">{item.icon}</span><span>{t.nav[item.id]}</span></button>)}</nav>}

    {detail && <div className="modal-backdrop" onClick={() => setDetail(null)}><article className="detail-sheet" onClick={(event) => event.stopPropagation()}><button className="sheet-close" onClick={() => setDetail(null)}>×</button><div className="detail-image" style={{ backgroundImage: `url(${asset(detail.image)})` }} /><div className="sheet-body"><span className="eyebrow">{currentLocation?.name || clinicDefaults.shortName}</span><h2>{detail.name[lang]}</h2><strong className="price">{detail.price[lang]}</strong><p>{detail.desc[lang]}</p>{(detail.staffIds || []).length ? <button className="primary-button" onClick={() => startBooking(detail)}>{t.common.book}</button> : <div className="unmapped-note"><p>{c.noStaff}</p><AdminLink /></div>}</div></article></div>}
  </main>;

  function Home() {
    return <><section className="hero"><div className="hero-copy"><span className="eyebrow">{t.home.welcome}</span><h1>{clinicDefaults.name}</h1><p>{clinicDefaults.tagline[lang]}</p></div><div className="hero-photo" style={{ backgroundImage: `url(${clinicDefaults.heroImage})` }} /></section><LocationSwitcher /><div className="branch-summary"><div><small>{currentLocation?.name}</small><b>{currentLocation?.address || clinicDefaults.contacts.address}</b><span>{currentLocation?.phone || clinicDefaults.contacts.phone} · {currentLocation?.hours || clinicDefaults.hours}</span></div><a href={mapUrl(currentLocation)} target="_blank" rel="noopener noreferrer">⌖</a></div><section className="quick-grid"><button className="quick-card" onClick={() => go("services")}><span className="quick-card-icon">☷</span><strong>{t.home.services}</strong></button><button className="quick-card primary" onClick={() => startBooking()}><span className="quick-card-icon">＋</span><strong>{t.common.book}</strong></button><button className="quick-card" onClick={() => go("specialists")}><span className="quick-card-icon">○</span><strong>{t.home.specialists}</strong></button><button className="quick-card" onClick={() => go("ai")}><span className="quick-card-icon">✦</span><strong>{t.home.askAi}</strong></button></section><section className="section-block"><div className="section-title"><h2>{t.home.popular}</h2><button onClick={() => go("services")}>{t.common.all}</button></div><div className="service-carousel">{featured.map((item) => <article className="service-card" key={item.id} onClick={() => setDetail(item)}><div className="service-image" style={{ backgroundImage: `url(${asset(item.image)})` }} /><div className="service-card-body"><h3>{item.name[lang]}</h3><p>{item.desc[lang]}</p><div className="service-card-footer"><strong>{item.price[lang]}</strong><span>{t.common.details} →</span></div></div></article>)}</div></section><section className="why-section"><span className="eyebrow">{clinicDefaults.shortName}</span><h2>{t.home.why}</h2><div className="why-list">{t.home.whyItems.map((item: string, index: number) => <div className="why-item" key={item}><span className="why-icon">0{index + 1}</span><b>{item}</b></div>)}</div></section></>;
  }

  function Services() {
    return <section><LocationSwitcher /><p className="lead-text">{t.services.subtitle}</p>{groupsForLocation.length ? <div className="accordion-list">{groupsForLocation.map((group) => <article className="service-group" key={group.id}><button className="group-header" onClick={() => setOpenGroup(openGroup === group.id ? "" : group.id)}><span className="group-thumb" style={{ backgroundImage: `url(${asset(group.image)})` }} /><span><b>{group.title[lang]}</b><small>{group.note[lang]}</small></span><i>{openGroup === group.id ? "⌃" : "⌄"}</i></button>{openGroup === group.id && <div className="group-items">{group.items.map((item) => <button key={item.id} onClick={() => setDetail(item)}><span><b>{item.name[lang]}</b><small>{item.desc[lang]}</small></span><strong>{item.price[lang]}</strong></button>)}</div>}</article>)}</div> : <div className="empty-state">{c.noServices}</div>}</section>;
  }

  function Specialists() {
    return <section><LocationSwitcher /><p className="lead-text">{t.specialists.subtitle}</p><div className="specialist-grid">{specialistsForLocation.map((person) => <article className="specialist-card" key={person.id}><div className="specialist-photo" style={{ backgroundImage: `url(${asset(person.image)})` }} /><div className="specialist-copy"><h2>{person.name[lang]}</h2><p>{person.role[lang]}</p><button onClick={() => startBooking(undefined, person)}>{t.common.book} →</button></div></article>)}</div></section>;
  }

  function Booking() {
    const labels = externalBooking ? [t.booking.service, t.booking.specialist, c.live] : [t.booking.service, t.booking.specialist, t.booking.slot, t.booking.details, t.booking.review];
    if (!externalBooking && bookingStep === 5) return <section className="success-state"><div className="success-icon">✓</div><h2>{t.booking.saved}</h2><p>{t.booking.savedNote}</p><button className="primary-button" onClick={() => go("profile")}>{t.profile.title}</button></section>;
    return <section><LocationSwitcher /><div className="progress"><span style={{ width: `${((bookingStep + 1) / totalBookingSteps) * 100}%` }} /></div><div className="step-label"><span>0{bookingStep + 1} / 0{totalBookingSteps}</span><h2>{labels[bookingStep]}</h2></div>
      {bookingStep === 0 && <div className="choice-list">{availableGroups.map((group) => <div key={group.id}><div className="choice-group-title">{group.title[lang]}</div>{group.items.map((item) => <button className={`choice-button ${selectedService?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => selectService(item)}><span className="choice-thumb" style={{ backgroundImage: `url(${asset(item.image)})` }} /><span className="choice-copy"><b>{item.name[lang]}</b><small>{item.price[lang]}{!(item.staffIds || []).length ? " · ⚠" : ""}</small></span></button>)}</div>)}</div>}
      {bookingStep === 1 && <><div className="exact-note">✓ {c.exact}</div>{availableSpecialists.length ? <div className="choice-list">{availableSpecialists.map((person) => <button className={`choice-button ${selectedSpecialist?.id === person.id ? "selected" : ""}`} key={person.id} onClick={() => setSelectedSpecialist(person)}><span className="choice-thumb" style={{ backgroundImage: `url(${asset(person.image)})` }} /><span className="choice-copy"><b>{person.name[lang]}</b><small>{person.role[lang]}</small></span></button>)}</div> : <div className="unmapped-card"><p>{c.noStaff}</p><AdminLink /></div>}</>}
      {externalBooking && bookingStep === 2 && <div className="live-booking-card"><span className="live-badge">ALTEGIO · LIVE</span><h3>{selectedService?.name[lang]}</h3><p>{selectedSpecialist?.name[lang]} · {currentLocation?.name}</p><p>{c.liveNote}</p><button className="primary-button" disabled={!externalBookingUrl} onClick={() => externalBookingUrl && window.open(externalBookingUrl, "_blank", "noopener,noreferrer")}>{c.openLive} ↗</button></div>}
      {!externalBooking && bookingStep === 2 && <div><div className="date-grid">{dates.map((item) => <button className={date === item.value ? "selected" : ""} key={item.value} onClick={() => setDate(item.value)}><small>{item.day}</small><b>{item.number}</b></button>)}</div><div className="time-grid">{slots.map((slot) => <button className={time === slot ? "selected" : ""} key={slot} onClick={() => setTime(slot)}>{slot}</button>)}</div></div>}
      {!externalBooking && bookingStep === 3 && <div className="contact-form"><label>{t.booking.name}<input autoComplete="name" value={contact.name} onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))} /></label><label>{t.booking.phone}<input type="tel" inputMode="tel" autoComplete="tel" value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))} placeholder={telegram ? (lang === "ru" ? "необязательно" : lang === "vi" ? "không bắt buộc" : "optional") : "+84"} /></label></div>}
      {!externalBooking && bookingStep === 4 && <div className="review-card"><div className="review-row"><small>{c.location}</small><b>{currentLocation?.name || "—"}</b></div><div className="review-row"><small>{t.booking.service}</small><b>{selectedService?.name[lang] || "—"}</b></div><div className="review-row"><small>{t.booking.specialist}</small><b>{selectedSpecialist?.name[lang] || "—"}</b></div><div className="review-row"><small>{t.booking.slot}</small><b>{date} · {time}</b></div></div>}
      {bookingError && <div className="privacy-note" style={{ marginTop: 12 }}>{bookingError}</div>}
      {!externalBooking && <div className="booking-actions">{bookingStep > 0 && <button className="secondary-button" onClick={() => setBookingStep((step) => step - 1)}>{t.booking.back}</button>}<button className="primary-button" disabled={!canContinue() || bookingLoading} onClick={() => bookingStep === 4 ? submitBooking() : setBookingStep((step) => step + 1)}>{bookingStep === 4 ? t.booking.confirm : t.booking.continue}</button></div>}
      {externalBooking && bookingStep < 2 && <div className="booking-actions">{bookingStep > 0 && <button className="secondary-button" onClick={() => setBookingStep((step) => step - 1)}>{t.booking.back}</button>}<button className="primary-button" disabled={!canContinue()} onClick={() => setBookingStep((step) => step + 1)}>{t.booking.continue}</button></div>}
      {externalBooking && bookingStep === 2 && <div className="booking-actions"><button className="secondary-button" onClick={() => setBookingStep(1)}>{t.booking.back}</button></div>}
    </section>;
  }

  function Ai() {
    return <section><div className="ai-orb"><span>AI</span></div><p className="lead-text">{t.ai.subtitle}</p><div className="chat"><div className="message">{t.ai.hello}</div>{messages.map((message, index) => { const recommendation = message.recommendedServiceId ? allItems.find((item) => item.id === message.recommendedServiceId) : null; return <div className={`message ${message.role === "user" ? "user" : ""}`} key={`${index}-${message.content.slice(0, 16)}`}><span>{message.content}</span>{recommendation && message.role === "assistant" && <button className="text-button" onClick={() => startBooking(recommendation)}>{t.common.book} · {recommendation.name[lang]} →</button>}</div>; })}{aiLoading && <div className="message">•••</div>}</div><form className="ask-form" onSubmit={askAi}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t.ai.placeholder} /><button disabled={aiLoading}>{t.ai.ask}</button></form></section>;
  }

  function Profile() {
    const service = appointment ? allItems.find((item) => item.id === appointment.serviceId) : null;
    const person = appointment ? people.find((item) => item.id === appointment.specialistId) : null;
    const displayName = contact.name || telegram?.name || (lang === "ru" ? "Гость" : lang === "vi" ? "Khách" : "Guest");
    return <section><div className="profile-card"><div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div><div><small>{clinicDefaults.shortName}</small><h2>{displayName}</h2></div></div>{externalBooking && <div className="live-booking-card compact"><span className="live-badge">ALTEGIO</span><p>{lang === "ru" ? "Записи EVO ведутся в официальной системе онлайн-записи." : lang === "vi" ? "Lịch hẹn EVO được quản lý trong hệ thống đặt lịch chính thức." : "EVO appointments are managed in the official booking system."}</p></div>}<div className="section-title"><h2>{t.profile.appointment}</h2></div>{appointment ? <article className="appointment-card"><h3>{service?.name[lang] || "—"}</h3><p>{person?.name[lang] || "—"}</p><p>{appointment.date} · {appointment.time}</p></article> : <div className="empty-state"><p>{t.profile.empty}</p><button className="primary-button" onClick={() => startBooking()}>{t.common.book}</button></div>}</section>;
  }

  function Admin() {
    return <section><p className="lead-text">{lang === "ru" ? "Сводка данных текущего клиента." : lang === "vi" ? "Tóm tắt dữ liệu khách hàng hiện tại." : "Current client data summary."}</p><div className="admin-grid"><div className="admin-tile"><small>{c.location}</small><b>{locations.length}</b></div><div className="admin-tile"><small>{t.services.title}</small><b>{allItems.length}</b></div><div className="admin-tile"><small>{t.specialists.title}</small><b>{people.length}</b></div><div className="admin-tile"><small>Exact</small><b>{allItems.reduce((sum, item) => sum + (item.staffIds?.length || 0), 0)}</b></div></div><button className="secondary-button" style={{ width: "100%", marginTop: 18 }} onClick={() => go("home")}>← {t.nav.home}</button></section>;
  }
}
