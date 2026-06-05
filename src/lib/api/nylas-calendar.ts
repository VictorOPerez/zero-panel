import { api, apiFetch } from "./client";

// Providers de calendario que Nylas expone al tenant. El backend mapea cada uno
// a su Hosted OAuth (Google/Microsoft/iCloud/Exchange) detrás de UNA API.
export type NylasProvider = "google" | "microsoft" | "icloud" | "ews";

export interface NylasCalendarStatus {
  connected: boolean;
  provider?: string;
  email?: string | null;
  calendarId?: string;
}

// Inicia el flujo: devuelve la auth URL de Nylas (con provider preseleccionado).
// El panel redirige al usuario a esa URL. Al volver, el callback del backend
// redirige a ZERO_OAUTH_RESULT_URL (/calendar) con ?calendar=connected|error.
export function getNylasConnectUrl(
  tenantId: string,
  provider: NylasProvider
): Promise<{ ok: true; url: string }> {
  return api.get(`/api/admin/calendar/nylas/connect`, {
    query: { tenant_id: tenantId, provider },
  });
}

export function getNylasStatus(
  tenantId: string
): Promise<{ ok: true; status: NylasCalendarStatus }> {
  return api.get(`/api/admin/calendar/nylas/status`, {
    query: { tenant_id: tenantId },
  });
}

export function disconnectNylas(tenantId: string) {
  return apiFetch(`/api/admin/calendar/nylas/disconnect`, {
    method: "DELETE",
    body: { tenant_id: tenantId },
  });
}
