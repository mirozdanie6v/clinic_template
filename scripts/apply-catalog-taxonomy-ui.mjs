import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runtimePath = path.join(root, "public", "client-data.json");
if (!fs.existsSync(runtimePath)) {
  console.log("catalog-ui: no runtime; skipped");
  process.exit(0);
}
const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
if (JSON.stringify(runtime?.catalog?.hierarchy || []) !== JSON.stringify(["direction", "subgroup", "service"])) {
  console.log("catalog-ui: runtime has no normalized taxonomy; skipped");
  process.exit(0);
}

const target = path.join(root, "app", "production-v1.tsx");
if (!fs.existsSync(target)) throw new Error("catalog-ui: app/production-v1.tsx not found");

let source = fs.readFileSync(target, "utf8");
const alreadyApplied = source.includes("catalog-direction-grid");

const replaceOnce = (before, after, label) => {
  if (!source.includes(before)) throw new Error(`catalog-ui: marker not found: ${label}`);
  source = source.replace(before, after);
};

if (!alreadyApplied) {
replaceOnce(
  'type ServiceGroup = { id: string; title: Localized; note: Localized; image: string; items: ServiceItem[] };',
  'type ServiceGroup = { id: string; taxonomyId?: string; directionId?: string; directionTitle?: Localized; directionImage?: string; title: Localized; note: Localized; image: string; items: ServiceItem[] };',
  "ServiceGroup type"
);

replaceOnce(
  '  const [openGroup, setOpenGroup] = useState("");',
  '  const [openGroup, setOpenGroup] = useState("");\n  const [selectedDirectionId, setSelectedDirectionId] = useState("");',
  "selectedDirectionId state"
);

replaceOnce(
  '  const featured = groupsForLocation.flatMap((group) => group.items).slice(0, 3);',
  '  const featured = groupsForLocation.slice(0, 3).map((group) => group.items[0]).filter(Boolean) as ServiceItem[];',
  "featured subgroup coverage"
);

const groupsBlock = `  const groupsForLocation = useMemo(() => {
    if (!selectedLocationId || selectedLocationId === "default") return serviceGroups;
    return serviceGroups.filter((group) => group.items.some((item) => item.locationId === selectedLocationId));
  }, [selectedLocationId, serviceGroups]);`;
const groupsReplacement = `${groupsBlock}
  const directionsForLocation = useMemo(() => {
    const seen = new Map<string, { id: string; title: Localized; image: string; subgroupCount: number }>();
    for (const group of groupsForLocation) {
      const id = group.directionId || group.id;
      const current = seen.get(id);
      if (current) current.subgroupCount += 1;
      else seen.set(id, {
        id,
        title: group.directionTitle || group.title,
        image: group.directionImage || group.image,
        subgroupCount: 1,
      });
    }
    return [...seen.values()];
  }, [groupsForLocation]);
  const activeDirectionId = selectedDirectionId && directionsForLocation.some((item) => item.id === selectedDirectionId)
    ? selectedDirectionId
    : directionsForLocation[0]?.id || "";
  const groupsForDirection = groupsForLocation.filter((group) => (group.directionId || group.id) === activeDirectionId);`;
replaceOnce(groupsBlock, groupsReplacement, "catalog direction derivation");

const effectBlock = `  useEffect(() => {
    if (!openGroup || !groupsForLocation.some((group) => group.id === openGroup)) setOpenGroup(groupsForLocation[0]?.id || "");
  }, [selectedLocationId, groupsForLocation, openGroup]);`;
const effectReplacement = `${effectBlock}

  useEffect(() => {
    if (!directionsForLocation.length) {
      if (selectedDirectionId) setSelectedDirectionId("");
      return;
    }
    if (!selectedDirectionId || !directionsForLocation.some((item) => item.id === selectedDirectionId)) {
      setSelectedDirectionId(directionsForLocation[0].id);
    }
  }, [selectedLocationId, directionsForLocation, selectedDirectionId]);`;
replaceOnce(effectBlock, effectReplacement, "direction selection effect");

const servicesPattern = /  function Services\(\) \{\n[\s\S]*?\n  \}\n\n  function Specialists\(\) \{/;
if (!servicesPattern.test(source)) throw new Error("catalog-ui: Services() block not found");
const servicesBlock = `  function Services() {
    const activeDirection = directionsForLocation.find((item) => item.id === activeDirectionId);
    return <section><LocationSwitcher /><p className="lead-text">{t.services.subtitle}</p>{groupsForLocation.length ? <>
      <div className="catalog-direction-grid">{directionsForLocation.map((direction) => <button key={direction.id} className={\`catalog-direction-card \${direction.id === activeDirectionId ? "active" : ""}\`} onClick={() => { setSelectedDirectionId(direction.id); const first = groupsForLocation.find((group) => (group.directionId || group.id) === direction.id); setOpenGroup(first?.id || ""); }}><span className="catalog-direction-image" style={{ backgroundImage: \`url(\${asset(direction.image)})\` }} /><span className="catalog-direction-copy"><b>{direction.title[lang]}</b><small>{direction.subgroupCount} {lang === "ru" ? "раздела" : lang === "vi" ? "nhóm" : "groups"}</small></span></button>)}</div>
      {activeDirection && <div className="catalog-path"><span>{activeDirection.title[lang]}</span><small>{groupsForDirection.length} {lang === "ru" ? "подгрупп" : lang === "vi" ? "nhóm dịch vụ" : "service groups"}</small></div>}
      <div className="accordion-list">{groupsForDirection.map((group) => <article className="service-group" key={group.id}><button className="group-header" onClick={() => setOpenGroup(openGroup === group.id ? "" : group.id)}><span className="group-thumb" style={{ backgroundImage: \`url(\${asset(group.image)})\` }} /><span><b>{group.title[lang]}</b><small>{group.note[lang]}</small></span><i>{openGroup === group.id ? "⌃" : "⌄"}</i></button>{openGroup === group.id && <div className="group-items">{group.items.map((item) => <button key={item.id} onClick={() => setDetail(item)}><span><b>{item.name[lang]}</b><small>{item.desc[lang]}</small></span><strong>{item.price[lang]}</strong></button>)}</div>}</article>)}</div>
    </> : <div className="empty-state">{c.noServices}</div>}</section>;
  }

  function Specialists() {`;
source = source.replace(servicesPattern, servicesBlock);

source = source.replace(
  '<div className="choice-group-title">{group.title[lang]}</div>',
  '<div className="choice-group-title"><small>{group.directionTitle?.[lang]}</small>{group.title[lang]}</div>'
);
source = source.replace(
  '<span className="choice-thumb" style={{ backgroundImage: `url(${asset(item.image)})` }} />',
  ''
);

  fs.writeFileSync(target, source);
  console.log("catalog-ui: applied direction -> subgroup -> service presentation");
} else {
  console.log("catalog-ui: taxonomy UI already applied");
}

const cssPath = path.join(root, "app", "production-v2.css");
const cssMarker = "/* Catalog taxonomy UI */";
if (fs.existsSync(cssPath)) {
  let css = fs.readFileSync(cssPath, "utf8");
  if (!css.includes(cssMarker)) {
    css += `

${cssMarker}
.catalog-direction-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 20px}
.catalog-direction-card{position:relative;min-height:168px;padding:0;border:1px solid var(--ui-line);border-radius:22px;overflow:hidden;background:var(--clinic-surface);text-align:left;box-shadow:var(--ui-shadow-soft)}
.catalog-direction-card.active{border-color:var(--clinic-primary-dark);box-shadow:0 10px 28px rgba(38,39,31,.12)}
.catalog-direction-image{display:block;width:100%;aspect-ratio:4/3;background-size:cover;background-position:center;background-color:var(--clinic-background)}
.catalog-direction-copy{display:flex;flex-direction:column;gap:4px;padding:12px 13px 13px}
.catalog-direction-copy b{font-size:13px;line-height:1.2}
.catalog-direction-copy small{color:var(--clinic-muted);font-size:8px;line-height:1.3}
.catalog-path{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:0 2px 10px;padding-top:4px}
.catalog-path span{font:500 26px/1.05 var(--font-display);letter-spacing:-.03em}
.catalog-path small{max-width:38%;color:var(--clinic-muted);font-size:8px;text-align:right}
.choice-group-title{display:flex;flex-direction:column;gap:3px}
.choice-group-title small{color:var(--clinic-muted);font-size:7px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.choice-button .choice-copy{padding-left:2px}
@media(max-width:360px){.catalog-direction-grid{grid-template-columns:1fr 1fr;gap:8px}.catalog-direction-card{min-height:150px}.catalog-direction-copy{padding:10px}.catalog-direction-copy b{font-size:12px}}
`;
    fs.writeFileSync(cssPath, css);
    console.log("catalog-ui: appended taxonomy styles");
  }
}
