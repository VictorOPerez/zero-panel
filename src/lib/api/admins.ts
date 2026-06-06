import { api } from "./client";
import type {
  AdminAuditEntry,
  AdminUser,
  CreateAdminInput,
  CreateAdminResponse,
  IssueAdminCodeResponse,
  ListAdminAuditFilter,
} from "./contract";

interface ListAdminsEnvelope {
  admins: AdminUser[];
}

interface AuditEnvelope {
  total: number;
  items: AdminAuditEntry[];
}

export async function listAdmins(tenantId: string): Promise<AdminUser[]> {
  const res = await api.get<ListAdminsEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/admins`
  );
  return res.admins ?? [];
}

// El backend devuelve el verification_code en plaintext UNA sola vez.
// El frontend debe mostrarlo al usuario en un modal y no persistirlo.
export async function createAdmin(
  tenantId: string,
  body: CreateAdminInput
): Promise<CreateAdminResponse> {
  return api.post<CreateAdminResponse>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/admins`,
    body
  );
}

export async function regenerateAdminCode(
  tenantId: string,
  adminId: string
): Promise<IssueAdminCodeResponse> {
  return api.post<IssueAdminCodeResponse>(
    `/api/admin/tenants/${encodeURIComponent(
      tenantId
    )}/admins/${encodeURIComponent(adminId)}/code`,
    {}
  );
}

export async function revokeAdmin(
  tenantId: string,
  adminId: string
): Promise<void> {
  await api.delete(
    `/api/admin/tenants/${encodeURIComponent(
      tenantId
    )}/admins/${encodeURIComponent(adminId)}`
  );
}

// Reactiva un admin revocado: des-revoca + emite un código OTP nuevo (que el
// admin pega en WhatsApp para re-verificarse). Devuelve el código en plaintext
// UNA sola vez — mostrarlo en un modal, no persistir.
export async function reactivateAdmin(
  tenantId: string,
  adminId: string
): Promise<CreateAdminResponse> {
  return api.post<CreateAdminResponse>(
    `/api/admin/tenants/${encodeURIComponent(
      tenantId
    )}/admins/${encodeURIComponent(adminId)}/reactivate`,
    {}
  );
}

export async function listAdminAudit(
  tenantId: string,
  filter: ListAdminAuditFilter = {}
): Promise<{ items: AdminAuditEntry[]; total: number }> {
  const res = await api.get<AuditEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/admin-audit`,
    {
      query: {
        admin_user_id: filter.admin_user_id || undefined,
        action: filter.action || undefined,
        result: filter.result || undefined,
        limit: filter.limit || undefined,
        offset: filter.offset || undefined,
      },
    }
  );
  return { items: res.items ?? [], total: Number(res.total ?? 0) };
}
