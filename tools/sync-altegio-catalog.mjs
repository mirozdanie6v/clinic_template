import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const passportArg = process.argv[2] || "clients/evo/passport.json";
const passportPath = path.resolve(root, passportArg);
const fail = (message) => { console.error(`altegio-sync: ${message}`); process.exit(1); };
if (!fs.existsSync(passportPath)) fail(`passport not found: ${passportArg}`);

const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
const booking = passport.integrations?.booking;
if (!booking?.enabled || booking.provider !== "altegio") {
  console.log(`altegio-sync: ${passport.client?.slug || passportArg} skipped`);
  process.exit(0);
}

const formId = Number(booking.bookingFormId);
const companyId = Number(booking.companyId);
if (!formId || !companyId || !booking.publicUrl) fail("Altegio booking settings are incomplete");
const publicUrl = new URL(booking.publicUrl);
if (publicUrl.protocol !== "https:" || !/(^|\.)alteg\.io$/i.test(publicUrl.hostname)) fail("publicUrl must be an HTTPS Altegio domain");
const api = `${publicUrl.origin}/api/v1`;
const headers = { Accept: "application/json", "Content-Type": "application/json" };

async function getJson(relative) {
  const response = await fetch(`${api}/${relative}`, { headers });
  if (!response.ok) throw new Error(`GET ${relative} -> ${response.status}`);
  return response.json();
}
async function postJson(relative, body) {
  const response = await fetch(`${api}/${relative}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`POST ${relative} -> ${response.status}`);
  return response.json();
}

const [form, company, catalog, rawStaff, searchServices] = await Promise.all([
  getJson(`bookform/${formId}/`),
  getJson(`company/${companyId}?forBooking=1&bookform_id=${formId}&include=has_cashback`),
  getJson(`book_services/${companyId}?without_seances=1`),
  getJson(`book_staff/${companyId}?datetime=&without_seances=1`),
  postJson("booking/search/services/", {
    context: { location_id: companyId },
    filter: { datetime: null, records: [{ staff_id: null, attendance_service_items: [] }] }
  })
]);

const searchByServiceId = new Map((searchServices.data || []).map((item) => [Number(item.id), item.attributes || {}]));
const categories = (catalog.category || []).map((item) => ({ id: Number(item.id), name: item.title, weight: item.weight ?? 0 }));
const categoryById = new Map(categories.map((item) => [item.id, item.name]));
const services = (catalog.services || []).map((item) => {
  const search = searchByServiceId.get(Number(item.id)) || {};
  const durationSeconds = Number(search.duration ?? item.seance_length ?? 0) || null;
  return {
    id: Number(item.id), categoryId: Number(item.category_id), category: categoryById.get(Number(item.category_id)) || "Other",
    name: item.title, priceMinRaw: Number(search.price_min ?? item.price_min ?? 0),
    priceMaxRaw: Number(search.price_max ?? item.price_max ?? item.price_min ?? 0), currency: company.currency_short_title || "",
    durationSeconds, durationMinutes: durationSeconds ? Math.round(durationSeconds / 60) : null,
    bookable: search.is_bookable ?? Boolean(item.active), bookableStatus: search.bookable_status ?? null,
    comment: item.comment || null, image: item.image || null
  };
});

const staff = [];
for (const person of rawStaff || []) {
  let serviceIds = [];
  try {
    const filtered = await postJson("booking/search/services/", {
      context: { location_id: companyId },
      filter: { datetime: null, records: [{ staff_id: Number(person.id), attendance_service_items: [] }] }
    });
    serviceIds = (filtered.data || []).map((item) => Number(item.id));
  } catch (error) {
    console.warn(`altegio-sync: staff ${person.id} mapping failed: ${error.message}`);
  }
  staff.push({
    id: Number(person.id), name: person.name, specialization: person.specialization || person.position?.title || null,
    bookable: Boolean(person.bookable), scheduleTill: person.schedule_till || null,
    avatar: person.avatar_big || person.image_group?.images?.origin?.path || person.avatar || null,
    avatarSmall: person.avatar || null, rating: person.rating ?? null, votesCount: person.votes_count ?? null, serviceIds
  });
}

let chainLocations = [];
if (form.group_id) {
  try {
    const chain = await getJson(`booking/chains/${form.group_id}/locations/?include[]=city&bookform_id=${formId}`);
    chainLocations = (chain.data || []).map((item) => ({
      id: Number(item.id), title: item.attributes?.title || "", publicTitle: item.attributes?.company_title || item.attributes?.title || "",
      address: item.attributes?.address || "", lat: item.attributes?.coordinate_lat ?? null, lon: item.attributes?.coordinate_lon ?? null,
      active: Boolean(item.attributes?.is_active), bookable: Boolean(item.attributes?.is_bookable)
    }));
  } catch (error) { console.warn(`altegio-sync: chain locations unavailable: ${error.message}`); }
}

const snapshot = {
  source: "Altegio public online-booking API", extractedAt: new Date().toISOString(), bookingFormId: formId, chainId: form.group_id || null,
  location: {
    id: Number(company.id), title: company.title, publicTitle: company.public_title, address: company.address,
    phone: company.phone, phones: company.phones || [], schedule: company.schedule, currency: company.currency_short_title || "",
    timezone: company.timezone_name || passport.client?.timezone || null, lat: company.coordinate_lat ?? null, lon: company.coordinate_lon ?? null
  },
  chainLocations,
  stats: { categories: categories.length, services: services.length, staff: staff.length, staffWithServiceRelations: staff.filter((person) => person.serviceIds.length).length },
  categories, services, staff
};

const importSpec = (passport.catalog?.imports || []).find((item) => item.enabled !== false && item.type === "altegio-snapshot");
if (!importSpec?.path || path.isAbsolute(importSpec.path) || importSpec.path.includes("..")) fail("Altegio snapshot path must stay inside the client directory");
const outputPath = path.resolve(path.dirname(passportPath), importSpec.path);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`altegio-sync: wrote ${path.relative(root, outputPath)}`);
console.log(`altegio-sync: ${categories.length} categories, ${services.length} services, ${staff.length} staff, ${snapshot.stats.staffWithServiceRelations} staff mapped`);
