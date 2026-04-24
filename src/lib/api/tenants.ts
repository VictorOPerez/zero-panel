import { api } from "./client";
import type { TenantContext, TenantSummary } from "./contract";

export function listTenants(): Promise<{ ok: true; tenants: TenantSummary[] }> {
  return api.get("/api/admin/tenants");
}

export function getTenant(tenantId: string): Promise<{ ok: true; tenant: TenantContext }> {
  return api.get(`/api/admin/tenants/${encodeURIComponent(tenantId)}`);
}

export function createTenant(
  body: { tenant_id: string } & Partial<TenantContext>
): Promise<{ ok: true; tenant: TenantContext }> {
  return api.post("/api/admin/tenants", body);
}

export function patchTenant(
  tenantId: string,
  body: Partial<TenantContext>
): Promise<{ ok: true; tenant: TenantContext }> {
  return api.patch(`/api/admin/tenants/${encodeURIComponent(tenantId)}`, body);
}

export function activateTenant(tenantId: string) {
  return api.post(`/api/admin/tenants/${encodeURIComponent(tenantId)}/activate`);
}

export function deactivateTenant(tenantId: string) {
  return api.post(`/api/admin/tenants/${encodeURIComponent(tenantId)}/deactivate`);
}

export function deleteTenant(tenantId: string, immediate = false) {
  return api.delete(`/api/admin/tenants/${encodeURIComponent(tenantId)}`, {
    query: immediate ? { immediate: "true" } : undefined,
  });
}

export function healthTenants() {
  return api.get<{
    ok: true;
    timestamp: string;
    total: number;
    tenants: Array<{ tenant_id: string; active: boolean; whatsapp: unknown; telegram: unknown }>;
  }>("/api/admin/health/tenants");
}
