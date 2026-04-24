import { api } from "./client";
import type {
  CreateTenantServiceInput,
  TenantService,
  UpdateTenantServiceInput,
} from "./contract";

// Todos los endpoints devuelven el shape desenvuelto tras el hook del backend
// (ver apiFetch). La key "services" / "service" se desarma acá.

interface ListEnvelope {
  services: TenantService[];
}
interface SingleEnvelope {
  service: TenantService;
}

export async function listTenantServices(
  tenantId: string,
  { onlyActive = false }: { onlyActive?: boolean } = {}
): Promise<TenantService[]> {
  const res = await api.get<ListEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/services`,
    { query: { only_active: onlyActive || undefined } }
  );
  return res.services ?? [];
}

export async function createTenantService(
  tenantId: string,
  body: CreateTenantServiceInput
): Promise<TenantService> {
  const res = await api.post<SingleEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/services`,
    body
  );
  return res.service;
}

export async function updateTenantService(
  tenantId: string,
  serviceId: string,
  body: UpdateTenantServiceInput
): Promise<TenantService> {
  const res = await api.patch<SingleEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/services/${encodeURIComponent(serviceId)}`,
    body
  );
  return res.service;
}

export async function deleteTenantService(
  tenantId: string,
  serviceId: string
): Promise<void> {
  await api.delete(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/services/${encodeURIComponent(serviceId)}`
  );
}
