import { z } from "zod";

export const ConversationStatusSchema = z.enum([
  "ia_atendiendo",
  "esperando_humano",
  "humano_atendiendo",
  "resuelta",
  "pausada",
]);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

export const ChannelSchema = z.enum(["wa", "ig", "em", "web", "tg"]);
export type Channel = z.infer<typeof ChannelSchema>;

export const MessageFromSchema = z.enum(["user", "zero", "human"]);
export type MessageFrom = z.infer<typeof MessageFromSchema>;

// Origen de un mensaje `from: "human"`:
//   "panel"           → un usuario del dashboard mandó el mensaje desde la web
//   "direct_whatsapp" → el dueño respondió directo desde su WhatsApp móvil;
//                        esto auto-pausa el bot en el backend.
export const MessageHumanSourceSchema = z.enum(["panel", "direct_whatsapp"]);
export type MessageHumanSource = z.infer<typeof MessageHumanSourceSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  contactName: z.string(),
  contactPhone: z.string().optional(),
  channel: ChannelSchema,
  status: ConversationStatusSchema,
  preview: z.string(),
  unreadCount: z.number(),
  updatedAt: z.string().datetime(),
  lang: z.string().default("ES"),
  tags: z.array(z.string()).default([]),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  from: MessageFromSchema,
  agentName: z.string().optional(),
  source: MessageHumanSourceSchema.optional(),
  text: z.string(),
  sentAt: z.string().datetime(),
  toolCall: z
    .object({ name: z.string(), durationMs: z.number() })
    .optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export const IntegrationStatusSchema = z.enum([
  "connected",
  "disconnected",
  "embed",
  "error",
]);
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;

export const IntegrationSchema = z.object({
  key: z.string(),
  name: z.string(),
  channel: ChannelSchema.optional(),
  status: IntegrationStatusSchema,
  detail: z.string(),
  syncedAt: z.string().optional(),
});
export type Integration = z.infer<typeof IntegrationSchema>;

export const KpiSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  delta: z.string(),
  trend: z.enum(["up", "down", "neutral"]),
});
export type Kpi = z.infer<typeof KpiSchema>;

export const AnalyticsSchema = z.object({
  kpis: z.array(KpiSchema),
  series: z.array(z.number()),
  byChannel: z.array(
    z.object({ label: z.string(), value: z.number(), pct: z.number() })
  ),
  csat: z.object({ score: z.number(), count: z.number() }),
  period: z.string(),
});
export type Analytics = z.infer<typeof AnalyticsSchema>;

export const AgentConfigSchema = z.object({
  name: z.string(),
  businessName: z.string(),
  tones: z.array(z.string()),
  activeTones: z.array(z.string()),
  languages: z.array(z.object({ code: z.string(), active: z.boolean() })),
  instructions: z.string(),
  escalationRules: z.array(
    z.object({ rule: z.string(), active: z.boolean() })
  ),
  knowledgeSources: z.array(
    z.object({
      name: z.string(),
      size: z.string(),
      detail: z.string(),
      synced: z.boolean(),
    })
  ),
  version: z.number(),
  publishedAt: z.string().optional(),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
