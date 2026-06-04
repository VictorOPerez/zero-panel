import { api } from "./client";
import type { BusinessBrief } from "./contract";

interface BriefEnvelope {
  brief: BusinessBrief;
}

/**
 * Lee el brief del tenant. Read-only: la edición vive en el AdminOrchestrator
 * de WhatsApp, no hay endpoint de write desde el panel a propósito.
 */
export async function getTenantBrief(tenantId: string): Promise<BusinessBrief> {
  const res = await api.get<BriefEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/brief`
  );
  return res.brief;
}
