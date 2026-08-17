import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const passportArg = process.argv[2] || "clients/_template/passport.json";
const manifestPath = path.resolve(root, passportArg);
const clientDir = path.dirname(manifestPath);
const fail = (m) => { console.error(`client-v3: ${m}`); process.exit(1); };
if (!fs.existsSync(manifestPath)) fail(`passport not found: ${passportArg}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
let resolved = manifest;
let buildPath = manifestPath;
let tempPath = null;

if (manifest.schemaVersion === 2 && manifest.documents) {
  resolved = { schemaVersion: 2, client: manifest.client };
  for (const [key, relative] of Object.entries(manifest.documents)) {
    if (typeof relative !== "string" || path.isAbsolute(relative) || relative.includes("..")) fail(`invalid document path: ${key}`);
    const docPath = path.resolve(clientDir, relative);
    if (!fs.existsSync(docPath)) fail(`missing document ${key}: ${relative}`);
    resolved[key] = JSON.parse(fs.readFileSync(docPath, "utf8"));
  }
  tempPath = path.join(clientDir, ".passport.resolved.json");
  fs.writeFileSync(tempPath, JSON.stringify(resolved, null, 2) + "\n");
  buildPath = tempPath;
}

const builder = resolved.catalog?.taxonomyMode === "normalized"
  ? "build-client-taxonomy-v1.mjs"
  : resolved.catalog?.autoDiscoverNetwork
    ? "build-client-exact-network-v3.mjs"
    : "build-client-routed.mjs";
const build = spawnSync(process.execPath, [path.join(root, "scripts", builder), buildPath], { cwd: root, stdio: "inherit" });
if (build.status !== 0) { if (tempPath) fs.rmSync(tempPath, { force: true }); process.exit(build.status || 1); }

const theme = resolved.brand?.theme || resolved.theme || {};
const defaults = {
  background: "#F7F5F0",
  surface: "#FFFFFF",
  text: "#20211D",
  muted: "#61645B",
  primary: "#68783C",
  primaryDark: "#4F5E2A",
  accent: "#B7D36B",
};
const cssValue = (key) => String(theme[key] || defaults[key]);
let portfolioPaths = [];
const visualManifestPath = path.join(clientDir, "assets", "visual", "production-manifest.json");
if (fs.existsSync(visualManifestPath)) {
  const visualManifest = JSON.parse(fs.readFileSync(visualManifestPath, "utf8"));
  portfolioPaths = (visualManifest.outputs || [])
    .filter((item) => item.role === "portfolio" && typeof item.path === "string")
    .slice(0, 4)
    .map((item) => `/${path.relative(path.join(clientDir, "assets"), path.resolve(root, item.path)).replaceAll("\\", "/")}`)
    .map((relative) => relative.replace(/^\/visual\//, "/client/visual/"));
}
const aiConfig = resolved.integrations?.ai || resolved.ai || {};
const aiVisible = aiConfig.visible ?? true;
const aiEnabled = aiConfig.enabled ?? false;
const cssUrl = (value) => value ? `url(${JSON.stringify(value)})` : "none";
const themeCss = `:root {\n  --clinic-background: ${cssValue("background")};\n  --clinic-surface: ${cssValue("surface")};\n  --clinic-text: ${cssValue("text")};\n  --clinic-muted: ${cssValue("muted")};\n  --clinic-primary: ${cssValue("primary")};\n  --clinic-primary-dark: ${cssValue("primaryDark")};\n  --clinic-accent: ${cssValue("accent")};\n  --client-portfolio-display: ${portfolioPaths.length ? "block" : "none"};\n  --client-portfolio-1: ${cssUrl(portfolioPaths[0])};\n  --client-portfolio-2: ${cssUrl(portfolioPaths[1])};\n  --client-portfolio-3: ${cssUrl(portfolioPaths[2])};\n  --client-portfolio-4: ${cssUrl(portfolioPaths[3])};\n  --client-ai-display: ${aiVisible ? "flex" : "none"};\n  --client-ai-action-display: ${aiVisible ? "flex" : "none"};\n  --client-nav-columns: ${aiVisible ? 5 : 4};\n  --client-specialist-action-column: ${aiVisible ? "auto" : "1 / -1"};\n}\n`;
fs.writeFileSync(path.join(root, "app", "client-theme.generated.css"), themeCss);

const runtimePath = path.join(root, "public", "client-data.json");
if (fs.existsSync(runtimePath)) {
  const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
  for (const key of ["legal","brandVoice","audiences","social","portfolio","reviews","faq","offers","seo","assets","visualDirection","assetAudit","provenance","dataQuality","quality","catalogTaxonomy"]) {
    if (resolved[key] !== undefined) runtime[key] = resolved[key];
  }
  runtime.schemaVersion = resolved.schemaVersion || runtime.schemaVersion;
  runtime.sourcePassport = path.relative(root, manifestPath);
  runtime.documentManifest = manifest.documents || null;
  fs.writeFileSync(runtimePath, JSON.stringify(runtime, null, 2) + "\n");
}

const strategyProfile = {
  version: 1,
  client: resolved.client || null,
  productStrategy: resolved.productStrategy || null,
  messagingGuide: resolved.messagingGuide || null,
  idealVisualStructure: resolved.idealVisualStructure || null,
  designSystemContract: resolved.designSystemContract || null,
  imageProductionPlan: resolved.imageProductionPlan || null,
  analyticsPlan: resolved.analyticsPlan || null,
};
fs.writeFileSync(path.join(root, "public", "client-strategy.json"), JSON.stringify(strategyProfile, null, 2) + "\n");

if (tempPath) fs.rmSync(tempPath, { force: true });
console.log(`client-v3: built ${resolved.client?.name || passportArg} via ${builder}`);
console.log(`client-v3: theme ${cssValue("primaryDark")} / ${cssValue("background")}, portfolio=${portfolioPaths.length}, ai=${aiVisible ? "visible" : "hidden"}/${aiEnabled ? "enabled" : "disabled"}`);
console.log(`client-v3: strategy profile emitted=${Boolean(resolved.productStrategy && resolved.messagingGuide && resolved.idealVisualStructure)}`);
