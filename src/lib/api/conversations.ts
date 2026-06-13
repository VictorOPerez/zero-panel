import { api } from "./client";
import type {
  Channel,
  Conversation,
  ConversationStatus,
  DeliveryStatus,
  MediaType,
  Message,
  MessageFrom,
} from "./types";

// Coerción defensiva: el backend manda strings; solo aceptamos los valores
// conocidos (los demás → undefined, la burbuja degrada a solo texto / sin ✓✓).
export function coerceMediaType(v: unknown): MediaType | undefined {
  return v === "image" || v === "audio" || v === "video" || v === "document"
    ? v
    : undefined;
}
export function coerceDeliveryStatus(v: unknown): DeliveryStatus | undefined {
  return v === "sent" || v === "delivered" || v === "read" || v === "failed"
    ? v
    : undefined;
}

interface BackendConversation {
  id: string;
  tenant_id: string;
  channel: string;
  channel_raw: string;
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  status: ConversationStatus;
  preview: string;
  unread_count: number;
  updated_at: string;
  created_at: string;
  ai_paused_at: string | null;
  resolved_at: string | null;
  assigned_human_id: string | null;
  human_resolver_id: string | null;
  metadata: unknown;
}

interface BackendMessage {
  id: string;
  conversation_id: string;
  from: MessageFrom;
  role: string;
  text: string;
  sent_at: string;
  media_url?: string | null;
  media_type?: string | null;
  delivery_status?: string | null;
  source?: "panel" | "direct_whatsapp" | null;
  tool_call: { name: string; args: unknown } | null;
}

function mapConversation(c: BackendConversation): Conversation {
  return {
    id: c.id,
    contactName: c.contact_name || c.contact_id,
    contactPhone: c.contact_phone || undefined,
    channel: (c.channel as Channel) ?? "web",
    status: c.status,
    preview: c.preview ?? "",
    unreadCount: c.unread_count ?? 0,
    updatedAt: c.updated_at,
    lang: "ES",
    tags: [],
  };
}

function mapMessage(m: BackendMessage): Message {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    from: m.from,
    source: m.source ?? undefined,
    text: m.text,
    sentAt: m.sent_at,
    mediaUrl: m.media_url ?? undefined,
    mediaType: coerceMediaType(m.media_type),
    deliveryStatus: coerceDeliveryStatus(m.delivery_status),
  };
}

function encode(id: string): string {
  return encodeURIComponent(id);
}

export interface ListConversationsParams {
  tenantId: string;
  status?: ConversationStatus;
  channel?: Channel;
  limit?: number;
  offset?: number;
}

export async function listConversations(
  params: ListConversationsParams
): Promise<{ conversations: Conversation[]; total: number }> {
  const res = await api.get<{
    conversations: BackendConversation[];
    total: number;
  }>(`/api/admin/tenants/${encode(params.tenantId)}/conversations`, {
    query: {
      status: params.status,
      channel: params.channel,
      limit: params.limit,
      offset: params.offset,
    },
  });
  return {
    conversations: (res.conversations ?? []).map(mapConversation),
    total: res.total ?? 0,
  };
}

export async function getConversation(
  tenantId: string,
  conversationId: string
): Promise<Conversation> {
  const res = await api.get<{ conversation: BackendConversation }>(
    `/api/admin/tenants/${encode(tenantId)}/conversations/${encode(conversationId)}`
  );
  return mapConversation(res.conversation);
}

export async function listMessages(
  tenantId: string,
  conversationId: string,
  opts: { before?: string; limit?: number } = {}
): Promise<Message[]> {
  const res = await api.get<{ messages: BackendMessage[] }>(
    `/api/admin/tenants/${encode(tenantId)}/conversations/${encode(conversationId)}/messages`,
    {
      query: {
        before: opts.before,
        limit: opts.limit,
      },
    }
  );
  return (res.messages ?? []).map(mapMessage);
}

export async function sendMessage(
  tenantId: string,
  conversationId: string,
  body: { text: string }
): Promise<Message> {
  const res = await api.post<{ message: BackendMessage }>(
    `/api/admin/tenants/${encode(tenantId)}/conversations/${encode(conversationId)}/messages`,
    body
  );
  return mapMessage(res.message);
}

export type OutboundMediaKind = "image" | "video" | "audio" | "document";

// Mapea el MIME del archivo elegido al `kind` que entiende WhatsApp Cloud.
export function mediaKindFromMime(mime: string): OutboundMediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

// Lee un File del navegador y devuelve su contenido en base64 (sin el prefijo
// data:). Lo usa el composer para mandar adjuntos por JSON (mismo patrón que
// la ingesta de PDFs).
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No pudimos leer el archivo."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export async function sendMediaMessage(
  tenantId: string,
  conversationId: string,
  body: {
    content_base64: string;
    mime: string;
    kind: OutboundMediaKind;
    filename?: string;
    caption?: string;
  }
): Promise<Message> {
  const res = await api.post<{ message: BackendMessage }>(
    `/api/admin/tenants/${encode(tenantId)}/conversations/${encode(conversationId)}/media`,
    body
  );
  return mapMessage(res.message);
}

export async function takeControl(
  tenantId: string,
  conversationId: string
): Promise<Conversation | null> {
  const res = await api.post<{ conversation: BackendConversation | null }>(
    `/api/admin/tenants/${encode(tenantId)}/conversations/${encode(conversationId)}/take-control`
  );
  return res.conversation ? mapConversation(res.conversation) : null;
}

export async function returnToAI(
  tenantId: string,
  conversationId: string
): Promise<Conversation | null> {
  const res = await api.post<{ conversation: BackendConversation | null }>(
    `/api/admin/tenants/${encode(tenantId)}/conversations/${encode(conversationId)}/return-to-ai`
  );
  return res.conversation ? mapConversation(res.conversation) : null;
}

export async function resolveConversation(
  tenantId: string,
  conversationId: string
): Promise<Conversation | null> {
  const res = await api.post<{ conversation: BackendConversation | null }>(
    `/api/admin/tenants/${encode(tenantId)}/conversations/${encode(conversationId)}/resolve`
  );
  return res.conversation ? mapConversation(res.conversation) : null;
}

export async function markConversationRead(
  tenantId: string,
  conversationId: string
): Promise<void> {
  await api.post<{ ok: true }>(
    `/api/admin/tenants/${encode(tenantId)}/conversations/${encode(conversationId)}/mark-read`
  );
}
