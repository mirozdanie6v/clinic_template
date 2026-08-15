import { services, specialists } from "../app-data.js";

export function validateBookingSelection(locationId: number, serviceId: number, staffId: number) {
  const runtimeLocationId = `altegio-${locationId}`;
  const person = (specialists as any[]).find((item: any) => item?.locationId === runtimeLocationId && Number(item?.externalId) === staffId);
  if (!person) return false;
  const service = (services as any[]).flatMap((group: any) => group?.items || []).find((item: any) => item?.locationId === runtimeLocationId && Number(item?.externalId) === serviceId);
  if (!service) return false;
  return Array.isArray(service.staffIds) && service.staffIds.includes(person.id) && Array.isArray(person.serviceIds) && person.serviceIds.includes(service.id);
}
