import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const passportArg = process.argv[2] || "clients/_template/passport.json";

const validate = spawnSync(process.execPath, [path.join(root, "scripts", "validate-visual-readiness.mjs"), passportArg, "--final"], { cwd: root, stdio: "inherit" });
if (validate.status !== 0) process.exit(validate.status || 1);

const build = spawnSync(process.execPath, [path.join(root, "scripts", "build-client-v3.mjs"), passportArg], { cwd: root, stdio: "inherit" });
process.exit(build.status || 0);
