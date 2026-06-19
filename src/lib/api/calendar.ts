import { api, apiFetch } from "./client";
import type { CalendarLiveEvent, GoogleCalendarStatus } from "./contract";

export function getCalendarAuthUrl(tenantId: string): Promise<{ ok: true; url: string }> {
  return api.get(`/api/admin/calendar/google/connect`, {
    query: { tenant_id: tenantId },
  });
}

/**
 * Marca un tenant como autorizado para iniciar el OAuth de Google Calendar.
 * Sólo lo usa el dueño desde /requests, después de agregar el email a Test
 * users en GCP. Emite tenant:oauth_authorized por socket para cerrar el
 * modal "Validando" en el panel del cliente.
 */
export function setCalendarOauthAuthorization(
  tenantId: string,
  authorized: boolean
): Promise<{ ok: true; tenant_id: string; calendar_oauth_authorized: boolean }> {
  return api.patch(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/calendar/oauth-authorization`,
    { authorized }
  );
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
 * Lee los eventos del tenant desde el cache de calendario del backend. Por
 * defecto sólo devuelve eventos que terminan en el futuro y no están cancelados
 * (vista "Reservas"). Con `includePast` respeta el rango [from, to] exacto
 * incluyendo días pasados — lo necesita la vista /calendar tipo Google Calendar.
 */
export async function listUpcomingCalendarEvents(
  tenantId: string,
  range: { from?: string; to?: string; includePast?: boolean } = {}
): Promise<CalendarEventsResponse> {
  return api.get<CalendarEventsResponse>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/calendar/events`,
    {
      query: {
        from: range.from,
        to: range.to,
        include_past: range.includePast ? "true" : undefined,
      },
    }
  );
}

// ── Calendario nativo: CRUD manual de reservas ────────────────────────────
// Reusa el SDK admin del backend (overlap + tz + audit) que opera nativo: sin
// Google/Nylas la reserva vive en la DB de Zero. El panel arma startIso/endIso
// desde el slot + duración. En conflicto el backend devuelve 409 con
// { reason:"overlap", conflicts } → reintentar con force:true para sobrescribir.

export interface AppointmentInput {
  startIso: string;
  endIso: string;
  title?: string;
  clientName?: string;
  clientPhone?: string;
  force?: boolean;
}

export interface AppointmentMutationResult {
  reservationId: string | null;
  eventId?: string | null;
  startIso: string;
  endIso: string;
  title: string;
}

export function createAppointment(
  tenantId: string,
  input: AppointmentInput
): Promise<AppointmentMutationResult> {
  return api.post<AppointmentMutationResult>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/calendar/appointments`,
    input
  );
}

export function updateAppointment(
  tenantId: string,
  reservationId: string,
  input: Omit<AppointmentInput, "startIso" | "endIso"> & {
    startIso?: string;
    endIso?: string;
  }
): Promise<AppointmentMutationResult> {
  return api.patch<AppointmentMutationResult>(
    `/api/admin/tenants/${encodeURIComponent(
      tenantId
    )}/calendar/appointments/${encodeURIComponent(reservationId)}`,
    input
  );
}

export function cancelAppointment(
  tenantId: string,
  reservationId: string
): Promise<{ ok: true; reservationId: string }> {
  return apiFetch(
    `/api/admin/tenants/${encodeURIComponent(
      tenantId
    )}/calendar/appointments/${encodeURIComponent(reservationId)}`,
    { method: "DELETE" }
  );
}
