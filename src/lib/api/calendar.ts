import { api, apiFetch } from "./client";
import type { CalendarLiveEvent, GoogleCalendarStatus } from "./contract";

export function getCalendarAuthUrl(tenantId: string): Promise<{ ok: true; url: string }> {
  return api.get(`/api/admin/calendar/google/connect`, {
    query: { tenant_id: tenantId },
  });
}

export function getCalendarStatus(
  tenantId: string
): Promise<{ ok: true; status: GoogleCalendarStatus }> {
  return api.get(`/api/admin/calendar/google/status`, {
    query: { tenant_id: tenantId },
  });
}

export function disconnectCalendar(tenantId: string) {
  return apiFetch(`/api/admin/calendar/google/disconnect`, {
    method: "DELETE",
    body: { tenant_id: tenantId },
  });
}

interface CalendarEventsResponse {
  range: { from: string; to: string };
  events: CalendarLiveEvent[];
}

/**
 * Lee los eventos activos del tenant desde el cache de Google Calendar
 * mantenido por el backend. Por diseño sólo devuelve eventos que terminan
 * en el futuro y no están cancelados.
 */
export async function listUpcomingCalendarEvents(
  tenantId: string,
  range: { from?: string; to?: string } = {}
): Promise<CalendarEventsResponse> {
  return api.get<CalendarEventsResponse>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/calendar/events`,
    { query: { from: range.from, to: range.to } }
  );
}
