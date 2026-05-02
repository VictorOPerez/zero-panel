import { api } from "./client";

export type FollowupStatus =
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

export interface Followup {
  id: string;
  contact_id: string;
  channel: string;
  message: string;
  status: FollowupStatus;
  scheduled_for: string;
  sent_at: string | null;
  cancelled_at: string | null;
  failed_at: string | null;
  attempt_count: number;
  last_error: string | null;
  created_by: "bot" | "admin" | "auto";
  created_by_id: string | null;
  conversation_id: string | null;
  tag: string | null;
  created_at: string;
  updated_at: string;
}

export function listFollowups(
  tenantId: string,
  query: { status?: FollowupStatus; contact_id?: string; limit?: number } = {}
): Promise<{ ok: true; followups: Followup[] }> {
  return api.get(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/followups`,
    { query }
  );
}

export function createFollowup(
  tenantId: string,
  body: {
    contact_id: string;
    message: string;
    scheduled_for: string;
    tag?: string;
    channel?: string;
  }
): Promise<{ ok: true; followup: Followup }> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/followups`,
    body
  );
}

export function cancelFollowupApi(
  tenantId: string,
  followupId: string
): Promise<{ ok: true; cancelled: boolean; followup: Followup }> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/followups/${encodeURIComponent(followupId)}/cancel`,
    {}
  );
}
