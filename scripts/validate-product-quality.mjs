import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
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

if (failures.length) {
  console.error(`product-quality: BLOCKED (${failures.length} rule failures)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`product-quality: PASS v${rules.version}; ${rules.blockingChecks.length} automated rules`);
console.log(`product-quality: manual runtime gates=${(rules.manualGates || []).length}`);
