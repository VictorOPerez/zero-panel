import { api } from "./client";
import type {
  AutomationField,
  BookingStatus,
  CalendarEvent,
  PublicAutomationRecord,
  PublicAutomationRule,
} from "./contract";

export function listAutomations(
  tenantId: string
): Promise<{ ok: true; automations: PublicAutomationRule[] }> {
  return api.get(`/api/admin/tenants/${encodeURIComponent(tenantId)}/public-automations`);
}

export function patchAutomations(
  tenantId: string,
  automations: PublicAutomationRule[]
) {
  return api.patch(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/public-automations`,
    { automations }
  );
}

export function listBookings(
  tenantId: string,
  params?: { limit?: number; offset?: number }
): Promise<{
  ok: true;
  records: PublicAutomationRecord[];
  total: number;
  limit: number;
  offset: number;
}> {
  return api.get(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/public-automation-records`,
    { query: params }
  );
}

export function patchBooking(
  tenantId: string,
  recordId: string,
  body: {
    fields?: Partial<Record<AutomationField, string>>;
    status?: BookingStatus;
  }
): Promise<{ ok: true; record: PublicAutomationRecord }> {
  return api.patch(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/public-automation-records/${encodeURIComponent(
      recordId
    )}`,
    body
  );
}

export function deleteBooking(
  tenantId: string,
  recordId: string
): Promise<{ ok: true; record: PublicAutomationRecord }> {
  return api.delete(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/public-automation-records/${encodeURIComponent(
      recordId
    )}`
  );
}

export function listCalendarEvents(
  tenantId: string,
  params?: { limit?: number; offset?: number }
): Promise<{
  ok: true;
  events: CalendarEvent[];
  total: number;
  limit: number;
  offset: number;
}> {
  return api.get(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/calendar-events`,
    { query: params }
  );
}
