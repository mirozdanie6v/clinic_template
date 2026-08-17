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

const visualBindings = passport.assetAudit?.runtimeBindings || {};
const visualHero = visualBindings.hero || passport.brand?.images?.hero || "/client/hero.webp";
const portraitFor = (person) => {
  if (visualBindings.specialistDirectory && person.branch && person.id != null) {
    return `${String(visualBindings.specialistDirectory).replace(/\/$/, "")}/${person.branch}-${person.id}.webp`;
  }
  return person.avatar || person.avatarSmall || visualHero;
};

const taxonomy = passport.catalogTaxonomy;
if (!taxonomy || taxonomy.status !== "approved") throw new Error("exact-network-v3: approved catalogTaxonomy is required");
if (JSON.stringify(taxonomy.hierarchy) !== JSON.stringify(["direction", "subgroup", "service"])) {
  throw new Error("exact-network-v3: catalog hierarchy must be direction -> subgroup -> service");
}
if (taxonomy.rules?.specialistsDefineHierarchy !== false) {
  throw new Error("exact-network-v3: specialists must not define catalog hierarchy");
}

const excludedCategoryNames = new Set((taxonomy.excludeRawCategories || []).map((x) => normalize(x?.match)));
const categoryToTaxonomy = new Map();
const subgroupById = new Map();
const directions = [];
for (const direction of taxonomy.directions || []) {
  if (!direction?.id || !direction?.title || !direction?.image) throw new Error("exact-network-v3: every direction requires id, title and image");
  const runtimeDirection = { id: direction.id, title: localize(direction.title, direction.id), image: direction.image };
  directions.push(runtimeDirection);
  for (const subgroup of direction.subgroups || []) {
    if (!subgroup?.id || !subgroup?.title || !subgroup?.image || !Array.isArray(subgroup.rawCategories) || !subgroup.rawCategories.length) {
      throw new Error(`exact-network-v3: invalid subgroup in ${direction.id}`);
    }
    if (subgroupById.has(subgroup.id)) throw new Error(`exact-network-v3: duplicate subgroup id ${subgroup.id}`);
    const record = {
      id: subgroup.id,
      title: localize(subgroup.title, subgroup.id),
      image: subgroup.image,
      directionId: direction.id,
      directionTitle: runtimeDirection.title,
      directionImage: runtimeDirection.image,
    };
    subgroupById.set(subgroup.id, record);
    for (const rawCategory of subgroup.rawCategories) {
      const key = normalize(rawCategory);
      if (categoryToTaxonomy.has(key)) throw new Error(`exact-network-v3: raw category mapped twice: ${rawCategory}`);
      categoryToTaxonomy.set(key, record);
    }
  }
}
if (!directions.length || !subgroupById.size) throw new Error("exact-network-v3: catalogTaxonomy has no directions/subgroups");

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

const expected = passport.dataQuality?.networkStats?.total;
const rawServiceCount = services.size;
const rawStaffCount = staff.size;
const rawLinks = [...staff.values()].reduce((sum, p) => sum + (p.serviceIds || []).length, 0);
if (expected?.branchServiceRecords && rawServiceCount !== expected.branchServiceRecords) throw new Error(`expected ${expected.branchServiceRecords} raw services, got ${rawServiceCount}`);
if (expected?.branchStaffRecords && rawStaffCount !== expected.branchStaffRecords) throw new Error(`expected ${expected.branchStaffRecords} raw staff, got ${rawStaffCount}`);
if (expected?.links && rawLinks !== expected.links) throw new Error(`expected ${expected.links} raw relations, got ${rawLinks}`);

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
const unmappedRawCategories = new Set();
let excludedServices = 0;

for (const s of services.values()) {
  const category = categories.get(`${s.locationId}:${s.categoryId ?? "other"}`);
  const rawCategoryName = category?.name || category?.title || s.category || "Other";
  const normalizedCategory = normalize(rawCategoryName);

  if (excludedCategoryNames.has(normalizedCategory)) {
    excludedServices += 1;
    continue;
  }

  const tax = categoryToTaxonomy.get(normalizedCategory);
  if (!tax) {
    unmappedRawCategories.add(rawCategoryName);
    continue;
  }

  const groupId = `catalog-${s.locationId}-${tax.id}`;
  const serviceId = `altegio-service-${s.locationId}-${s.id}`;
  if (!groups.has(groupId)) {
    groups.set(groupId, {
      id: groupId,
      taxonomyId: tax.id,
      directionId: tax.directionId,
      directionTitle: tax.directionTitle,
      directionImage: tax.directionImage,
      title: tax.title,
      note: localize(""),
      image: tax.image,
      items: [],
    });
  }

  const minutes = Number(s.durationMinutes || 0);
  const externalStaffIds = externalStaffFor(s);
  const staffIds = externalStaffIds.map((id) => `altegio-staff-${s.locationId}-${id}`);
  const item = {
    id: serviceId,
    name: localize(s.name, serviceId),
    price: localize(money(s)),
    desc: minutes ? { ru: `${minutes} мин`, en: `${minutes} min`, vi: `${minutes} phút` } : localize(""),
    image: tax.image,
    inheritedImageFromGroup: true,
    staffIds,
    locationId: `altegio-${s.locationId}`,
    externalId: s.id,
    rawCategory: rawCategoryName,
  };
  groups.get(groupId).items.push(item);
  runtimeService.set(`${s.locationId}:${s.id}`, { serviceId, groupId });
}

if (unmappedRawCategories.size && taxonomy.strictCoverage !== false) {
  throw new Error(`exact-network-v3: unmapped raw catalog categories: ${[...unmappedRawCategories].sort().join(" | ")}`);
}

const finalGroups = [...groups.values()]
  .filter((g) => g.items.length)
  .map((group) => {
    const first = group.items[0];
    const location = first ? locationByExternal.get(String(first.locationId).replace("altegio-", "")) : null;
    const branchName = location?.name || location?.publicName || "";
    const count = group.items.length;
    return {
      ...group,
      note: {
        ru: `${count} ${count === 1 ? "услуга" : count < 5 ? "услуги" : "услуг"}${branchName ? ` · ${branchName}` : ""}`,
        en: `${count} service${count === 1 ? "" : "s"}${branchName ? ` · ${branchName}` : ""}`,
        vi: `${count} dịch vụ${branchName ? ` · ${branchName}` : ""}`,
      },
    };
  })
  .sort((a, b) => {
    const da = directions.findIndex((d) => d.id === a.directionId);
    const db = directions.findIndex((d) => d.id === b.directionId);
    if (da !== db) return da - db;
    const sa = (taxonomy.directions.find((d) => d.id === a.directionId)?.subgroups || []).findIndex((s) => s.id === a.taxonomyId);
    const sb = (taxonomy.directions.find((d) => d.id === b.directionId)?.subgroups || []).findIndex((s) => s.id === b.taxonomyId);
    return sa - sb;
  });

const allServices = finalGroups.flatMap((g) => g.items);
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
    sourcePortrait: p.avatar || p.avatarSmall || null,
  });
}
const selectable = allStaff.filter((p) => p.bookable && p.serviceIds.length);

const primary = passport.locations.find((x) => x.primary) || passport.locations[0] || {};
const mapUrl = primary.mapUrl || (primary.lat != null && primary.lon != null ? `https://www.google.com/maps/dir/?api=1&destination=${primary.lat},${primary.lon}` : "");
const featuredServiceIds = finalGroups.slice(0, 3).map((group) => group.items[0]?.id).filter(Boolean);
const generated = {
  schemaVersion: 2,
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
    welcomeImage: visualHero,
  },
  contacts: { ...(passport.contacts || {}), phone: primary.phone || passport.contacts?.phone || "", address: primary.address || "", mapUrl },
  theme: passport.brand?.theme || {},
  featuredServiceIds,
  defaultConsultationServiceId: featuredServiceIds[0] || allServices[0]?.id || "",
  catalogDirections: directions,
  services: finalGroups,
  specialists: selectable,
  ai: passport.integrations?.ai || { enabled: false },
  telegram: passport.integrations?.telegram || { enabled: false },
  cloudflare: passport.integrations?.cloudflare || {},
};

const generatedPath = path.join(clientDir, "clinic.generated.json");
fs.writeFileSync(generatedPath, JSON.stringify(generated, null, 2) + "\n");

const runtime = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  sourcePassport: path.relative(root, passportPath),
  client: passport.client,
  brand: passport.brand,
  contacts: passport.contacts,
  locations: passport.locations,
  dataSources: passport.dataSources,
  networkStats: passport.dataQuality?.networkStats || null,
  catalog: {
    hierarchy: taxonomy.hierarchy,
    directions,
    groups: finalGroups,
    services: allServices.map((s) => ({
      id: s.id,
      externalId: s.externalId,
      locationId: s.locationId,
      staffIds: s.staffIds,
      groupId: runtimeService.get(`${String(s.locationId).replace("altegio-", "")}:${s.externalId}`)?.groupId || null,
      inheritedImageFromGroup: true,
    })),
    excludedServices,
  },
  specialists: allStaff,
  integrations: passport.integrations,
  visual: visualBindings,
};
fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "client-data.json"), JSON.stringify(runtime, null, 2) + "\n");

const apply = spawnSync(process.execPath, [path.join(root, "scripts", "apply-clinic-config.mjs"), generatedPath], { cwd: root, stdio: "inherit" });
if (apply.status !== 0) process.exit(apply.status || 1);

console.log(`exact-network-v3: raw=${rawServiceCount} services / ${rawStaffCount} staff / ${rawLinks} relations`);
console.log(`exact-network-v3: normalized=${directions.length} directions / ${finalGroups.length} location-subgroups / ${allServices.length} visible services / ${selectable.length} selectable specialists / excluded=${excludedServices}`);
