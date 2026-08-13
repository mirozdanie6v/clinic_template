import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const passportArg = process.argv[2] || "clients/_template/passport.json";
const passportPath = path.resolve(root, passportArg);
const fail = (message) => { console.error(`client-builder: ${message}`); process.exit(1); };

if (!fs.existsSync(passportPath)) fail(`passport not found: ${passportArg}`);
const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
if (passport.schemaVersion !== 1) fail("unsupported passport schemaVersion");
for (const key of ["slug", "name", "shortName", "businessType", "city", "country", "timezone"]) {
  if (!passport.client?.[key]) fail(`client.${key} is required`);
}
if (!Array.isArray(passport.locations) || !passport.locations.length) fail("locations[] is required");

const clientDir = path.dirname(passportPath);
const locales = ["ru", "en", "vi"];
const localized = (value, fallback = "") => {
  if (typeof value === "string") return Object.fromEntries(locales.map((l) => [l, value]));
  const source = value && typeof value === "object" ? value : {};
  const first = source.ru || source.en || source.vi || fallback;
  return Object.fromEntries(locales.map((l) => [l, source[l] || first]));
};
const priceText = (service, priceCfg = {}) => {
  const multiplier = Number(priceCfg.multiplier ?? 1);
  const min = Number(service.priceMinRaw ?? service.priceMin ?? service.price ?? 0) * multiplier;
  const max = Number(service.priceMaxRaw ?? service.priceMax ?? service.priceMinRaw ?? service.priceMin ?? service.price ?? 0) * multiplier;
  const currency = priceCfg.currency || service.currency || "";
  const format = (n) => Number.isFinite(n)
    ? new Intl.NumberFormat(priceCfg.locale || "vi-VN", { maximumFractionDigits: 0 }).format(n)
    : "";
  const text = min && max && min !== max ? `${format(min)}–${format(max)} ${currency}` : `${format(min || max)} ${currency}`;
  return text.trim() || "По запросу";
};
const durationText = (minutes, locale) => {
  if (!minutes) return "";
  if (locale === "en") return `${minutes} min`;
  if (locale === "vi") return `${minutes} phút`;
  return `${minutes} мин`;
};

const imported = [];
for (const spec of passport.catalog?.imports || []) {
  if (spec.enabled === false) continue;
  const sourcePath = path.resolve(clientDir, spec.path);
  if (!fs.existsSync(sourcePath)) fail(`catalog import not found: ${spec.path}`);
  const payload = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  imported.push({ spec, payload });
}

const groupMap = new Map();
const serviceMeta = new Map();
const staffMap = new Map();

function ensureGroup(id, name, image = "") {
  const key = String(id);
  if (!groupMap.has(key)) {
    groupMap.set(key, {
      id: key,
      title: localized(name, key),
      note: localized({
        ru: "Актуальные услуги из системы записи",
        en: "Current services from the booking system",
        vi: "Dịch vụ hiện tại từ hệ thống đặt lịch"
      }),
      image: image || passport.brand?.images?.hero || "/client/hero.webp",
      items: []
    });
  }
  return groupMap.get(key);
}

for (const group of passport.catalog?.manualGroups || []) {
  const target = ensureGroup(group.id, group.title || group.name, group.image);
  target.note = localized(group.note || "");
  for (const item of group.items || []) {
    const serviceId = String(item.id);
    target.items.push({
      id: serviceId,
      name: localized(item.name, serviceId),
      price: localized(item.price || "По запросу"),
      desc: localized(item.desc || ""),
      image: item.image || target.image
    });
    serviceMeta.set(serviceId, { groupId: target.id, source: "manual", raw: item });
  }
}

for (const { spec, payload } of imported) {
  if (spec.type !== "altegio-snapshot") fail(`unsupported catalog import type: ${spec.type}`);
  const categories = Array.isArray(payload.categories) ? payload.categories : [];
  const categoryById = new Map(categories.map((c) => [String(c.id), c]));
  for (const category of categories) ensureGroup(`altegio-category-${category.id}`, category.name);
  for (const service of payload.services || []) {
    const category = categoryById.get(String(service.categoryId));
    const group = ensureGroup(
      `altegio-category-${service.categoryId ?? "other"}`,
      category?.name || service.category || "Other"
    );
    const id = `altegio-service-${service.id}`;
    const price = priceText(service, passport.catalog?.priceDisplay || {});
    const duration = Number(service.durationMinutes || 0);
    const desc = {
      ru: [durationText(duration, "ru"), service.comment].filter(Boolean).join(" · "),
      en: [durationText(duration, "en"), service.comment].filter(Boolean).join(" · "),
      vi: [durationText(duration, "vi"), service.comment].filter(Boolean).join(" · ")
    };
    group.items.push({
      id,
      name: localized(service.name, id),
      price: localized(price),
      desc: localized(desc),
      image: service.image || group.image
    });
    serviceMeta.set(id, {
      groupId: group.id,
      externalId: service.id,
      locationId: spec.locationId,
      source: "altegio",
      raw: service
    });
  }
  for (const person of payload.staff || []) {
    const id = `altegio-staff-${person.id}`;
    staffMap.set(id, {
      id,
      name: localized(person.name, id),
      role: localized(person.specialization || "Specialist"),
      image: person.avatar || person.avatarSmall || passport.brand?.images?.hero || "/client/hero.webp",
      tags: [],
      serviceGroups: [],
      source: "altegio",
      externalId: person.id,
      specialization: person.specialization || "",
      explicitServiceIds: Array.isArray(person.serviceIds) ? person.serviceIds : []
    });
  }
}

for (const person of passport.specialists?.manual || []) {
  const id = String(person.id);
  staffMap.set(id, {
    id,
    name: localized(person.name, id),
    role: localized(person.role || "Specialist"),
    image: person.image || passport.brand?.images?.hero || "/client/hero.webp",
    tags: person.tags || [],
    serviceGroups: person.serviceGroups || [],
    serviceIds: person.serviceIds || [],
    source: "manual"
  });
}

const groups = [...groupMap.values()].filter((g) => g.items.length);
const validGroupIds = new Set(groups.map((g) => g.id));
const serviceExternalToGroup = new Map();
for (const meta of serviceMeta.values()) if (meta.externalId != null) serviceExternalToGroup.set(String(meta.externalId), meta.groupId);

function fallbackGroupsForRole(role) {
  const r = String(role || "").toLowerCase();
  const tests = [];
  if (/hair|barber|color|stylist/.test(r)) tests.push(/hair|blond|color|barber|стриж|окраш|волос/i);
  if (/nail/.test(r)) tests.push(/nail|manicure|pedicure|маник|педик/i);
  if (/brow|lash/.test(r)) tests.push(/brow|lash|бров|ресниц/i);
  if (/spa/.test(r)) tests.push(/spa|treatment|care|уход/i);
  if (/podolog/.test(r)) tests.push(/podolog|подолог/i);
  const matched = groups.filter((g) => tests.some((rx) => rx.test(g.title.ru))).map((g) => g.id);
  return [...new Set(matched)];
}

for (const person of staffMap.values()) {
  const explicit = [];
  for (const sid of person.explicitServiceIds || person.serviceIds || []) {
    const groupId = serviceExternalToGroup.get(String(sid)) || serviceMeta.get(String(sid))?.groupId;
    if (groupId) explicit.push(groupId);
  }
  person.serviceGroups = [...new Set([
    ...(person.serviceGroups || []).filter((id) => validGroupIds.has(id)),
    ...explicit
  ])];
  if (!person.serviceGroups.length && passport.catalog?.relationPolicy === "specialization-fallback") {
    person.serviceGroups = fallbackGroupsForRole(person.specialization || person.role?.ru);
  }
}

const specialists = [...staffMap.values()].map(({ source, externalId, specialization, explicitServiceIds, serviceIds, ...person }) => person);
const primaryLocation = passport.locations.find((l) => l.primary) || passport.locations[0];
const mapUrl = primaryLocation.mapUrl || (
  primaryLocation.lat != null && primaryLocation.lon != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${primaryLocation.lat},${primaryLocation.lon}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(primaryLocation.address)}`
);

const firstServiceId = groups[0]?.items?.[0]?.id || "";
const featured = (passport.content?.featuredServiceIds || []).filter((id) => serviceMeta.has(id));
const generatedConfig = {
  schemaVersion: 1,
  clinic: {
    slug: passport.client.slug,
    name: passport.client.name,
    shortName: passport.client.shortName,
    brandLine: passport.brand?.brandLine || passport.client.name.toUpperCase(),
    city: String(passport.client.city).toUpperCase(),
    tagline: localized(passport.brand?.tagline, passport.client.name),
    hours: primaryLocation.hours || "09:00–20:00",
    logoSource: passport.brand?.logoSource || "",
    heroImage: passport.brand?.images?.hero || "/client/hero.webp",
    welcomeImage: passport.brand?.images?.welcome || passport.brand?.images?.hero || "/client/hero.webp"
  },
  contacts: {
    ...(passport.contacts || {}),
    phone: primaryLocation.phone || passport.contacts?.phone || "",
    address: primaryLocation.address,
    mapUrl
  },
  theme: passport.brand?.theme || {},
  featuredServiceIds: featured.length ? featured : groups.flatMap((g) => g.items).slice(0, 3).map((i) => i.id),
  defaultConsultationServiceId: passport.content?.defaultConsultationServiceId || firstServiceId,
  services: groups,
  specialists,
  ai: passport.integrations?.ai || { enabled: false },
  telegram: passport.integrations?.telegram || { enabled: false },
  cloudflare: passport.integrations?.cloudflare || {}
};

const generatedPath = path.join(clientDir, "clinic.generated.json");
fs.writeFileSync(generatedPath, JSON.stringify(generatedConfig, null, 2) + "\n");

const runtime = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourcePassport: path.relative(root, passportPath),
  client: passport.client,
  brand: passport.brand,
  contacts: passport.contacts,
  locations: passport.locations,
  content: passport.content || {},
  catalog: {
    groups,
    services: [...serviceMeta.entries()].map(([id, meta]) => ({
      id,
      groupId: meta.groupId,
      externalId: meta.externalId ?? null,
      locationId: meta.locationId ?? null,
      source: meta.source
    }))
  },
  specialists: [...staffMap.values()].map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    image: p.image,
    serviceGroups: p.serviceGroups,
    externalId: p.externalId ?? null,
    source: p.source
  })),
  integrations: passport.integrations || {},
  build: {
    importedSources: imported.map(({ spec, payload }) => ({
      type: spec.type,
      path: spec.path,
      locationId: spec.locationId || null,
      extractedAt: payload.extractedAt || null,
      stats: payload.stats || {
        categories: payload.categories?.length || 0,
        services: payload.services?.length || 0,
        staff: payload.staff?.length || 0
      }
    })),
    relationStatus: [...staffMap.values()].every((p) => p.serviceGroups?.length) ? "usable" : "partial"
  }
};

fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "client-data.json"), JSON.stringify(runtime, null, 2) + "\n");

const apply = spawnSync(process.execPath, [path.join(root, "scripts", "apply-clinic-config.mjs"), generatedPath], {
  cwd: root,
  stdio: "inherit"
});
if (apply.status !== 0) process.exit(apply.status || 1);

console.log(`client-builder: built ${passport.client.name} from ${path.relative(root, passportPath)}`);
console.log(`client-builder: ${groups.length} groups, ${serviceMeta.size} services, ${specialists.length} specialists`);
console.log("client-builder: runtime -> public/client-data.json");
