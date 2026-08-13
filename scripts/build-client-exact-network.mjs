import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const passportPath = path.resolve(root, process.argv[2]);
const clientDir = path.dirname(passportPath);
const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
const locales = ["ru", "en", "vi"];
const loc = (value, fallback = "") => {
  if (typeof value === "string") return Object.fromEntries(locales.map((l) => [l, value]));
  const v = value && typeof value === "object" ? value : {};
  const first = v.ru || v.en || v.vi || fallback;
  return Object.fromEntries(locales.map((l) => [l, v[l] || first]));
};
const money = (s) => {
  const cfg = passport.catalog?.priceDisplay || {};
  const mul = Number(cfg.multiplier ?? 1);
  const min = Number(s.priceMinRaw ?? s.priceMin ?? s.price ?? 0) * mul;
  const max = Number(s.priceMaxRaw ?? s.priceMax ?? s.priceMinRaw ?? s.priceMin ?? s.price ?? 0) * mul;
  const fmt = (n) => Number.isFinite(n) ? new Intl.NumberFormat(cfg.locale || "vi-VN", { maximumFractionDigits: 0 }).format(n) : "";
  const value = min && max && min !== max ? `${fmt(min)}–${fmt(max)}` : fmt(min || max);
  return `${value || "По запросу"} ${cfg.currency || s.currency || ""}`.trim();
};

const payloads = [];
for (const branch of ["center", "north", "saigon"]) {
  const dir = path.join(clientDir, "data", branch);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    const payload = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    const locationId = String(payload.location?.id || payload.locationId || "");
    if (!locationId) continue;
    payloads.push({ branch, name, locationId, payload });
  }
}
if (!payloads.length) throw new Error("exact-network: no snapshots found");

const categoryMap = new Map();
const serviceMap = new Map();
const staffMap = new Map();
const locationByExternal = new Map((passport.locations || []).map((x) => [String(x.externalId || x.id?.replace("altegio-", "")), x]));

for (const { locationId, payload } of payloads) {
  for (const c of payload.categories || []) categoryMap.set(`${locationId}:${c.id}`, { ...c, locationId });
  for (const s of payload.services || []) serviceMap.set(`${locationId}:${s.id}`, { ...s, locationId });
  for (const p of payload.staff || []) staffMap.set(`${locationId}:${p.id}`, { ...p, locationId });
}

const groups = new Map();
const runtimeServiceByExternal = new Map();
for (const s of serviceMap.values()) {
  const categoryKey = `${s.locationId}:${s.categoryId ?? "other"}`;
  const category = categoryMap.get(categoryKey);
  const location = locationByExternal.get(String(s.locationId));
  const groupId = `altegio-category-${s.locationId}-${s.categoryId ?? "other"}`;
  const serviceId = `altegio-service-${s.locationId}-${s.id}`;
  if (!groups.has(groupId)) {
    const categoryName = category?.name || s.category || "Other";
    const branchName = location?.name || location?.publicName || `#${s.locationId}`;
    groups.set(groupId, {
      id: groupId,
      title: loc(`${categoryName} · ${branchName}`),
      note: loc(location?.publicName || branchName),
      image: passport.brand?.images?.hero || "/client/hero.webp",
      items: [],
    });
  }
  const minutes = Number(s.durationMinutes || 0);
  const staffIds = Array.isArray(s.staffIds) ? s.staffIds.map((id) => `altegio-staff-${s.locationId}-${id}`) : [];
  groups.get(groupId).items.push({
    id: serviceId,
    name: loc(s.name, serviceId),
    price: loc(money(s)),
    desc: minutes ? { ru: `${minutes} мин`, en: `${minutes} min`, vi: `${minutes} phút` } : loc(""),
    image: s.image || passport.brand?.images?.hero || "/client/hero.webp",
    staffIds,
    locationId: `altegio-${s.locationId}`,
    externalId: s.id,
  });
  runtimeServiceByExternal.set(`${s.locationId}:${s.id}`, { serviceId, groupId });
}

const allStaff = [];
for (const p of staffMap.values()) {
  const exact = (p.serviceIds || []).map((id) => runtimeServiceByExternal.get(`${p.locationId}:${id}`)).filter(Boolean);
  const serviceIds = [...new Set(exact.map((x) => x.serviceId))];
  const serviceGroups = [...new Set(exact.map((x) => x.groupId))];
  allStaff.push({
    id: `altegio-staff-${p.locationId}-${p.id}`,
    name: loc(p.name, String(p.id)),
    role: loc(p.specialization || "Specialist"),
    image: p.avatar || p.avatarSmall || passport.brand?.images?.hero || "/client/hero.webp",
    tags: [],
    serviceGroups,
    serviceIds,
    locationId: `altegio-${p.locationId}`,
    externalId: p.id,
    bookable: p.bookable !== false,
    scheduleTill: p.scheduleTill || null,
  });
}
const specialists = allStaff.filter((p) => p.bookable && p.serviceIds.length);
const finalGroups = [...groups.values()].filter((g) => g.items.length);
const allServices = finalGroups.flatMap((g) => g.items);
const expected = passport.catalog?.networkStats?.total;
if (expected?.branchServiceRecords && allServices.length !== expected.branchServiceRecords) throw new Error(`exact-network: expected ${expected.branchServiceRecords} services, got ${allServices.length}`);
if (expected?.branchStaffRecords && allStaff.length !== expected.branchStaffRecords) throw new Error(`exact-network: expected ${expected.branchStaffRecords} staff records, got ${allStaff.length}`);

const primary = passport.locations.find((x) => x.primary) || passport.locations[0] || {};
const mapUrl = primary.mapUrl || (primary.lat != null && primary.lon != null ? `https://www.google.com/maps/dir/?api=1&destination=${primary.lat},${primary.lon}` : "");
const generated = {
  schemaVersion: 1,
  clinic: {
    slug: passport.client.slug,
    name: passport.client.name,
    shortName: passport.client.shortName,
    brandLine: passport.brand?.brandLine || passport.client.name.toUpperCase(),
    city: String(passport.client.city).toUpperCase(),
    tagline: loc(passport.brand?.tagline, passport.client.name),
    hours: primary.hours || "10:00–20:00",
    logoSource: passport.brand?.logoSource || "",
    heroImage: passport.brand?.images?.hero || "/client/hero.webp",
    welcomeImage: passport.brand?.images?.welcome || passport.brand?.images?.hero || "/client/hero.webp",
  },
  contacts: { ...(passport.contacts || {}), phone: primary.phone || passport.contacts?.phone || "", address: primary.address || "", mapUrl },
  theme: passport.brand?.theme || {},
  featuredServiceIds: allServices.slice(0, 3).map((x) => x.id),
  defaultConsultationServiceId: allServices[0]?.id || "",
  services: finalGroups,
  specialists,
  ai: passport.integrations?.ai || { enabled: false },
  telegram: passport.integrations?.telegram || { enabled: false },
  cloudflare: passport.integrations?.cloudflare || {},
};
const generatedPath = path.join(clientDir, "clinic.generated.json");
fs.writeFileSync(generatedPath, JSON.stringify(generated, null, 2) + "\n");

const runtime = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  sourcePassport: path.relative(root, passportPath),
  client: passport.client,
  brand: passport.brand,
  contacts: passport.contacts,
  locations: passport.locations,
  dataSources: passport.dataSources,
  networkStats: passport.catalog?.networkStats || null,
  catalog: { groups: finalGroups, services: allServices.map((s) => ({ id: s.id, externalId: s.externalId, locationId: s.locationId, staffIds: s.staffIds })) },
  specialists: allStaff,
  integrations: passport.integrations,
};
fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "client-data.json"), JSON.stringify(runtime, null, 2) + "\n");
const apply = spawnSync(process.execPath, [path.join(root, "scripts", "apply-clinic-config.mjs"), generatedPath], { cwd: root, stdio: "inherit" });
if (apply.status !== 0) process.exit(apply.status || 1);
console.log(`exact-network: ${finalGroups.length} groups, ${allServices.length} services, ${allStaff.length} staff records, ${specialists.length} currently selectable specialists`);
