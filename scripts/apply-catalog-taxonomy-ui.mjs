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
if (source.includes("catalog-direction-grid")) {
  console.log("catalog-ui: taxonomy UI already applied");
  process.exit(0);
}

const replaceOnce = (before, after, label) => {
  if (!source.includes(before)) throw new Error(`catalog-ui: marker not found: ${label}`);
  source = source.replace(before, after);
};

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
