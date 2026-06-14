import { api } from "./client";
import type { TenantNumber } from "./contract";

// Centro de Control (cross-tenant). Solo super_admin. Lista TODOS los tenants
// desde la DB (no el tenantManager FS-backed) + provisiona números sin cobrar.

export interface PlatformTenant {
  id: string;
  name: string;
  plan: string;
  status: string;
  monthly_token_limit: number;
  override: string | null;
  capabilities: string[];
}

export async function listPlatformTenants(
  search?: string
): Promise<PlatformTenant[]> {
  const res = await api.get<{ ok: true; tenants: PlatformTenant[] }>(
    "/api/admin/platform/tenants",
    { query: { search: search || undefined } }
  );
  return res.tenants ?? [];
}

// Provisiona un número y lo asigna al tenant SIN crear cobro de Stripe. El dueño
// lo conecta a Meta él mismo (OTP por voz) y se lo entrega listo al cliente.
export async function adminProvisionNumber(
  tenantId: string,
  body: { phone_e164: string; country: string; forward_to_phone?: string }
): Promise<TenantNumber> {
  const res = await api.post<{ number: TenantNumber }>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/numbers/admin-provision`,
    body
  );
  return res.number;
}
