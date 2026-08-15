import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const passportPath = path.resolve(root, process.argv[2]);
const clientDir = path.dirname(passportPath);
const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
const locales = ["ru", "en", "vi"];
const localize = (value, fallback = "") => {
  if (typeof value === "string") return Object.fromEntries(locales.map((l) => [l, value]));
  const v = value && typeof value === "object" ? value : {};
  const first = v.ru || v.en || v.vi || fallback;
  return Object.fromEntries(locales.map((l) => [l, v[l] || first]));
};
const money = (s) => {
  const cfg = passport.catalog?.priceDisplay || {};
  const min = Number(s.priceMinRaw ?? s.priceMin ?? s.price ?? 0) * Number(cfg.multiplier ?? 1);
  const max = Number(s.priceMaxRaw ?? s.priceMax ?? s.priceMinRaw ?? s.priceMin ?? s.price ?? 0) * Number(cfg.multiplier ?? 1);
  const fmt = (n) => Number.isFinite(n) ? new Intl.NumberFormat(cfg.locale || "vi-VN", { maximumFractionDigits: 0 }).format(n) : "";
  const value = min && max && min !== max ? `${fmt(min)}–${fmt(max)}` : fmt(min || max);
  return `${value || "По запросу"} ${cfg.currency || s.currency || ""}`.trim();
};

const visualBindings = passport.assetAudit?.runtimeBindings || {};
const visualHero = visualBindings.hero || passport.brand?.images?.hero || "/client/hero.webp";
const normalize = (value) => String(value || "").toLocaleLowerCase().replace(/ё/g, "е").trim();
const coverForCategory = (value) => {
  const haystack = normalize(value);
  for (const rule of visualBindings.serviceCoverRules || []) {
    if (!rule?.cover || !Array.isArray(rule.match)) continue;
    if (rule.match.some((token) => haystack.includes(normalize(token)))) return rule.cover;
  }
  return visualHero;
};
const portraitFor = (person) => {
  if (visualBindings.specialistDirectory && person.branch && person.id != null) {
    return `${String(visualBindings.specialistDirectory).replace(/\/$/, "")}/${person.branch}-${person.id}.webp`;
  }
  return person.avatar || person.avatarSmall || visualHero;
};

const payloads = [];
for (const branch of ["center", "north", "saigon"]) {
  const dir = path.join(clientDir, "data", branch);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    const payload = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    const locationId = String(payload.location?.id || payload.locationId || "");
    if (locationId) payloads.push({ branch, locationId, payload });
  }
}
if (!payloads.length) throw new Error("exact-network-v3: no snapshots found");

const categories = new Map();
const services = new Map();
const staff = new Map();
for (const { branch, locationId, payload } of payloads) {
  for (const c of payload.categories || []) categories.set(`${locationId}:${c.id}`, { ...c, branch, locationId });
  for (const s of payload.services || []) services.set(`${locationId}:${s.id}`, { ...s, branch, locationId });
  for (const p of payload.staff || []) staff.set(`${locationId}:${p.id}`, { ...p, branch, locationId });
}
const locationByExternal = new Map((passport.locations || []).map((x) => [String(x.externalId || x.id?.replace("altegio-", "")), x]));

const availableStaffByService = new Map();
for (const p of staff.values()) {
  if (p.bookable === false) continue;
  for (const serviceId of p.serviceIds || []) {
    const key = `${p.locationId}:${serviceId}`;
    if (!availableStaffByService.has(key)) availableStaffByService.set(key, new Set());
    availableStaffByService.get(key).add(String(p.id));
  }
}
const externalStaffFor = (s) => [...(availableStaffByService.get(`${s.locationId}:${s.id}`) || new Set())].sort((a, b) => Number(a) - Number(b));
const signatureFor = (s) => externalStaffFor(s).join("_") || "unmapped";
const signaturesPerCategory = new Map();
for (const s of services.values()) {
  const key = `${s.locationId}:${s.categoryId ?? "other"}`;
  if (!signaturesPerCategory.has(key)) signaturesPerCategory.set(key, new Set());
  signaturesPerCategory.get(key).add(signatureFor(s));
}

const groups = new Map();
const runtimeService = new Map();
for (const s of services.values()) {
  const categoryKey = `${s.locationId}:${s.categoryId ?? "other"}`;
  const category = categories.get(categoryKey);
  const branch = locationByExternal.get(String(s.locationId));
  const externalStaffIds = externalStaffFor(s);
  const signature = signatureFor(s);
  const groupId = `altegio-category-${s.locationId}-${s.categoryId ?? "other"}-${signature}`;
  const serviceId = `altegio-service-${s.locationId}-${s.id}`;
  const categoryName = category?.name || s.category || "Other";
  const categoryCover = coverForCategory(categoryName);
  if (!groups.has(groupId)) {
    const branchName = branch?.name || branch?.publicName || `#${s.locationId}`;
    const names = externalStaffIds.map((id) => staff.get(`${s.locationId}:${id}`)?.name).filter(Boolean);
    const split = (signaturesPerCategory.get(categoryKey)?.size || 0) > 1;
    const note = split ? (names.length ? `Специалисты: ${names.join(", ")}` : "Специалист пока не назначен") : (branch?.publicName || branchName);
    groups.set(groupId, { id: groupId, title: localize(`${categoryName} · ${branchName}`), note: localize(note), image: categoryCover, items: [] });
  }
  const minutes = Number(s.durationMinutes || 0);
  const staffIds = externalStaffIds.map((id) => `altegio-staff-${s.locationId}-${id}`);
  groups.get(groupId).items.push({ id: serviceId, name: localize(s.name, serviceId), price: localize(money(s)), desc: minutes ? { ru: `${minutes} мин`, en: `${minutes} min`, vi: `${minutes} phút` } : localize(""), image: categoryCover, staffIds, locationId: `altegio-${s.locationId}`, externalId: s.id });
  runtimeService.set(`${s.locationId}:${s.id}`, { serviceId, groupId });
}

const allStaff = [];
for (const p of staff.values()) {
  const exact = (p.serviceIds || []).map((id) => runtimeService.get(`${p.locationId}:${id}`)).filter(Boolean);
  const serviceIds = [...new Set(exact.map((x) => x.serviceId))];
  const serviceGroups = [...new Set(exact.map((x) => x.groupId))];
  allStaff.push({ id: `altegio-staff-${p.locationId}-${p.id}`, name: localize(p.name, String(p.id)), role: localize(p.specialization || "Specialist"), image: portraitFor(p), tags: [], serviceGroups, serviceIds, locationId: `altegio-${p.locationId}`, externalId: p.id, bookable: p.bookable !== false, scheduleTill: p.scheduleTill || null, sourcePortrait: p.avatar || p.avatarSmall || null });
}
const selectable = allStaff.filter((p) => p.bookable && p.serviceIds.length);
const finalGroups = [...groups.values()].filter((g) => g.items.length);
const allServices = finalGroups.flatMap((g) => g.items);
const expected = passport.dataQuality?.networkStats?.total;
const links = allStaff.reduce((sum, p) => sum + p.serviceIds.length, 0);
if (expected?.branchServiceRecords && allServices.length !== expected.branchServiceRecords) throw new Error(`expected ${expected.branchServiceRecords} services, got ${allServices.length}`);
if (expected?.branchStaffRecords && allStaff.length !== expected.branchStaffRecords) throw new Error(`expected ${expected.branchStaffRecords} staff, got ${allStaff.length}`);
if (expected?.links && links !== expected.links) throw new Error(`expected ${expected.links} relations, got ${links}`);

const primary = passport.locations.find((x) => x.primary) || passport.locations[0] || {};
const mapUrl = primary.mapUrl || (primary.lat != null && primary.lon != null ? `https://www.google.com/maps/dir/?api=1&destination=${primary.lat},${primary.lon}` : "");
const generated = {
  schemaVersion: 1,
  clinic: { slug: passport.client.slug, name: passport.client.name, shortName: passport.client.shortName, brandLine: passport.brand?.brandLine || passport.client.name.toUpperCase(), city: String(passport.client.city).toUpperCase(), tagline: localize(passport.brand?.tagline, passport.client.name), hours: primary.hours || "10:00–20:00", logoSource: passport.brand?.logoSource || "", visualAssetsSource: visualBindings.sourceRoot || "", heroImage: visualHero, welcomeImage: visualHero },
  contacts: { ...(passport.contacts || {}), phone: primary.phone || passport.contacts?.phone || "", address: primary.address || "", mapUrl },
  theme: passport.brand?.theme || {},
  featuredServiceIds: allServices.slice(0, 3).map((x) => x.id),
  defaultConsultationServiceId: allServices[0]?.id || "",
  services: finalGroups,
  specialists: selectable,
  ai: passport.integrations?.ai || { enabled: false },
  telegram: passport.integrations?.telegram || { enabled: false },
  cloudflare: passport.integrations?.cloudflare || {},
};
const generatedPath = path.join(clientDir, "clinic.generated.json");
fs.writeFileSync(generatedPath, JSON.stringify(generated, null, 2) + "\n");
const runtime = { schemaVersion: 2, generatedAt: new Date().toISOString(), sourcePassport: path.relative(root, passportPath), client: passport.client, brand: passport.brand, contacts: passport.contacts, locations: passport.locations, dataSources: passport.dataSources, networkStats: passport.dataQuality?.networkStats || null, catalog: { groups: finalGroups, services: allServices.map((s) => ({ id: s.id, externalId: s.externalId, locationId: s.locationId, staffIds: s.staffIds, image: s.image })) }, specialists: allStaff, integrations: passport.integrations, visual: visualBindings };
fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "client-data.json"), JSON.stringify(runtime, null, 2) + "\n");
const apply = spawnSync(process.execPath, [path.join(root, "scripts", "apply-clinic-config.mjs"), generatedPath], { cwd: root, stdio: "inherit" });
if (apply.status !== 0) process.exit(apply.status || 1);
console.log(`exact-network-v3: ${finalGroups.length} groups, ${allServices.length} services, ${allStaff.length} staff, ${links} relations, ${selectable.length} selectable specialists`);
