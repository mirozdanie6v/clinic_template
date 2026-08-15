import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

export function materializeGeneratedAssets(clientDir) {
  const packPath = path.join(clientDir, "assets", "generated-v2", "asset-pack-v2.gz.b64");
  if (!fs.existsSync(packPath)) return { count: 0, packPath: null };

  const encoded = fs.readFileSync(packPath, "utf8").trim();
  if (!encoded) throw new Error(`generated-assets: empty pack ${packPath}`);

  const payload = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));
  if (payload?.version !== 2 || payload?.format !== "webp" || !payload?.files || typeof payload.files !== "object") {
    throw new Error("generated-assets: invalid v2 pack");
  }

  const visualDir = path.join(clientDir, "assets", "visual");
  fs.mkdirSync(visualDir, { recursive: true });
  let count = 0;

  for (const [fileName, fileBase64] of Object.entries(payload.files)) {
    if (!/^[a-z0-9][a-z0-9._-]*\.webp$/i.test(fileName)) throw new Error(`generated-assets: invalid filename ${fileName}`);
    if (typeof fileBase64 !== "string" || !fileBase64) throw new Error(`generated-assets: missing payload for ${fileName}`);
    const binary = Buffer.from(fileBase64, "base64");
    if (binary.length < 16 || binary.toString("ascii", 0, 4) !== "RIFF" || binary.toString("ascii", 8, 12) !== "WEBP") {
      throw new Error(`generated-assets: ${fileName} is not a valid WebP payload`);
    }
    fs.writeFileSync(path.join(visualDir, fileName), binary);
    count += 1;
  }

  return { count, packPath };
}
