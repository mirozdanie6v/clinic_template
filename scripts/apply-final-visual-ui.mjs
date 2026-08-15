import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "app", "production-v1.tsx");
if (!fs.existsSync(file)) throw new Error("final-visual-ui: app/production-v1.tsx not found");
let source = fs.readFileSync(file, "utf8");

const oldFeatured = '  const featured = groupsForLocation.flatMap((group) => group.items).slice(0, 3);';
const newFeatured = `  const featured = (() => {
    const seen = new Set<string>();
    const result: ServiceItem[] = [];
    for (const group of groupsForLocation) {
      const key = group.image || group.title.ru || group.id;
      if (seen.has(key) || !group.items[0]) continue;
      seen.add(key);
      result.push(group.items[0]);
      if (result.length === 3) break;
    }
    return result;
  })();`;
if (source.includes(oldFeatured)) source = source.replace(oldFeatured, newFeatured);
else if (!source.includes("const seen = new Set<string>();")) throw new Error("final-visual-ui: featured services anchor not found");

fs.writeFileSync(file, source);
console.log("final-visual-ui: balanced featured services enabled");
