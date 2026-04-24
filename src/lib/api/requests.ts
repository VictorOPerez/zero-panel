import { api } from "./client";
import type { PublicRequest, PublicRequestStatus } from "./contract";

export function listPublicRequests(
  tenantId: string,
  params?: { status?: PublicRequestStatus; limit?: number; offset?: number }
): Promise<{
  ok: true;
  requests: PublicRequest[];
  total: number;
  limit: number;
  offset: number;
}> {
  return api.get(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/public-requests`,
    { query: params }
  );
}

export function patchPublicRequest(
  tenantId: string,
  requestId: string,
  status: PublicRequestStatus
) {
  return api.patch(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/public-requests/${encodeURIComponent(
      requestId
    )}`,
    { status }
  );
}
