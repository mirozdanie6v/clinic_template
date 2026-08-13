import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const arg = process.argv[2] || "clients/evo/passport.json";
const manifestPath = path.resolve(root, arg);
const fail = (m) => { console.error(`source-sync: ${m}`); process.exit(1); };
if (!fs.existsSync(manifestPath)) fail(`passport not found: ${arg}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
let buildPath = manifestPath;
let tempPath = null;
if (manifest.schemaVersion === 2 && manifest.documents) {
  const dir = path.dirname(manifestPath);
  const integrations = JSON.parse(fs.readFileSync(path.resolve(dir, manifest.documents.integrations), "utf8"));
  const catalog = JSON.parse(fs.readFileSync(path.resolve(dir, manifest.documents.catalog), "utf8"));
  tempPath = path.join(dir, ".source-sync.resolved.json");
  fs.writeFileSync(tempPath, JSON.stringify({ schemaVersion: 2, client: manifest.client, integrations, catalog }, null, 2) + "\n");
  buildPath = tempPath;
}
const run = spawnSync(process.execPath, [path.join(root, "tools", "sync-altegio-catalog.mjs"), buildPath], { cwd: root, stdio: "inherit" });
if (tempPath) fs.rmSync(tempPath, { force: true });
if (run.status !== 0) process.exit(run.status || 1);
