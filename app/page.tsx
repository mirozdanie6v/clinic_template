"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { asset, clinicDefaults, services, specialists, translations } from "../app-data.js";

type Language = "ru" | "en" | "vi";
type Screen = "home" | "services" | "booking" | "ai" | "profile" | "specialists" | "admin";
type Localized = Record<Language, string>;
type ServiceItem = { id: string; name: Localized; price: Localized; desc: Localized; image: string };
type ServiceGroup = { id: string; title: Localized; note: Localized; image: string; items: ServiceItem[] };
type Specialist = { id: string; name: Localized; role: Localized; image: string; tags: string[]; serviceGroups: string[] };
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

export default function ClinicMiniApp() {
  const [lang, setLang] = useState<Language>("ru");
  const [screen, setScreen] = useState<Screen>("home");
  const [openGroup, setOpenGroup] = useState<string>((services[0] as ServiceGroup)?.id || "");
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
  const allItems = useMemo<ServiceItem[]>(() => (services as ServiceGroup[]).flatMap((group) => group.items), []);
  const featured = clinicDefaults.featuredServiceIds.map((id: string) => allItems.find((item) => item.id === id)).filter(Boolean) as ServiceItem[];
  const selectedGroupId = selectedService ? (services as ServiceGroup[]).find((group) => group.items.some((item) => item.id === selectedService.id))?.id : undefined;
  const availableSpecialists = selectedGroupId ? (specialists as Specialist[]).filter((person) => person.serviceGroups.includes(selectedGroupId)) : specialists as Specialist[];
  const availableGroups = selectedSpecialist ? (services as ServiceGroup[]).filter((group) => selectedSpecialist.serviceGroups.includes(group.id)) : services as ServiceGroup[];
  const slots = ["09:30", "11:00", "13:30", "15:00", "16:30"];
  const dates = useMemo(() => Array.from({ length: 5 }, (_, index) => {
    const value = new Date();
    value.setDate(value.getDate() + index + 1);
    const locale = lang === "vi" ? "vi-VN" : lang === "en" ? "en-US" : "ru-RU";
    return { value: value.toISOString().slice(0, 10), day: value.toLocaleDateString(locale, { weekday: "short" }), number: value.getDate() };
  }), [lang]);

  useEffect(() => {
    const saved = window.localStorage.getItem(`${clinicDefaults.slug}-appointment`);
    if (saved) try { setAppointment(JSON.parse(saved)); } catch { /* ignore stale demo data */ }
    const profile = window.localStorage.getItem(`${clinicDefaults.slug}-profile`);
    if (profile) try { setContact(JSON.parse(profile)); } catch { /* ignore stale demo data */ }
  }, []);

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
      })
      .catch(() => undefined);
  }, [lang]);

  function go(next: Screen) {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function serviceGroupId(item: ServiceItem) {
    return (services as ServiceGroup[]).find((group) => group.items.some((candidate) => candidate.id === item.id))?.id;
  }

  function startBooking(item?: ServiceItem, person?: Specialist) {
    const nextItem = item || null;
    const nextPerson = person || null;
    setSelectedService(nextItem);
    setSelectedSpecialist(nextPerson);
    if (nextItem && nextPerson && !nextPerson.serviceGroups.includes(serviceGroupId(nextItem) || "")) setSelectedSpecialist(null);
    setBookingStep(nextItem ? (nextPerson ? 2 : 1) : 0);
    setDetail(null);
    go("booking");
  }

  function canContinue() {
    if (bookingStep === 0) return Boolean(selectedService);
    if (bookingStep === 1) return Boolean(selectedSpecialist);
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
      const response = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, appointment: { serviceId: selectedService.id, specialistId: selectedSpecialist.id, date, time, name: contact.name.trim(), phone: contact.phone.trim(), lang } }),
      });
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
    const userMessage: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMessage].slice(-12);
    setMessages(nextMessages);
    setQuestion("");
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, messages: nextMessages }) });
      const data = await response.json();
      if (!response.ok || typeof data?.answer !== "string") throw new Error("AI_FAILED");
      setMessages((current) => [...current, { role: "assistant", content: data.answer, recommendedServiceId: data.recommendedServiceId || null }]);
    } catch {
      const fallback = lang === "ru" ? "Сейчас ИИ-консультант недоступен. Вы можете открыть каталог услуг или перейти к записи." : lang === "vi" ? "Trợ lý AI hiện không khả dụng. Bạn có thể xem dịch vụ hoặc đặt lịch." : "The AI assistant is unavailable right now. You can browse services or book an appointment.";
      setMessages((current) => [...current, { role: "assistant", content: fallback }]);
    } finally { setAiLoading(false); }
  }

  const title: Partial<Record<Screen, string>> = {
    services: t.services.title,
    specialists: t.specialists.title,
    booking: t.booking.title,
    ai: t.ai.title,
    profile: t.profile.title,
    admin: t.common.admin,
  };

  return <main className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => go("home")}>
        <span className="brand-mark" style={{ backgroundImage: `url(${clinicDefaults.logo})` }}>{clinicDefaults.shortName.slice(0, 1)}</span>
        <span className="brand-copy"><b>{clinicDefaults.brandLine}</b><small>{clinicDefaults.city}</small></span>
      </button>
      <div className="language-switch">{(["ru", "en", "vi"] as Language[]).map((code) => <button key={code} className={lang === code ? "active" : ""} onClick={() => setLang(code)}>{code.toUpperCase()}</button>)}</div>
    </header>

    {screen !== "home" && <div className="page-heading"><button className="back-button" onClick={() => go("home")}>←</button><div><span>{clinicDefaults.city}</span><h1>{title[screen]}</h1></div></div>}

    {screen === "home" && <Home />}
    {screen === "services" && <Services />}
    {screen === "specialists" && <Specialists />}
    {screen === "booking" && <Booking />}
    {screen === "ai" && <Ai />}
    {screen === "profile" && <Profile />}
    {screen === "admin" && <Admin />}

    {screen !== "admin" && <nav className="bottom-nav">{nav.map((item) => <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => item.id === "booking" ? startBooking() : go(item.id)}><span className="nav-icon">{item.icon}</span><span>{t.nav[item.id]}</span></button>)}</nav>}

    {detail && <div className="modal-backdrop" onClick={() => setDetail(null)}><article className="detail-sheet" onClick={(event) => event.stopPropagation()}><button className="sheet-close" onClick={() => setDetail(null)}>×</button><div className="detail-image" style={{ backgroundImage: `url(${asset(detail.image)})` }} /><div className="sheet-body"><span className="eyebrow">{clinicDefaults.shortName}</span><h2>{detail.name[lang]}</h2><strong className="price">{detail.price[lang]}</strong><p>{detail.desc[lang]}</p><button className="primary-button" onClick={() => startBooking(detail)}>{t.common.book}</button></div></article></div>}
  </main>;

  function Home() {
    return <>
      <section className="hero"><div className="hero-copy"><span className="eyebrow">{t.home.welcome}</span><h1>{clinicDefaults.name}</h1><p>{clinicDefaults.tagline[lang]}</p></div><div className="hero-photo" style={{ backgroundImage: `url(${clinicDefaults.heroImage})` }} /></section>
      <div className="home-action-strip"><div className="home-hours"><span className="status-dot" /><span><small>{t.common.today}</small><strong>{clinicDefaults.hours}</strong></span></div><button onClick={() => go("ai")}><span>✦</span><span>{t.common.message}</span></button><a href={clinicDefaults.contacts.mapUrl || "#"} target="_blank" rel="noopener noreferrer"><span>⌖</span><span>{t.common.route}</span></a></div>
      <section className="quick-grid">
        <button className="quick-card" onClick={() => go("services")}><span className="quick-card-icon">☷</span><strong>{t.home.services}</strong></button>
        <button className="quick-card primary" onClick={() => startBooking()}><span className="quick-card-icon">＋</span><strong>{t.common.book}</strong></button>
        <button className="quick-card" onClick={() => go("specialists")}><span className="quick-card-icon">○</span><strong>{t.home.specialists}</strong></button>
        <button className="quick-card" onClick={() => go("ai")}><span className="quick-card-icon">✦</span><strong>{t.home.askAi}</strong></button>
      </section>
      <section className="section-block"><div className="section-title"><h2>{t.home.popular}</h2><button onClick={() => go("services")}>{t.common.all}</button></div><div className="service-carousel">{featured.map((item) => <article className="service-card" key={item.id} onClick={() => setDetail(item)}><div className="service-image" style={{ backgroundImage: `url(${asset(item.image)})` }} /><div className="service-card-body"><h3>{item.name[lang]}</h3><p>{item.desc[lang]}</p><div className="service-card-footer"><strong>{item.price[lang]}</strong><span>{t.common.details} →</span></div></div></article>)}</div></section>
      <section className="why-section"><span className="eyebrow">{clinicDefaults.shortName}</span><h2>{t.home.why}</h2><div className="why-list">{t.home.whyItems.map((item: string, index: number) => <div className="why-item" key={item}><span className="why-icon">0{index + 1}</span><b>{item}</b></div>)}</div></section>
      <section className="demo-banner"><div><b>{clinicDefaults.shortName}</b><p>{clinicDefaults.contacts.address}</p></div><button onClick={() => go("admin")}>{t.common.admin} →</button></section>
    </>;
  }

  function Services() {
    return <section><p className="lead-text">{t.services.subtitle}</p><div className="accordion-list">{(services as ServiceGroup[]).map((group) => <article className="service-group" key={group.id}><button className="group-header" onClick={() => setOpenGroup(openGroup === group.id ? "" : group.id)}><span className="group-thumb" style={{ backgroundImage: `url(${asset(group.image)})` }} /><span><b>{group.title[lang]}</b><small>{group.note[lang]}</small></span><i>{openGroup === group.id ? "⌃" : "⌄"}</i></button>{openGroup === group.id && <div className="group-items">{group.items.map((item) => <button key={item.id} onClick={() => setDetail(item)}><span><b>{item.name[lang]}</b><small>{item.desc[lang]}</small></span><strong>{item.price[lang]}</strong></button>)}</div>}</article>)}</div></section>;
  }

  function Specialists() {
    return <section><p className="lead-text">{t.specialists.subtitle}</p><div className="specialist-grid">{(specialists as Specialist[]).map((person) => <article className="specialist-card" key={person.id}><div className="specialist-photo" style={{ backgroundImage: `url(${asset(person.image)})` }} /><div className="specialist-copy"><h2>{person.name[lang]}</h2><p>{person.role[lang]}</p><button onClick={() => startBooking(undefined, person)}>{t.common.book} →</button></div></article>)}</div></section>;
  }

  function Booking() {
    const labels = [t.booking.service, t.booking.specialist, t.booking.slot, t.booking.details, t.booking.review];
    if (bookingStep === 5) return <section className="success-state"><div className="success-icon">✓</div><h2>{t.booking.saved}</h2><p>{t.booking.savedNote}</p><button className="primary-button" onClick={() => go("profile")}>{t.profile.title}</button></section>;
    return <section><div className="progress"><span style={{ width: `${((bookingStep + 1) / 5) * 100}%` }} /></div><div className="step-label"><span>0{bookingStep + 1} / 05</span><h2>{labels[bookingStep]}</h2></div>
      {bookingStep === 0 && <div className="choice-list">{availableGroups.map((group) => <div key={group.id}><div className="choice-group-title">{group.title[lang]}</div>{group.items.map((item) => <button className={`choice-button ${selectedService?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => { setSelectedService(item); if (selectedSpecialist && !selectedSpecialist.serviceGroups.includes(group.id)) setSelectedSpecialist(null); }}><span className="choice-thumb" style={{ backgroundImage: `url(${asset(item.image)})` }} /><span className="choice-copy"><b>{item.name[lang]}</b><small>{item.price[lang]}</small></span></button>)}</div>)}</div>}
      {bookingStep === 1 && <div className="choice-list">{availableSpecialists.map((person) => <button className={`choice-button ${selectedSpecialist?.id === person.id ? "selected" : ""}`} key={person.id} onClick={() => setSelectedSpecialist(person)}><span className="choice-thumb" style={{ backgroundImage: `url(${asset(person.image)})` }} /><span className="choice-copy"><b>{person.name[lang]}</b><small>{person.role[lang]}</small></span></button>)}</div>}
      {bookingStep === 2 && <div><div className="date-grid">{dates.map((item) => <button className={date === item.value ? "selected" : ""} key={item.value} onClick={() => setDate(item.value)}><small>{item.day}</small><b>{item.number}</b></button>)}</div><div className="time-grid">{slots.map((slot) => <button className={time === slot ? "selected" : ""} key={slot} onClick={() => setTime(slot)}>{slot}</button>)}</div></div>}
      {bookingStep === 3 && <div className="contact-form"><label>{t.booking.name}<input autoComplete="name" value={contact.name} onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))} /></label><label>{t.booking.phone}<input type="tel" inputMode="tel" autoComplete="tel" value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))} placeholder={telegram ? (lang === "ru" ? "необязательно" : lang === "vi" ? "không bắt buộc" : "optional") : "+84"} /></label>{telegram && <div className="privacy-note">Telegram: {telegram.username ? `@${telegram.username}` : telegram.name || telegram.chatId} · {lang === "ru" ? "определён автоматически" : lang === "vi" ? "tự động nhận diện" : "detected automatically"}</div>}</div>}
      {bookingStep === 4 && <div className="review-card"><div className="review-row"><small>{t.booking.service}</small><b>{selectedService?.name[lang] || "—"}</b></div><div className="review-row"><small>{t.booking.specialist}</small><b>{selectedSpecialist?.name[lang] || "—"}</b></div><div className="review-row"><small>{t.booking.slot}</small><b>{date} · {time}</b></div><div className="review-row"><small>{t.booking.details}</small><b>{contact.name} · {contact.phone || "Telegram"}</b></div></div>}
      {bookingError && <div className="privacy-note" style={{ marginTop: 12 }}>{bookingError}</div>}
      <div className="booking-actions">{bookingStep > 0 && <button className="secondary-button" onClick={() => setBookingStep((step) => step - 1)}>{t.booking.back}</button>}<button className="primary-button" disabled={!canContinue() || bookingLoading} onClick={() => bookingStep === 4 ? submitBooking() : setBookingStep((step) => step + 1)}>{bookingStep === 4 ? t.booking.confirm : t.booking.continue}</button></div>
    </section>;
  }

  function Ai() {
    return <section><div className="ai-orb"><span>AI</span></div><p className="lead-text">{t.ai.subtitle}</p><div className="chat"><div className="message">{t.ai.hello}</div>{messages.map((message, index) => { const recommendation = message.recommendedServiceId ? allItems.find((item) => item.id === message.recommendedServiceId) : null; return <div className={`message ${message.role === "user" ? "user" : ""}`} key={`${index}-${message.content.slice(0, 16)}`}><span>{message.content}</span>{recommendation && message.role === "assistant" && <button className="text-button" onClick={() => startBooking(recommendation)}>{t.common.book} · {recommendation.name[lang]} →</button>}</div>; })}{aiLoading && <div className="message">•••</div>}</div><form className="ask-form" onSubmit={askAi}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t.ai.placeholder} /><button disabled={aiLoading}>{t.ai.ask}</button></form></section>;
  }

  function Profile() {
    const service = appointment ? allItems.find((item) => item.id === appointment.serviceId) : null;
    const person = appointment ? (specialists as Specialist[]).find((item) => item.id === appointment.specialistId) : null;
    const displayName = contact.name || telegram?.name || (lang === "ru" ? "Гость" : lang === "vi" ? "Khách" : "Guest");
    return <section><div className="profile-card"><div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div><div><small>{clinicDefaults.shortName}</small><h2>{displayName}</h2></div></div><div className="section-title"><h2>{t.profile.appointment}</h2></div>{appointment ? <article className="appointment-card"><h3>{service?.name[lang] || "—"}</h3><p>{person?.name[lang] || "—"}</p><p>{appointment.date} · {appointment.time}</p></article> : <div className="empty-state"><p>{t.profile.empty}</p><button className="primary-button" onClick={() => startBooking()}>{t.common.book}</button></div>}</section>;
  }

  function Admin() {
    return <section><p className="lead-text">{lang === "ru" ? "Шаблон будущей панели управления клиникой." : lang === "vi" ? "Mẫu bảng quản trị phòng khám." : "Clinic management panel prototype."}</p><div className="admin-grid"><div className="admin-tile"><small>{t.services.title}</small><b>{allItems.length}</b></div><div className="admin-tile"><small>{t.specialists.title}</small><b>{specialists.length}</b></div><div className="admin-tile"><small>{t.profile.appointment}</small><b>{appointment ? "1" : "0"}</b></div><div className="admin-tile"><small>Telegram</small><b>{telegram ? "✓" : "—"}</b></div></div><button className="secondary-button" style={{ width: "100%", marginTop: 18 }} onClick={() => go("home")}>← {t.nav.home}</button></section>;
  }
}
