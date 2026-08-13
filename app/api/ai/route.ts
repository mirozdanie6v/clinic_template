import { clinicDefaults, services, specialists } from "../../../app-data.js";

type Language = "ru" | "en" | "vi";
type Message = { role: "user" | "assistant"; content: string };
const supported = new Set<Language>(["ru", "en", "vi"]);
const allServices = services.flatMap((group: any) => group.items.map((item: any) => ({ group, item })));
const serviceIds = new Set(allServices.map((entry: any) => entry.item.id));

function knowledge(lang: Language) {
  return {
    clinic: { name: clinicDefaults.name, city: clinicDefaults.city, hours: clinicDefaults.hours, contacts: clinicDefaults.contacts },
    services: services.map((group: any) => ({ id: group.id, title: group.title[lang], note: group.note[lang], items: group.items.map((item: any) => ({ id: item.id, name: item.name[lang], price: item.price[lang], description: item.desc[lang] })) })),
    specialists: specialists.map((person: any) => ({ id: person.id, name: person.name[lang], role: person.role[lang], serviceGroups: person.serviceGroups })),
  };
}

function instructions(lang: Language) {
  const language = lang === "ru" ? "Russian" : lang === "vi" ? "Vietnamese" : "English";
  return `You are the patient-facing clinic navigation assistant for ${clinicDefaults.name}. Reply in ${language}. Help the user understand the clinic catalog, prices and the most relevant booking direction. Use only the clinic data supplied below for clinic-specific facts. Do not invent prices, schedules, guarantees, specialist names or services. Do not diagnose or prescribe medication. For potentially urgent symptoms, advise prompt in-person medical assessment. Keep answers concise and practical. When one listed service is clearly the best booking direction, return its exact id as recommended_service_id; otherwise return null.\n\nCLINIC DATA\n${JSON.stringify(knowledge(lang))}`;
}

function extractText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output || []) for (const part of item?.content || []) if (part?.type === "output_text" && typeof part.text === "string") return part.text;
  return "";
}

function localFallback(lang: Language, messages: Message[]) {
  const query = (messages.at(-1)?.content || "").toLocaleLowerCase();
  const ranked = allServices.map((entry: any) => {
    const text = [entry.item.name?.[lang], entry.item.desc?.[lang], entry.group.title?.[lang], entry.group.note?.[lang]].filter(Boolean).join(" ").toLocaleLowerCase();
    const tokens = query.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 3);
    return { entry, score: tokens.filter((token) => text.includes(token)).length };
  }).sort((a: any, b: any) => b.score - a.score);
  const match = ranked[0]?.score > 0 ? ranked[0].entry : allServices.find((entry: any) => entry.item.id === clinicDefaults.defaultConsultationServiceId);
  if (!match) return { answer: lang === "ru" ? "Откройте каталог услуг, чтобы выбрать подходящее направление." : lang === "vi" ? "Hãy mở danh mục dịch vụ để chọn hướng phù hợp." : "Open the services catalog to choose the relevant direction.", recommendedServiceId: null, mode: "catalog" };
  const answer = lang === "ru" ? `${match.item.name[lang]} — ${match.item.price[lang]}. ${match.item.desc[lang]} Точную тактику специалист определит после очной оценки.` : lang === "vi" ? `${match.item.name[lang]} — ${match.item.price[lang]}. ${match.item.desc[lang]} Chuyên gia sẽ xác nhận phương án phù hợp sau khi thăm khám.` : `${match.item.name[lang]} — ${match.item.price[lang]}. ${match.item.desc[lang]} The specialist will confirm the exact approach after an in-person assessment.`;
  return { answer, recommendedServiceId: match.item.id, mode: "catalog" };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const lang: Language = supported.has(body?.lang) ? body.lang : "ru";
  const messages: Message[] = (Array.isArray(body?.messages) ? body.messages : []).filter((message: any) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string").slice(-12).map((message: any) => ({ role: message.role, content: message.content.trim().slice(0, 1400) }));
  if (!messages.length || messages.at(-1)?.role !== "user") return Response.json({ error: "USER_MESSAGE_REQUIRED" }, { status: 400 });

  const worker = (process.env.CLINIC_AI_WORKER_URL || "").replace(/\/$/, "");
  if (worker) {
    try {
      const response = await fetch(`${worker}/ai`, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.CLINIC_BACKEND_TOKEN ? { Authorization: `Bearer ${process.env.CLINIC_BACKEND_TOKEN}` } : {}) }, body: JSON.stringify({ lang, messages }), cache: "no-store" });
      if (response.ok) return Response.json(await response.json());
    } catch { /* continue to direct OpenAI or catalog fallback */ }
  }

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) return Response.json(localFallback(lang, messages));
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5",
        instructions: instructions(lang),
        input: messages,
        max_output_tokens: 700,
        text: { format: { type: "json_schema", name: "clinic_reply", strict: true, schema: { type: "object", properties: { answer: { type: "string" }, recommended_service_id: { type: ["string", "null"] } }, required: ["answer", "recommended_service_id"], additionalProperties: false } } },
      }),
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) return Response.json(localFallback(lang, messages));
    const text = extractText(payload);
    const parsed = JSON.parse(text);
    const recommendedServiceId = typeof parsed?.recommended_service_id === "string" && serviceIds.has(parsed.recommended_service_id) ? parsed.recommended_service_id : null;
    return Response.json({ answer: String(parsed?.answer || "").trim(), recommendedServiceId, mode: "openai" });
  } catch { return Response.json(localFallback(lang, messages)); }
}
