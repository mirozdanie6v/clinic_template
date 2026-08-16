import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const passportArg = process.argv[2] || "clients/_template/passport.json";

const run = (script, args = []) => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
};

run("build-client-v3.mjs", [passportArg]);
run("apply-catalog-taxonomy-ui.mjs");
