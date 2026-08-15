import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configArg = process.argv[2] || "clients/_template/clinic.json";
const configPath = path.resolve(root, configArg);
const fail = (message) => { console.error(`clinic-template: ${message}`); process.exit(1); };
if (!fs.existsSync(configPath)) fail(`config not found: ${configArg}`);

const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
const clinic = cfg.clinic || {};
const services = Array.isArray(cfg.services) ? cfg.services : [];
const specialists = Array.isArray(cfg.specialists) ? cfg.specialists : [];
const locales = ["ru", "en", "vi"];
const localized = (value, label) => locales.forEach((locale) => { if (!value?.[locale]) fail(`${label}.${locale} is required`); });

for (const key of ["slug", "name", "shortName", "brandLine", "city"]) if (!clinic[key]) fail(`clinic.${key} is required`);
if (!services.length) fail("services[] must contain at least one group");
if (!specialists.length) fail("specialists[] must contain at least one specialist");

const groupIds = new Set();
const serviceIds = new Set();
services.forEach((group, groupIndex) => {
  if (!group.id) fail(`services[${groupIndex}].id is required`);
  if (groupIds.has(group.id)) fail(`duplicate service group id: ${group.id}`);
  groupIds.add(group.id);
  localized(group.title, `services[${groupIndex}].title`);
  if (!Array.isArray(group.items) || !group.items.length) fail(`services[${groupIndex}].items must not be empty`);
  group.items.forEach((item, itemIndex) => {
    if (!item.id) fail(`services[${groupIndex}].items[${itemIndex}].id is required`);
    if (serviceIds.has(item.id)) fail(`duplicate service id: ${item.id}`);
    serviceIds.add(item.id);
    localized(item.name, `service ${item.id}.name`);
    localized(item.price, `service ${item.id}.price`);
  });
});

const specialistIds = new Set();
specialists.forEach((person, index) => {
  if (!person.id) fail(`specialists[${index}].id is required`);
  if (specialistIds.has(person.id)) fail(`duplicate specialist id: ${person.id}`);
  specialistIds.add(person.id);
  localized(person.name, `specialist ${person.id}.name`);
  localized(person.role, `specialist ${person.id}.role`);
  if (!Array.isArray(person.serviceGroups) || !person.serviceGroups.length) fail(`specialist ${person.id}.serviceGroups must not be empty`);
  person.serviceGroups.forEach((groupId) => { if (!groupIds.has(groupId)) fail(`specialist ${person.id} references unknown group ${groupId}`); });
});

const featured = Array.isArray(cfg.featuredServiceIds) && cfg.featuredServiceIds.length ? cfg.featuredServiceIds : [...serviceIds].slice(0, 3);
featured.forEach((id) => { if (!serviceIds.has(id)) fail(`featuredServiceIds references unknown service ${id}`); });
const consultation = cfg.defaultConsultationServiceId || featured[0] || [...serviceIds][0];
if (!serviceIds.has(consultation)) fail("defaultConsultationServiceId must reference an existing service");

const publicClientDir = path.join(root, "public", "client");
fs.mkdirSync(publicClientDir, { recursive: true });

let logo = "/client/logo.png";
if (clinic.logoSource) {
  const source = path.resolve(root, clinic.logoSource);
  if (fs.existsSync(source)) {
    const ext = path.extname(source).toLowerCase() || ".png";
    fs.copyFileSync(source, path.join(publicClientDir, `logo${ext}`));
    logo = `/client/logo${ext}`;
  } else console.warn(`clinic-template: logoSource not found yet: ${clinic.logoSource}`);
}

if (clinic.visualAssetsSource) {
  const visualSource = path.resolve(root, clinic.visualAssetsSource);
  const visualDestination = path.join(publicClientDir, "visual");
  if (!fs.existsSync(visualSource) || !fs.statSync(visualSource).isDirectory()) fail(`visualAssetsSource not found: ${clinic.visualAssetsSource}`);
  fs.rmSync(visualDestination, { recursive: true, force: true });
  fs.cpSync(visualSource, visualDestination, { recursive: true });
  console.log(`clinic-template: published visual assets from ${clinic.visualAssetsSource}`);
}

const runtimeClinic = {
  slug: clinic.slug,
  name: clinic.name,
  shortName: clinic.shortName,
  brandLine: clinic.brandLine,
  city: clinic.city,
  hours: clinic.hours || "9:00–20:00",
  tagline: clinic.tagline || { ru: clinic.name, en: clinic.name, vi: clinic.name },
  logo,
  heroImage: clinic.heroImage || "/client/hero.webp",
  welcomeImage: clinic.welcomeImage || clinic.heroImage || "/client/hero.webp",
  contacts: cfg.contacts || {},
  featuredServiceIds: featured,
  defaultConsultationServiceId: consultation,
  theme: cfg.theme || {},
};

const appDataPath = path.join(root, "app-data.js");
if (!fs.existsSync(appDataPath)) fail("app-data.js not found");
let source = fs.readFileSync(appDataPath, "utf8");
const replace = (regex, replacement, label) => {
  if (!regex.test(source)) fail(`app-data marker not found: ${label}`);
  regex.lastIndex = 0;
  source = source.replace(regex, replacement);
};
replace(/export const clinicDefaults = \{[\s\S]*?\};\n\nexport const services =/, `export const clinicDefaults = ${JSON.stringify(runtimeClinic, null, 2)};\n\nexport const services =`, "clinicDefaults");
replace(/export const services = \[[\s\S]*?\];\n\nexport const specialists =/, `export const services = ${JSON.stringify(services, null, 2)};\n\nexport const specialists =`, "services");
replace(/export const specialists = \[[\s\S]*?\];\n\nexport const translations =/, `export const specialists = ${JSON.stringify(specialists, null, 2)};\n\nexport const translations =`, "specialists");
fs.writeFileSync(appDataPath, source);

const state = {
  generatedAt: new Date().toISOString(),
  sourceConfig: path.relative(root, configPath),
  clinic: { slug: clinic.slug, name: clinic.name, city: clinic.city },
  counts: { groups: services.length, services: serviceIds.size, specialists: specialists.length },
  integrations: { telegram: Boolean(cfg.telegram?.enabled), ai: Boolean(cfg.ai?.enabled), cloudflare: Boolean(cfg.cloudflare?.workerName) },
  visualAssets: Boolean(clinic.visualAssetsSource),
};
fs.writeFileSync(path.join(root, ".clinic-applied.json"), `${JSON.stringify(state, null, 2)}\n`);
console.log(`clinic-template: applied ${clinic.name} (${clinic.slug})`);
console.log(`clinic-template: ${serviceIds.size} services, ${specialists.length} specialists`);
