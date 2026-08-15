import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const finalMode = args.includes("--final");
const passportArg = args.find((arg) => !arg.startsWith("--")) || "clients/_template/passport.json";
const manifestPath = path.resolve(root, passportArg);

const fail = (message) => {
  console.error(`visual-gate: ${message}`);
  process.exit(1);
};

if (!fs.existsSync(manifestPath)) fail(`passport not found: ${passportArg}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function loadDocument(key) {
  const relative = manifest?.documents?.[key];
  if (!relative) return null;
  if (typeof relative !== "string" || path.isAbsolute(relative) || relative.includes("..")) fail(`invalid document path: ${key}`);
  const docPath = path.resolve(path.dirname(manifestPath), relative);
  if (!fs.existsSync(docPath)) fail(`missing ${key}: ${relative}`);
  return JSON.parse(fs.readFileSync(docPath, "utf8"));
}

const visual = loadDocument("visualDirection");
const audit = loadDocument("assetAudit");

if (!visual && !audit) {
  if (finalMode) fail("final UI build requires visualDirection and assetAudit documents");
  console.log(`visual-gate: legacy passport ${passportArg}; visual audit gate skipped`);
  process.exit(0);
}
if (!visual || !audit) fail("visualDirection and assetAudit must be present together");

const decisions = new Set(["USE", "EDIT", "GENERATE", "REFERENCE", "REJECT"]);
if (visual.status !== "approved") fail(`visualDirection.status must be approved; got ${visual.status || "missing"}`);
if (visual?.gate?.auditComplete !== true) fail("visualDirection.gate.auditComplete must be true");
if (!Array.isArray(audit.items) || audit.items.length === 0) fail("assetAudit.items must contain reviewed source assets");
if (!Array.isArray(audit.productionQueue)) fail("assetAudit.productionQueue must be an array");
if (!["audited", "ready"].includes(audit.status)) fail(`assetAudit.status must be audited or ready; got ${audit.status || "missing"}`);

for (const [index, item] of audit.items.entries()) {
  if (!item?.id || !item?.role) fail(`assetAudit.items[${index}] requires id and role`);
  if (!decisions.has(item.decision)) fail(`assetAudit.items[${index}] has invalid decision ${item.decision}`);
  if (!item.readiness) fail(`assetAudit.items[${index}] requires readiness`);
}
for (const [index, item] of audit.productionQueue.entries()) {
  if (!item?.id || !item?.role || !item?.action) fail(`assetAudit.productionQueue[${index}] requires id, role and action`);
  if (!["USE", "EDIT", "GENERATE"].includes(item.action)) fail(`assetAudit.productionQueue[${index}] has invalid action ${item.action}`);
  if (!item.output && !item.outputDirectory && item.action !== "USE") fail(`assetAudit.productionQueue[${index}] requires output or outputDirectory for ${item.action}`);
}

if (finalMode) {
  if (visual.approvedForUi !== true) fail("visualDirection.approvedForUi must be true for final UI");
  if (visual?.gate?.requiredForFinalUi !== true) fail("visualDirection.gate.requiredForFinalUi must be true");
  if (visual?.gate?.assetProductionComplete !== true) fail("visualDirection.gate.assetProductionComplete must be true for final UI");
  const pending = audit.productionQueue.filter((item) => item.readiness !== "ready");
  if (pending.length) fail(`asset production has ${pending.length} pending output(s): ${pending.slice(0, 5).map((item) => item.id).join(", ")}${pending.length > 5 ? "…" : ""}`);
  const requiredRoles = Array.isArray(audit.requiredRoles) ? audit.requiredRoles : [];
  for (const role of requiredRoles) {
    const readySource = audit.items.some((item) => item.role === role && item.readiness === "ready" && ["USE", "EDIT"].includes(item.decision));
    const readyOutput = audit.productionQueue.some((item) => item.role === role && item.readiness === "ready");
    if (!readySource && !readyOutput) fail(`required visual role is not production-ready: ${role}`);
  }
}

console.log(`visual-gate: ${manifest?.client?.name || passportArg} audit ready${finalMode ? " for final UI" : ""}; reviewed=${audit.items.length}, production=${audit.productionQueue.length}`);
