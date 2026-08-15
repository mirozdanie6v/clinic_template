import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "app", "production-v1.tsx");
if (!fs.existsSync(file)) throw new Error("live-booking-ui: app/production-v1.tsx not found");
let source = fs.readFileSync(file, "utf8");
const importLine = 'import AltegioLiveBooking from "./components/AltegioLiveBooking";';
if (!source.includes(importLine)) {
  const anchor = 'import { asset, clinicDefaults, services, specialists, translations } from "../app-data.js";';
  if (!source.includes(anchor)) throw new Error("live-booking-ui: import anchor not found");
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

if (!source.includes("<AltegioLiveBooking")) {
  const block = /\{externalBooking && bookingStep === 2 && <div className="live-booking-card">[\s\S]*?<\/div>\}/;
  if (!block.test(source)) throw new Error("live-booking-ui: external booking block not found");
  const replacement = `{externalBooking && bookingStep === 2 && <AltegioLiveBooking
        language={lang}
        locationId={currentLocation?.externalId}
        locationName={currentLocation?.name || currentLocation?.publicName || "EVO"}
        serviceId={selectedService?.externalId}
        runtimeServiceId={selectedService?.id}
        serviceName={selectedService?.name[lang] || ""}
        staffId={selectedSpecialist?.externalId}
        runtimeSpecialistId={selectedSpecialist?.id}
        staffName={selectedSpecialist?.name[lang] || ""}
        publicBookingUrl={externalBookingUrl}
        initialName={contact.name}
        initialPhone={contact.phone}
        onContactChange={(next) => setContact(next)}
        onBooked={(next) => {
          setAppointment(next as Appointment);
          window.localStorage.setItem(\`${clinicDefaults.slug}-appointment\`, JSON.stringify(next));
          window.localStorage.setItem(\`${clinicDefaults.slug}-profile\`, JSON.stringify({ name: next.name, phone: next.phone }));
        }}
      />}`;
  source = source.replace(block, replacement);
}

fs.writeFileSync(file, source);
console.log("live-booking-ui: embedded Altegio booking enabled");
