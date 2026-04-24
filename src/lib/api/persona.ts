import { api } from "./client";
import type {
  MessageSource,
  PersonaPreviewResponse,
  TenantContext,
  TenantPersonaConfig,
} from "./contract";

export function previewPersona(
  tenantId: string,
  channel: MessageSource
): Promise<PersonaPreviewResponse> {
  return api.get(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/persona/preview`,
    { query: { channel } }
  );
}

export function patchPersona(
  tenantId: string,
  body: Partial<TenantPersonaConfig>
): Promise<{ ok: true; tenant: TenantContext; persona: TenantPersonaConfig }> {
  return api.patch(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/persona`,
    body
  );
}
