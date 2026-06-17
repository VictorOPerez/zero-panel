import { api } from "./client";
import type { AuthUser, TenantNumber } from "./contract";

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
  whatsapp_number: string | null;
  whatsapp_enabled: boolean;
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

// Crea un negocio con solo el nombre (DB-backed). El resto se configura
// impersonando o se le entrega vía magic link.
export async function createPlatformTenant(
  name: string
): Promise<{ id: string; name: string; slug: string }> {
  const res = await api.post<{ tenant: { id: string; name: string; slug: string } }>(
    "/api/admin/platform/tenants",
    { name }
  );
  return res.tenant;
}

// Genera un magic link de acceso para el negocio. Devuelve el token UNA vez; el
// panel arma la URL con su propio origin.
export async function createMagicLink(
  tenantId: string
): Promise<{ token: string; expires_at: string }> {
  return api.post<{ token: string; expires_at: string }>(
    `/api/admin/platform/tenants/${encodeURIComponent(tenantId)}/magic-link`,
    {}
  );
}

export interface MagicRedeemResponse {
  token: string;
  expires_in: string;
  user: AuthUser;
}

// Canjea un magic link (público, sin sesión previa) → crea la sesión del cliente.
export function redeemMagicLink(token: string): Promise<MagicRedeemResponse> {
  return api.post<MagicRedeemResponse>(
    "/api/auth/magic/redeem",
    { token },
    { skipAuth: true }
  );
}

// ── Telnyx: saldo del proveedor de números (super_admin) ───────────────────

export interface TelnyxBalance {
  balance: number;
  creditLimit: number;
  availableCredit: number;
  currency: string;
}

export interface TelnyxAutoRecharge {
  enabled: boolean;
  thresholdAmount: number | null;
  rechargeAmount: number | null;
  preference: string | null;
}

export function getTelnyxBalance(): Promise<{
  balance: TelnyxBalance;
  add_funds_url: string;
}> {
  return api.get("/api/admin/platform/telnyx/balance");
}

export function getTelnyxAutoRecharge(): Promise<{
  auto_recharge: TelnyxAutoRecharge;
  add_funds_url: string;
}> {
  return api.get("/api/admin/platform/telnyx/auto-recharge");
}

export function setTelnyxAutoRecharge(body: {
  enabled: boolean;
  threshold_amount?: number;
  recharge_amount?: number;
}): Promise<{ auto_recharge: TelnyxAutoRecharge }> {
  return api.patch("/api/admin/platform/telnyx/auto-recharge", body);
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
