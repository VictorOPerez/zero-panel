import { api } from "./client";
import type { BusinessBrief } from "./contract";

interface BriefEnvelope {
  brief: BusinessBrief;
}

/**
 * Lee el brief del tenant. El brief es la fuente única de verdad de la
 * personalidad del bot — editable desde acá (updateTenantBrief) y desde
 * WhatsApp (AdminOrchestrator); ambos escriben la misma fila.
 */
export async function getTenantBrief(tenantId: string): Promise<BusinessBrief> {
  const res = await api.get<BriefEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/brief`
  );
  return res.brief;
}

/**
 * Guarda el brief desde el panel. Mismo destino que la edición por WhatsApp
 * (tenant_business_brief). El customer bot lo lee fresco en cada turno, así
 * que el cambio aplica sin redeploy. Requiere rol tenant_admin/super_admin.
 */
export async function updateTenantBrief(
  tenantId: string,
  content: string
): Promise<BusinessBrief> {
  const res = await api.put<BriefEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/brief`,
    { content }
  );
  return res.brief;
}

/** Límite del brief (debe coincidir con BRIEF_MAX_LENGTH del backend). */
export const BRIEF_MAX_LENGTH = 8000;
