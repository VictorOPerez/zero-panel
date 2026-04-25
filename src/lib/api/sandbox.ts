import { api } from "./client";
import type { SandboxChatResponse, SandboxResetResponse } from "./contract";

export function sandboxChat(
  tenantId: string,
  body: { session_id: string; message: string; sender_name?: string }
): Promise<SandboxChatResponse> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/sandbox/chat`,
    { ...body, action: "message" }
  );
}

export function sandboxReset(
  tenantId: string,
  sessionId: string
): Promise<SandboxResetResponse> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/sandbox/chat`,
    { session_id: sessionId, action: "reset" }
  );
}
