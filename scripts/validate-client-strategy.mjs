import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const passportArg = process.argv[2] || "clients/_template/passport.json";
const passportPath = path.resolve(root, passportArg);
const rulesPath = path.join(root, "quality", "client-strategy-rules.v1.json");
const fail = (message) => { console.error(`client-strategy: ${message}`); process.exit(1); };

if (!fs.existsSync(passportPath)) fail(`passport not found: ${passportArg}`);
if (!fs.existsSync(rulesPath)) fail("rules not found");

const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
if (passport.schemaVersion !== 2 || !passport.documents) fail("Client Passport v2 with documents is required");

const clientDir = path.dirname(passportPath);
const errors = [];
const docs = {};

for (const key of rules.requiredDocuments) {
  const relative = passport.documents[key];
  if (typeof relative !== "string" || !relative) {
    errors.push(`passport.documents.${key} is required`);
    continue;
  }
  if (path.isAbsolute(relative) || relative.includes("..")) {
    errors.push(`${key}: invalid document path`);
    continue;
  }
  const file = path.resolve(clientDir, relative);
  if (!fs.existsSync(file)) {
    errors.push(`${key}: missing ${relative}`);
    continue;
  }
  try {
    docs[key] = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    errors.push(`${key}: invalid JSON in ${relative}`);
  }
}

for (const [docKey, requiredKeys] of Object.entries(rules.requiredTopLevelKeys || {})) {
  const doc = docs[docKey];
  if (!doc) continue;
  for (const key of requiredKeys) {
    if (!(key in doc)) errors.push(`${docKey}: missing top-level key ${key}`);
  }
}

const taxonomy = docs.catalogTaxonomy;
if (taxonomy) {
  const requiredHierarchy = rules.catalogRules?.requiredHierarchy || ["direction", "subgroup", "service"];
  if (JSON.stringify(taxonomy.hierarchy) !== JSON.stringify(requiredHierarchy)) {
    errors.push(`catalogTaxonomy: hierarchy must be ${requiredHierarchy.join(" -> ")}`);
  }
  if (taxonomy.rules?.specialistsDefineHierarchy !== false) errors.push("catalogTaxonomy: specialistsDefineHierarchy must be false");
  if (taxonomy.rules?.rawCatalogMayRenderDirectly !== false) errors.push("catalogTaxonomy: rawCatalogMayRenderDirectly must be false");
  if (!Array.isArray(taxonomy.directions) || !taxonomy.directions.length) errors.push("catalogTaxonomy: directions must not be empty");

  const directionIds = new Set();
  const subgroupIds = new Set();
  const rawCategories = new Map();
  const subgroupImages = new Map();
  for (const direction of taxonomy.directions || []) {
    if (!direction?.id || !direction?.title) errors.push("catalogTaxonomy: direction requires id and title");
    if (!direction?.image) errors.push(`catalogTaxonomy: direction ${direction?.id || "unknown"} requires image`);
    if (directionIds.has(direction?.id)) errors.push(`catalogTaxonomy: duplicate direction id ${direction.id}`);
    else if (direction?.id) directionIds.add(direction.id);
    if (!Array.isArray(direction?.subgroups) || !direction.subgroups.length) errors.push(`catalogTaxonomy: direction ${direction?.id || "unknown"} has no subgroups`);

    for (const subgroup of direction?.subgroups || []) {
      if (!subgroup?.id || !subgroup?.title) errors.push(`catalogTaxonomy: subgroup in ${direction?.id || "unknown"} requires id and title`);
      if (!subgroup?.image) errors.push(`catalogTaxonomy: subgroup ${subgroup?.id || "unknown"} requires image`);
      if (subgroupIds.has(subgroup?.id)) errors.push(`catalogTaxonomy: duplicate subgroup id ${subgroup.id}`);
      else if (subgroup?.id) subgroupIds.add(subgroup.id);
      if (!Array.isArray(subgroup?.rawCategories) || !subgroup.rawCategories.length) errors.push(`catalogTaxonomy: subgroup ${subgroup?.id || "unknown"} requires rawCategories`);

      if (rules.catalogRules?.requireUniqueSubgroupImages && subgroup?.image) {
        const prior = subgroupImages.get(subgroup.image);
        if (prior) errors.push(`catalogTaxonomy: subgroup image reused by ${prior} and ${subgroup.id}: ${subgroup.image}`);
        else subgroupImages.set(subgroup.image, subgroup.id);
      }
      for (const raw of subgroup?.rawCategories || []) {
        const key = String(raw || "").toLocaleLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
        if (!key) continue;
        const prior = rawCategories.get(key);
        if (prior) errors.push(`catalogTaxonomy: raw category ${raw} mapped to both ${prior} and ${subgroup.id}`);
        else rawCategories.set(key, subgroup.id);
      }
    }
  }
}

const imagePlan = docs.imageProductionPlan;
if (imagePlan && Array.isArray(imagePlan.assets)) {
  const seenGroups = new Map();
  const seenPrimaryAssets = new Map();
  for (const asset of imagePlan.assets) {
    if (!asset || typeof asset !== "object") continue;
    if (!asset.id) errors.push("imageProductionPlan: asset without id");
    if (!asset.role) errors.push(`${asset.id || "asset"}: role is required`);
    if (!asset.semanticIntent) errors.push(`${asset.id || "asset"}: semanticIntent is required`);
    if (!asset.artDirection) errors.push(`${asset.id || "asset"}: artDirection is required`);
    if (asset.serviceGroup && asset.primaryForGroup) {
      if (seenGroups.has(asset.serviceGroup)) errors.push(`imageProductionPlan: multiple primary assets for service group ${asset.serviceGroup}`);
      else seenGroups.set(asset.serviceGroup, asset.id);
      if (seenPrimaryAssets.has(asset.id)) errors.push(`imageProductionPlan: primary asset ${asset.id} reused across service groups`);
      else seenPrimaryAssets.set(asset.id, asset.serviceGroup);
    }
  }
}

const business = docs.businessAnalysis;
if (business && Array.isArray(business.facts)) {
  for (const fact of business.facts) {
    if (fact && typeof fact === "object" && !fact.source) errors.push(`businessAnalysis: fact ${fact.id || fact.statement || "unknown"} has no source`);
  }
}

if (errors.length) {
  console.error(`client-strategy: BLOCKED (${errors.length} issues)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`client-strategy: PASS v${rules.version}; ${rules.requiredDocuments.length} strategy documents`);
