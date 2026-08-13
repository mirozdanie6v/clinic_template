import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const passportArg = process.argv[2] || "clients/_template/passport.json";
const passportPath = path.resolve(root, passportArg);
const clientDir = path.dirname(passportPath);
const fail = (m) => { console.error(`client-router: ${m}`); process.exit(1); };
if (!fs.existsSync(passportPath)) fail(`passport not found: ${passportArg}`);
const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
const sidecarPath = path.join(clientDir, "data-sources.json");
const routes = passport.dataSources || (fs.existsSync(sidecarPath) ? JSON.parse(fs.readFileSync(sidecarPath, "utf8")) : {
  catalog: { primary: "manual", fallback: "manual", required: true },
  specialists: { primary: "manual", fallback: "manual", required: true },
  booking: { primary: "internal", fallback: "contact", required: false }
});

const allowed = {
  catalog: new Set(["manual", "altegio-snapshot", "google-sheets", "external-api"]),
  specialists: new Set(["manual", "altegio-snapshot", "google-sheets", "external-api"]),
  booking: new Set(["internal", "contact", "altegio", "external-api"])
};
for (const key of ["catalog", "specialists", "booking"]) {
  const route = routes[key] || {};
  if (!route.primary) fail(`dataSources.${key}.primary is required`);
  if (!route.fallback) fail(`dataSources.${key}.fallback is required`);
  if (!allowed[key].has(route.primary)) fail(`unsupported ${key} provider: ${route.primary}`);
}

const locales = ["ru", "en", "vi"];
const localized = (value, fallback = "") => {
  if (typeof value === "string") return Object.fromEntries(locales.map((l) => [l, value]));
  const v = value && typeof value === "object" ? value : {};
  const first = v.ru || v.en || v.vi || fallback;
  return Object.fromEntries(locales.map((l) => [l, v[l] || first]));
};
const money = (service) => {
  const cfg = passport.catalog?.priceDisplay || {};
  const mul = Number(cfg.multiplier ?? 1);
  const min = Number(service.priceMinRaw ?? service.priceMin ?? service.price ?? 0) * mul;
  const max = Number(service.priceMaxRaw ?? service.priceMax ?? service.priceMinRaw ?? service.priceMin ?? service.price ?? 0) * mul;
  const fmt = (n) => Number.isFinite(n) ? new Intl.NumberFormat(cfg.locale || "vi-VN", { maximumFractionDigits: 0 }).format(n) : "";
  const currency = cfg.currency || service.currency || "";
  return ((min && max && min !== max ? `${fmt(min)}–${fmt(max)}` : fmt(min || max)) + ` ${currency}`).trim() || "По запросу";
};

const groups = new Map();
const serviceMeta = new Map();
const staff = new Map();
const ensureGroup = (id, title, image = "") => {
  id = String(id);
  if (!groups.has(id)) groups.set(id, { id, title: localized(title, id), note: localized(""), image: image || passport.brand?.images?.hero || "/client/hero.webp", items: [] });
  return groups.get(id);
};

function loadManualCatalog() {
  for (const g of passport.catalog?.manualGroups || []) {
    const target = ensureGroup(g.id, g.title || g.name, g.image);
    target.note = localized(g.note || "");
    for (const item of g.items || []) {
      const id = String(item.id);
      target.items.push({ id, name: localized(item.name, id), price: localized(item.price || "По запросу"), desc: localized(item.desc || ""), image: item.image || target.image });
      serviceMeta.set(id, { groupId: target.id, source: "manual", raw: item });
    }
  }
}
function loadManualStaff() {
  for (const p of passport.specialists?.manual || []) {
    const id = String(p.id);
    staff.set(id, { id, name: localized(p.name, id), role: localized(p.role || "Specialist"), image: p.image || passport.brand?.images?.hero || "/client/hero.webp", tags: p.tags || [], serviceGroups: p.serviceGroups || [], serviceIds: p.serviceIds || [], source: "manual" });
  }
}
function snapshots() {
  const out = [];
  for (const spec of passport.catalog?.imports || []) {
    if (spec.enabled === false || spec.type !== "altegio-snapshot") continue;
    const p = path.resolve(clientDir, spec.path);
    if (!fs.existsSync(p)) continue;
    out.push({ spec, payload: JSON.parse(fs.readFileSync(p, "utf8")) });
  }
  return out;
}
function loadAltegioCatalog(data) {
  for (const { spec, payload } of data) {
    const cats = new Map((payload.categories || []).map((c) => [String(c.id), c]));
    for (const s of payload.services || []) {
      const group = ensureGroup(`altegio-category-${s.categoryId ?? "other"}`, cats.get(String(s.categoryId))?.name || s.category || "Other");
      const id = `altegio-service-${s.id}`;
      const mins = Number(s.durationMinutes || 0);
      const desc = mins ? { ru: `${mins} мин`, en: `${mins} min`, vi: `${mins} phút` } : "";
      group.items.push({ id, name: localized(s.name, id), price: localized(money(s)), desc: localized(desc), image: s.image || group.image });
      serviceMeta.set(id, { groupId: group.id, externalId: s.id, locationId: spec.locationId || null, source: "altegio" });
    }
  }
}
function loadAltegioStaff(data) {
  for (const { payload } of data) for (const p of payload.staff || []) {
    const id = `altegio-staff-${p.id}`;
    staff.set(id, { id, name: localized(p.name, id), role: localized(p.specialization || "Specialist"), image: p.avatar || p.avatarSmall || passport.brand?.images?.hero || "/client/hero.webp", tags: [], serviceGroups: [], serviceIds: Array.isArray(p.serviceIds) ? p.serviceIds : [], externalId: p.id, source: "altegio", specialization: p.specialization || "" });
  }
}

const snap = snapshots();
const resolveSource = (kind, manualLoader, externalLoader) => {
  const route = routes[kind];
  let used = route.primary;
  if (route.primary === "manual") manualLoader();
  else if (route.primary === "altegio-snapshot" && snap.length) externalLoader(snap);
  else if (route.fallback === "manual") { manualLoader(); used = "manual-fallback"; }
  else if (route.required) fail(`${kind} source ${route.primary} unavailable and fallback ${route.fallback} cannot be used`);
  return used;
};
const sourceStatus = {
  catalog: resolveSource("catalog", loadManualCatalog, loadAltegioCatalog),
  specialists: resolveSource("specialists", loadManualStaff, loadAltegioStaff),
  booking: routes.booking.primary
};

const finalGroups = [...groups.values()].filter((g) => g.items.length);
if (!finalGroups.length && routes.catalog.required) fail("catalog resolved to zero services");
const externalServiceToGroup = new Map();
for (const m of serviceMeta.values()) if (m.externalId != null) externalServiceToGroup.set(String(m.externalId), m.groupId);
for (const p of staff.values()) {
  const exact = (p.serviceIds || []).map((id) => externalServiceToGroup.get(String(id))).filter(Boolean);
  p.serviceGroups = [...new Set([...(p.serviceGroups || []), ...exact])];
  if (!p.serviceGroups.length && finalGroups.length && passport.catalog?.relationPolicy === "specialization-fallback") p.serviceGroups = finalGroups.map((g) => g.id);
}
if (!staff.size && routes.specialists.required) fail("specialists resolved to zero records");

const primaryLocation = passport.locations.find((l) => l.primary) || passport.locations[0];
const allServices = finalGroups.flatMap((g) => g.items);
const mapUrl = primaryLocation.mapUrl || (primaryLocation.lat != null && primaryLocation.lon != null ? `https://www.google.com/maps/dir/?api=1&destination=${primaryLocation.lat},${primaryLocation.lon}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(primaryLocation.address)}`);
const generated = {
  schemaVersion: 1,
  clinic: { slug: passport.client.slug, name: passport.client.name, shortName: passport.client.shortName, brandLine: passport.brand?.brandLine || passport.client.name.toUpperCase(), city: String(passport.client.city).toUpperCase(), tagline: localized(passport.brand?.tagline, passport.client.name), hours: primaryLocation.hours || "09:00–20:00", logoSource: passport.brand?.logoSource || "", heroImage: passport.brand?.images?.hero || "/client/hero.webp", welcomeImage: passport.brand?.images?.welcome || passport.brand?.images?.hero || "/client/hero.webp" },
  contacts: { ...(passport.contacts || {}), phone: primaryLocation.phone || passport.contacts?.phone || "", address: primaryLocation.address, mapUrl },
  theme: passport.brand?.theme || {},
  featuredServiceIds: (passport.content?.featuredServiceIds || []).filter((id) => serviceMeta.has(id)).length ? passport.content.featuredServiceIds.filter((id) => serviceMeta.has(id)) : allServices.slice(0, 3).map((i) => i.id),
  defaultConsultationServiceId: passport.content?.defaultConsultationServiceId || allServices[0]?.id || "",
  services: finalGroups,
  specialists: [...staff.values()].map(({ source, externalId, specialization, serviceIds, ...p }) => p),
  ai: passport.integrations?.ai || { enabled: false },
  telegram: passport.integrations?.telegram || { enabled: false },
  cloudflare: passport.integrations?.cloudflare || {}
};
const generatedPath = path.join(clientDir, "clinic.generated.json");
fs.writeFileSync(generatedPath, JSON.stringify(generated, null, 2) + "\n");
const runtime = { schemaVersion: 1, generatedAt: new Date().toISOString(), sourcePassport: path.relative(root, passportPath), client: passport.client, brand: passport.brand, contacts: passport.contacts, locations: passport.locations, dataSources: routes, sourceStatus, catalog: { groups: finalGroups, services: [...serviceMeta.entries()].map(([id, m]) => ({ id, groupId: m.groupId, externalId: m.externalId ?? null, locationId: m.locationId ?? null, source: m.source })) }, specialists: [...staff.values()].map((p) => ({ id: p.id, name: p.name, role: p.role, image: p.image, serviceGroups: p.serviceGroups, externalId: p.externalId ?? null, source: p.source })), integrations: { ...(passport.integrations || {}), booking: { ...(passport.integrations?.booking || {}), provider: routes.booking.primary, fallback: routes.booking.fallback } } };
fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "client-data.json"), JSON.stringify(runtime, null, 2) + "\n");
const apply = spawnSync(process.execPath, [path.join(root, "scripts", "apply-clinic-config.mjs"), generatedPath], { cwd: root, stdio: "inherit" });
if (apply.status !== 0) process.exit(apply.status || 1);
console.log(`client-router: ${passport.client.name}`);
console.log(`client-router: catalog=${sourceStatus.catalog}, specialists=${sourceStatus.specialists}, booking=${sourceStatus.booking}`);
console.log(`client-router: ${finalGroups.length} groups, ${serviceMeta.size} services, ${staff.size} specialists`);
