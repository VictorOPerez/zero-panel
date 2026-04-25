import type { ConversationStatus, MessageFrom } from "@/lib/api/types";

export interface RealtimeBackendMessage {
  id: string;
  conversation_id: string;
  from: MessageFrom;
  role: string;
  text: string;
  sent_at: string;
  tool_call?: { name: string; args: unknown } | null;
}

export interface RealtimeRequestPayload {
  request: {
    id: string;
    tenant_id: string;
    source: string;
    sender_id: string;
    sender_name: string;
    text: string;
    status: string;
    reason: string | null;
    detail: string | null;
    conversation_id: string | null;
    created_at: string;
    updated_at: string;
  };
}

export interface SandboxTypingPayload {
  sessionId: string;
  typing: boolean;
}

export interface SandboxReplyPayload {
  sessionId: string;
  reply: string;
  route: string;
  trace_id: string;
  llm_elapsed_ms: number;
}

export interface ServerToClientEvents {
  "message:new": (payload: {
    conversationId: string;
    message: RealtimeBackendMessage;
  }) => void;
  "conversation:status": (payload: {
    conversationId: string;
    status: ConversationStatus;
  }) => void;
  "conversation:new": (payload: {
    conversationId: string;
    channel: string;
    contact_id: string;
    contact_name: string;
  }) => void;
  "typing:contact": (payload: { conversationId: string; typing: boolean }) => void;
  "typing:zero": (payload: { conversationId: string; typing: boolean }) => void;
  "request:new": (payload: RealtimeRequestPayload) => void;
  "sandbox:typing": (payload: SandboxTypingPayload) => void;
  "sandbox:reply": (payload: SandboxReplyPayload) => void;
}

export interface ClientToServerEvents {
  "subscribe:conversation": (conversationId: string) => void;
  "unsubscribe:conversation": (conversationId: string) => void;
  "join:tenant": (tenantId: string) => void;
  "join:sandbox": (payload: { tenantId: string; sessionId: string }) => void;
  "leave:sandbox": (payload: { tenantId: string; sessionId: string }) => void;
}
