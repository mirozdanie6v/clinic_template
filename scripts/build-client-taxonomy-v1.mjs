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
const normalize = (value) => String(value || "").toLocaleLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const money = (s) => {
  const cfg = passport.catalog?.priceDisplay || {};
  const min = Number(s.priceMinRaw ?? s.priceMin ?? s.price ?? 0) * Number(cfg.multiplier ?? 1);
  const max = Number(s.priceMaxRaw ?? s.priceMax ?? s.priceMinRaw ?? s.priceMin ?? s.price ?? 0) * Number(cfg.multiplier ?? 1);
  const fmt = (n) => Number.isFinite(n) ? new Intl.NumberFormat(cfg.locale || "vi-VN", { maximumFractionDigits: 0 }).format(n) : "";
  const value = min && max && min !== max ? `${fmt(min)}–${fmt(max)}` : fmt(min || max);
  return `${value || "По запросу"} ${cfg.currency || s.currency || ""}`.trim();
};

const taxonomy = passport.catalogTaxonomy;
if (!taxonomy?.directions?.length) throw new Error("taxonomy-v1: catalogTaxonomy.directions[] is required");
if (taxonomy.rules?.specialistsDefineHierarchy !== false) throw new Error("taxonomy-v1: specialistsDefineHierarchy must be false");
if (taxonomy.rules?.rawCategoriesRenderedDirectly !== false) throw new Error("taxonomy-v1: rawCategoriesRenderedDirectly must be false");
if (taxonomy.rules?.serviceImagesAllowed !== false) throw new Error("taxonomy-v1: serviceImagesAllowed must be false");

const directionById = new Map();
const subgroupById = new Map();
for (const direction of taxonomy.directions) {
  directionById.set(direction.id, direction);
  for (const subgroup of direction.subgroups || []) {
    if (subgroupById.has(subgroup.id)) throw new Error(`taxonomy-v1: duplicate subgroup ${subgroup.id}`);
    subgroupById.set(subgroup.id, { ...subgroup, directionId: direction.id });
  }
}
if (!subgroupById.has("other")) throw new Error("taxonomy-v1: fallback subgroup 'other' is required");
for (const rule of taxonomy.classification || []) {
  if (!subgroupById.has(rule.subgroup)) throw new Error(`taxonomy-v1: unknown classification subgroup ${rule.subgroup}`);
}

const visualBindings = passport.assetAudit?.runtimeBindings || {};
const visualHero = visualBindings.hero || passport.brand?.images?.hero || "/client/hero.webp";
const imageForSubgroup = (subgroupId) => {
  const subgroup = subgroupById.get(subgroupId);
  const direction = directionById.get(subgroup?.directionId);
  return subgroup?.image || direction?.image || visualHero;
};
const portraitFor = (person) => {
  if (visualBindings.specialistDirectory && person.branch && person.id != null) {
    return `${String(visualBindings.specialistDirectory).replace(/\/$/, "")}/${person.branch}-${person.id}.webp`;
  }
  return person.avatar || person.avatarSmall || visualHero;
};
const classify = (categoryName, serviceName) => {
  const haystack = normalize(`${categoryName || ""} ${serviceName || ""}`);
  for (const rule of taxonomy.classification || []) {
    if ((rule.terms || []).some((term) => haystack.includes(normalize(term)))) return rule.subgroup;
  }
  return taxonomy.rules?.unmatchedPolicy === "reject" ? null : "other";
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
if (!payloads.length) throw new Error("taxonomy-v1: no snapshots found");

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

const groups = new Map();
const runtimeService = new Map();
const unmatched = [];
for (const s of services.values()) {
  const category = categories.get(`${s.locationId}:${s.categoryId ?? "other"}`);
  const categoryName = category?.name || s.category || "Other";
  const subgroupId = classify(categoryName, s.name);
  if (!subgroupId) {
    unmatched.push({ locationId: s.locationId, category: categoryName, service: s.name, id: s.id });
    continue;
  }
  const subgroup = subgroupById.get(subgroupId) || subgroupById.get("other");
  const direction = directionById.get(subgroup.directionId);
  const branch = locationByExternal.get(String(s.locationId));
  const branchName = branch?.publicName || branch?.name || `#${s.locationId}`;
  const groupId = `taxonomy-${s.locationId}-${subgroup.id}`;
  const serviceId = `altegio-service-${s.locationId}-${s.id}`;
  const groupImage = imageForSubgroup(subgroup.id);
  if (!groups.has(groupId)) {
    groups.set(groupId, {
      id: groupId,
      directionId: direction.id,
      directionTitle: localize(direction.title, direction.id),
      subgroupId: subgroup.id,
      title: localize(subgroup.title, subgroup.id),
      note: localize({ ru: `${direction.title?.ru || direction.id} · ${branchName}`, en: `${direction.title?.en || direction.id} · ${branchName}`, vi: `${direction.title?.vi || direction.id} · ${branchName}` }),
      image: groupImage,
      presentationImageLevel: "subgroup",
      items: []
    });
  }
  const minutes = Number(s.durationMinutes || 0);
  const staffIds = externalStaffFor(s).map((id) => `altegio-staff-${s.locationId}-${id}`);
  groups.get(groupId).items.push({
    id: serviceId,
    name: localize(s.name, serviceId),
    price: localize(money(s)),
    desc: minutes ? { ru: `${minutes} мин`, en: `${minutes} min`, vi: `${minutes} phút` } : localize(""),
    image: groupImage,
    imageInheritedFrom: subgroup.id,
    staffIds,
    locationId: `altegio-${s.locationId}`,
    externalId: s.id,
    rawCategoryId: s.categoryId ?? null,
    rawCategoryName: categoryName
  });
  runtimeService.set(`${s.locationId}:${s.id}`, { serviceId, groupId, subgroupId: subgroup.id, directionId: direction.id });
}
if (unmatched.length) throw new Error(`taxonomy-v1: ${unmatched.length} services rejected by taxonomy`);

const allStaff = [];
for (const p of staff.values()) {
  const exact = (p.serviceIds || []).map((id) => runtimeService.get(`${p.locationId}:${id}`)).filter(Boolean);
  const serviceIds = [...new Set(exact.map((x) => x.serviceId))];
  const serviceGroups = [...new Set(exact.map((x) => x.groupId))];
  allStaff.push({
    id: `altegio-staff-${p.locationId}-${p.id}`,
    name: localize(p.name, String(p.id)),
    role: localize(p.specialization || "Specialist"),
    image: portraitFor(p),
    tags: [],
    serviceGroups,
    serviceIds,
    locationId: `altegio-${p.locationId}`,
    externalId: p.id,
    bookable: p.bookable !== false,
    scheduleTill: p.scheduleTill || null,
    sourcePortrait: p.avatar || p.avatarSmall || null
  });
}

const directionOrder = new Map(taxonomy.directions.map((d, i) => [d.id, i]));
const subgroupOrder = new Map();
for (const direction of taxonomy.directions) for (const [i, subgroup] of (direction.subgroups || []).entries()) subgroupOrder.set(subgroup.id, i);
const finalGroups = [...groups.values()]
  .filter((g) => g.items.length)
  .sort((a, b) => (directionOrder.get(a.directionId) ?? 999) - (directionOrder.get(b.directionId) ?? 999) || (subgroupOrder.get(a.subgroupId) ?? 999) - (subgroupOrder.get(b.subgroupId) ?? 999));
const allServices = finalGroups.flatMap((g) => g.items);
const selectable = allStaff.filter((p) => p.bookable && p.serviceIds.length);
const expected = passport.dataQuality?.networkStats?.total;
const links = allStaff.reduce((sum, p) => sum + p.serviceIds.length, 0);
if (expected?.branchServiceRecords && allServices.length !== expected.branchServiceRecords) throw new Error(`expected ${expected.branchServiceRecords} services, got ${allServices.length}`);
if (expected?.branchStaffRecords && allStaff.length !== expected.branchStaffRecords) throw new Error(`expected ${expected.branchStaffRecords} staff, got ${allStaff.length}`);
if (expected?.links && links !== expected.links) throw new Error(`expected ${expected.links} relations, got ${links}`);

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
    tagline: localize(passport.brand?.tagline, passport.client.name),
    hours: primary.hours || "10:00–20:00",
    logoSource: passport.brand?.logoSource || "",
    visualAssetsSource: visualBindings.sourceRoot || "",
    heroImage: visualHero,
    welcomeImage: visualHero
  },
  contacts: { ...(passport.contacts || {}), phone: primary.phone || passport.contacts?.phone || "", address: primary.address || "", mapUrl },
  theme: passport.brand?.theme || {},
  featuredServiceIds: allServices.slice(0, 3).map((x) => x.id),
  defaultConsultationServiceId: allServices[0]?.id || "",
  services: finalGroups,
  specialists: selectable,
  ai: passport.integrations?.ai || { enabled: false },
  telegram: passport.integrations?.telegram || { enabled: false },
  cloudflare: passport.integrations?.cloudflare || {}
};
const generatedPath = path.join(clientDir, "clinic.generated.json");
fs.writeFileSync(generatedPath, JSON.stringify(generated, null, 2) + "\n");

const tree = taxonomy.directions.map((direction) => ({
  id: direction.id,
  title: localize(direction.title, direction.id),
  image: direction.image || visualHero,
  subgroups: (direction.subgroups || []).map((subgroup) => ({
    id: subgroup.id,
    title: localize(subgroup.title, subgroup.id),
    image: subgroup.image || direction.image || visualHero,
    groupIds: finalGroups.filter((g) => g.directionId === direction.id && g.subgroupId === subgroup.id).map((g) => g.id)
  })).filter((x) => x.groupIds.length)
})).filter((x) => x.subgroups.length);

const runtime = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  sourcePassport: path.relative(root, passportPath),
  client: passport.client,
  brand: passport.brand,
  contacts: passport.contacts,
  locations: passport.locations,
  dataSources: passport.dataSources,
  networkStats: passport.dataQuality?.networkStats || null,
  catalog: {
    presentationLevel: "subgroup",
    rawCategoriesRenderedDirectly: false,
    specialistsDefineHierarchy: false,
    tree,
    groups: finalGroups,
    services: allServices.map((s) => ({
      id: s.id,
      externalId: s.externalId,
      locationId: s.locationId,
      staffIds: s.staffIds,
      groupId: runtimeService.get(`${String(s.locationId).replace("altegio-", "")}:${s.externalId}`)?.groupId || null,
      rawCategoryId: s.rawCategoryId,
      rawCategoryName: s.rawCategoryName,
      imageInheritedFrom: s.imageInheritedFrom
    }))
  },
  specialists: allStaff,
  integrations: passport.integrations,
  visual: visualBindings
};
fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "client-data.json"), JSON.stringify(runtime, null, 2) + "\n");

const apply = spawnSync(process.execPath, [path.join(root, "scripts", "apply-clinic-config.mjs"), generatedPath], { cwd: root, stdio: "inherit" });
if (apply.status !== 0) process.exit(apply.status || 1);
console.log(`taxonomy-v1: ${taxonomy.directions.length} directions, ${finalGroups.length} branch/subgroups, ${allServices.length} services, ${allStaff.length} staff, ${links} exact relations`);
