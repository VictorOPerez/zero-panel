import { api } from "./client";
import type { MessageSource, SandboxChatResponse } from "./contract";

export function sandboxChat(
  tenantId: string,
  body: { source: MessageSource; message: string; sender_name?: string }
): Promise<SandboxChatResponse> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/sandbox/chat`,
    body
  );
}
