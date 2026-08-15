import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const passportArg = process.argv[2] || null;
const rulesPath = path.join(root, "quality", "miniapp-rules.v1.json");
if (!fs.existsSync(rulesPath)) throw new Error("product-quality: rules file missing");

const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
const failures = [];

for (const check of rules.blockingChecks || []) {
  const file = path.join(root, check.file);
  if (!fs.existsSync(file)) {
    failures.push(`${check.id}: missing ${check.file}`);
    continue;
  }
  const source = fs.readFileSync(file, "utf8");
  for (const needle of check.includesAll || []) {
    if (!source.includes(needle)) failures.push(`${check.id}: ${check.file} missing ${JSON.stringify(needle)}`);
  }
  for (const needle of check.excludesAll || []) {
    if (source.includes(needle)) failures.push(`${check.id}: ${check.file} contains forbidden ${JSON.stringify(needle)}`);
  }
}

let clientName = "shared-template";
if (passportArg) {
  const passportPath = path.resolve(root, passportArg);
  if (!fs.existsSync(passportPath)) failures.push(`client-quality-scope: passport missing ${passportArg}`);
  else {
    const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
    clientName = passport.client?.name || passport.client?.slug || passportArg;
    const qualityRelative = passport.documents?.quality;
    if (!qualityRelative) failures.push("client-quality-scope: passport.documents.quality is required");
    else {
      const qualityPath = path.resolve(path.dirname(passportPath), qualityRelative);
      if (!fs.existsSync(qualityPath)) failures.push(`client-quality-scope: missing ${qualityRelative}`);
      else {
        const quality = JSON.parse(fs.readFileSync(qualityPath, "utf8"));
        if (quality.contractVersion !== rules.version) failures.push(`client-quality-scope: contractVersion must be ${rules.version}`);
        for (const gate of ["productQa", "runtimeAcceptance", "postDeploySmoke"]) {
          if (quality.releaseGates?.[gate] !== true) failures.push(`client-quality-scope: releaseGates.${gate} must be true`);
        }
        for (const width of [320, 360, 390, 430]) {
          if (!(quality.viewports || []).includes(width)) failures.push(`client-quality-scope: viewport ${width}px is required`);
        }
        for (const language of passport.client?.languages || []) {
          if (!(quality.languages || []).includes(language)) failures.push(`client-quality-scope: missing language ${language}`);
        }
        if (!Array.isArray(quality.journeys) || quality.journeys.length === 0) failures.push("client-quality-scope: journeys must be declared");
        if (!Array.isArray(quality.regressions)) failures.push("client-quality-scope: regressions array is required");
        if (!Array.isArray(quality.acceptedExceptions)) failures.push("client-quality-scope: acceptedExceptions array is required");
      }
    }
  }
}

if (failures.length) {
  console.error(`product-quality: BLOCKED (${failures.length} rule failures)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`product-quality: PASS v${rules.version}; client=${clientName}; automated=${rules.blockingChecks.length}`);
console.log(`product-quality: manual runtime gates=${(rules.manualGates || []).length}`);
