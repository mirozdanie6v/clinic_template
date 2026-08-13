import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const passportArg = process.argv[2] || "clients/_template/passport.json";
const manifestPath = path.resolve(root, passportArg);
const fail = (m) => { console.error(`client-v3: ${m}`); process.exit(1); };
if (!fs.existsSync(manifestPath)) fail(`passport not found: ${passportArg}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
let resolved = manifest;
let buildPath = manifestPath;
let tempPath = null;

if (manifest.schemaVersion === 2 && manifest.documents) {
  const clientDir = path.dirname(manifestPath);
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

const builder = resolved.catalog?.autoDiscoverNetwork ? "build-client-exact-network-v2.mjs" : "build-client-routed.mjs";
const build = spawnSync(process.execPath, [path.join(root, "scripts", builder), buildPath], { cwd: root, stdio: "inherit" });
if (build.status !== 0) { if (tempPath) fs.rmSync(tempPath, { force: true }); process.exit(build.status || 1); }

const runtimePath = path.join(root, "public", "client-data.json");
if (fs.existsSync(runtimePath)) {
  const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
  for (const key of ["legal","brandVoice","audiences","social","portfolio","reviews","faq","offers","seo","assets","provenance","dataQuality"]) {
    if (resolved[key] !== undefined) runtime[key] = resolved[key];
  }
  runtime.schemaVersion = resolved.schemaVersion || runtime.schemaVersion;
  runtime.sourcePassport = path.relative(root, manifestPath);
  runtime.documentManifest = manifest.documents || null;
  fs.writeFileSync(runtimePath, JSON.stringify(runtime, null, 2) + "\n");
}
if (tempPath) fs.rmSync(tempPath, { force: true });
console.log(`client-v3: built ${resolved.client?.name || passportArg} via ${builder}`);
