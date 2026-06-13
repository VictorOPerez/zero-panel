/**
 * Tipos espejo del contrato del backend (Admin Panel API).
 * No agregar endpoints/campos fuera de lo documentado sin confirmación.
 */

// ── Auth ──────────────────────────────────────────────────────────────────
export type UserRole = "super_admin" | "tenant_admin" | "tenant_user";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  tenant_ids: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type Permission =
  | "tenants.read" | "tenants.write" | "tenants.activate"
  | "users.manage" | "audit.read"
  | "billing.manage_tenant" | "billing.read_tenant_public" | "billing.read_internal_metrics"
  | "llm.manage"
  | "channels.read" | "channels.manage"
  | "automations.read" | "automations.manage"
  | "requests.read" | "requests.manage";

export interface LoginResponse {
  ok: true;
  token: string;
  expires_in: number;
  user: AuthUser;
  source: "db" | "legacy";
}

export interface SignupResponse {
  ok: true;
  token: string;
  expires_in: number;
  user: AuthUser;
  tenant: {
    id: string;
    slug: string;
    name: string;
    ownerEmail: string | null;
    timezone: string;
    locale: string;
    active: boolean;
  };
  trial_ends_at?: string;
  verification_email_sent: boolean;
  next_step: "verify_email";
}

export interface MeResponse {
  ok: true;
  user: AuthUser;
  permissions: Permission[];
}

// ── Persona ───────────────────────────────────────────────────────────────
export type TenantBusinessHoursWeekday =
  | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface TenantBusinessHoursDay {
  open: string; // HH:MM
  close: string; // HH:MM
}
export type TenantBusinessHoursConfig = Partial<Record<TenantBusinessHoursWeekday, TenantBusinessHoursDay>>;

export interface TenantPersonaBehaviorConfig {
  timezone?: string;
  typing_simulation?: boolean;
  response_delay_ms?: { min: number; max: number; per_char: number };
  hide_ai_identity?: boolean;
  business_hours?: TenantBusinessHoursConfig;
}

export interface TenantPersonaChannelOverride {
  tone?: string;
  language?: string;
  system_prompt_extra?: string;
  rules?: string[];
  behavior?: TenantPersonaBehaviorConfig;
}

export interface TenantPersonaChannelsConfig {
  telegram?: TenantPersonaChannelOverride;
  whatsapp?: TenantPersonaChannelOverride;
  websocket?: TenantPersonaChannelOverride;
}

export interface TenantPersonaConfig {
  tone: string;
  language: string;
  system_prompt_extra: string;
  rules: string[];
  behavior?: TenantPersonaBehaviorConfig;
  channels?: TenantPersonaChannelsConfig;
}

export type MessageSource = "whatsapp" | "telegram" | "websocket";

export interface PersonaPreviewResponse {
  ok: true;
  tenant_id: string;
  channel: MessageSource;
  base_persona: {
    tone: string;
    language: string;
    system_prompt_extra: string;
    rules: string[];
  };
  channel_overrides: TenantPersonaChannelsConfig;
  effective: {
    tone: string;
    language: string;
    system_prompt_extra: string;
    rules: string[];
    behavior: Required<Pick<TenantPersonaBehaviorConfig, "timezone" | "typing_simulation" | "response_delay_ms" | "hide_ai_identity">> & {
      business_hours?: TenantBusinessHoursConfig;
    };
  };
}

// ── LLM ────────────────────────────────────────────────────────────────────
export type TenantLlmProvider = "anthropic" | "openai" | "google";

export interface LlmProviderModel {
  provider: TenantLlmProvider;
  model: string;
}

export interface TenantLlmOverrides {
  router?: LlmProviderModel | null;
  classifier_conversational?: LlmProviderModel | null;
}

export interface LlmPricingRule {
  provider?: string;
  model_match: string;
  input_usd_per_million: number;
  output_usd_per_million: number;
}

// ── Billing ────────────────────────────────────────────────────────────────
export type TenantStatus = "trial" | "trial_expired" | "active" | "past_due" | "canceled" | "granted" | "suspended";

export interface TenantBillingOverride {
  type: "granted" | "suspended";
  reason: string;
  by: string;
  at: string;
  expires_at?: string;
}

export interface TenantBillingConfig {
  plan: string;
  monthly_token_limit: number;
  current_period_start: string;
  current_period_end?: string;
  tokens_used: number;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  stripe_subscription_status?: string;
  stripe_checkout_session_id?: string;
  trial_ends_at?: string;
  monthly_hard_cap?: number;
  out_of_service_message?: string;
  override?: TenantBillingOverride;
}

export interface BillingPlan {
  id: string;
  name: string;
  price_id: string;
  monthly_price_usd?: number;
  token_limit?: number;
  description?: string;
  features?: string[];
}

export interface TenantStatusReport {
  status: TenantStatus;
  can_serve: boolean;
  reason: string;
  trial_ends_at?: string;
  trial_days_remaining?: number;
  monthly_token_limit: number;
  monthly_hard_cap?: number;
  tokens_used_this_period: number;
  tokens_remaining: number;
  usage_percent: number;
  hard_cap_exceeded: boolean;
  // Traducción amigable del cap a conversaciones. -1 = ilimitado.
  estimated_conversations_total?: number;
  estimated_conversations_used?: number;
  estimated_conversations_remaining?: number;
  stripe_subscription_status?: string;
  override?: TenantBillingOverride;
}

// ── Tenant ────────────────────────────────────────────────────────────────
export interface TenantBusiness {
  name: string;
  owner: string;
  type: string;
  location: string;
  description?: string;
}

export interface TenantChannels {
  whatsapp: {
    enabled: boolean;
    bot_enabled?: boolean;
    provider: string;
    number: string;
    admin_contact_id: string;
    wa_cloud_phone_number_id?: string;
    wa_cloud_waba_id?: string;
    ycloud_channel_id?: string;
    ycloud_phone_number?: string;
    ycloud_waba_id?: string;
    bot_blocked_contacts?: string[];
    bot_allowed_contacts?: string[];
  };
  websocket: { enabled: boolean };
}

export interface TenantSummary {
  tenant_id: string;
  active: boolean;
  business: TenantBusiness;
  channels: TenantChannels;
  billing: Partial<TenantBillingConfig>;
}

export interface TenantContext extends TenantSummary {
  persona?: TenantPersonaConfig;
  llm?: unknown;
}

// ── Calendar live events (cache de Google Calendar) ──────────────────────
export type CalendarEventStatus = "confirmed" | "tentative" | "cancelled";
export type CalendarEventSource = "bot" | "external";

export interface CalendarLiveEvent {
  id: string;
  google_event_id: string;
  summary: string | null;
  description: string | null;
  location: string | null;
  start_at: string | null;
  end_at: string | null;
  status: CalendarEventStatus;
  source: CalendarEventSource;
  automation_record_id: string | null;
  is_all_day: boolean;
}

// ── Services (catálogo del tenant) ────────────────────────────────────────
export interface TenantService {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  currency: string;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateTenantServiceInput {
  name: string;
  duration_minutes: number;
  price_cents?: number;
  currency?: string;
  description?: string | null;
  active?: boolean;
}

export type UpdateTenantServiceInput = Partial<CreateTenantServiceInput>;

// ── Knowledge base (RAG por tenant) ───────────────────────────────────────
export type KnowledgeDocumentType = "pdf" | "url" | "text";
export type KnowledgeDocumentStatus = "pending" | "ready" | "error";

export interface KnowledgeDocument {
  id: string;
  tenant_id: string;
  type: KnowledgeDocumentType;
  title: string;
  source: string | null;
  content_preview: string | null;
  chunk_count: number;
  status: KnowledgeDocumentStatus;
  error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateKnowledgeDocumentInput {
  type: KnowledgeDocumentType;
  title: string;
  source?: string | null;
  // Texto plano ya extraído. Para PDF/URL el frontend hace la extracción
  // (o el backend en una iteración posterior) — el endpoint actual
  // recibe siempre el contenido.
  content: string;
}

export interface CreateKnowledgeDocumentResponse {
  ok: true;
  document: KnowledgeDocument;
  chunks: number;
  embedded: number;
  pages?: number;
}

export interface IngestUrlInput {
  url: string;
  title?: string;
}

export interface IngestPdfInput {
  title: string;
  source?: string | null;
  content_base64: string;
}

// ── WhatsApp ──────────────────────────────────────────────────────────────
export type WhatsappOnboardingStatus =
  | "not_configured" | "connected" | "disconnected" | "error";

export interface WhatsappOnboardingState {
  status: WhatsappOnboardingStatus;
  configured: boolean;
  enabled: boolean;
  bot_enabled: boolean;
  provider: "meta";
  number: string;
  connected: boolean;
  last_error: string;
  bot_allowed_contacts?: string[];
  bot_blocked_contacts?: string[];
}

// ── Calendar ──────────────────────────────────────────────────────────────
export interface GoogleCalendarStatus {
  connected: boolean;
  account_email?: string;
  connected_at?: string;
  updated_at?: string;
  last_sync_at?: string;
  last_error?: string;
  last_error_at?: string;
  calendar_id?: string;
  scopes?: string[];
}

// ── Automations / Bookings ────────────────────────────────────────────────
export type AutomationField =
  | "name" | "date" | "time" | "phone" | "address" | "notes" | "barber";

export interface PublicAutomationRule {
  id: "reservation";
  label: string;
  enabled: boolean;
  trigger_keywords: string[];
  required_fields: AutomationField[];
  available_times: string[];
  available_barbers: string[];
  max_alternatives: number;
}

export type BookingStatus = "open" | "done" | "cancelled";

export interface PublicAutomationRecord {
  id: string;
  tenant_id: string;
  source: MessageSource;
  sender_id: string;
  sender_name: string;
  automation_id: "reservation";
  fields: Partial<Record<AutomationField, string>>;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  tenant_id: string;
  title: string;
  date: string;
  time: string;
  source: string;
  contact_id: string;
  contact_name: string;
  details: string;
  created_at: string;
}

// ── Public requests ───────────────────────────────────────────────────────
export type PublicRequestStatus = "open" | "in_progress" | "done" | "dismissed";
export type PublicRequestReason =
  | "calendar_not_connected"
  | "calendar_reauth_required"
  | "calendar_oauth_pending_approval"
  | "executor_error"
  | "manual_intervention"
  | "other";

export interface PublicRequest {
  id: string;
  tenant_id: string;
  source: MessageSource;
  sender_id: string;
  sender_name: string;
  // El backend devuelve el mensaje original del cliente en el campo `text`.
  text: string;
  // Campos agregados 2026-04-24 — son opcionales en DB (NULL para registros
  // previos) pero el panel los renderiza cuando están.
  reason: PublicRequestReason | null;
  detail: string | null;
  conversation_id: string | null;
  status: PublicRequestStatus;
  created_at: string;
  updated_at: string;
}

// ── Sandbox ────────────────────────────────────────────────────────────────
export type SandboxRoute =
  | "fallback" | "answer" | "executor" | "executor_failed" | string;

export interface SandboxChatResponse {
  ok: true;
  reply: string;
  route: SandboxRoute;
  trace_id: string;
  typing_ms: number;
  llm_elapsed_ms: number;
  behavior_used: TenantPersonaBehaviorConfig;
  channel: "sandbox";
  session_id: string;
}

export interface SandboxResetResponse {
  ok: true;
  reset: true;
}

// ── Admin Console (admins por WA) ──────────────────────────────────────────
// Numeros de WhatsApp marcados como administradores del tenant. Conversan
// con el bot via WA para ejecutar comandos del negocio (stats, citas,
// contactos). Verificacion 2FA con codigo 6 digitos al primer mensaje.

export type AdminRole = "owner";

export interface AdminUser {
  id: string;
  tenant_id: string;
  phone_e164: string;
  label: string | null;
  role: AdminRole;
  verified_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAdminInput {
  phone: string;
  label?: string;
}

export interface IssueAdminCodeResponse {
  verification_code: string;
  verification_expires_at: string;
}

export interface CreateAdminResponse extends IssueAdminCodeResponse {
  admin: AdminUser;
}

export type AdminAuditResult =
  | "ok"
  | "failed"
  | "denied"
  | "expired_confirm"
  | "unverified";

export interface AdminAuditEntry {
  id: string;
  tenant_id: string;
  admin_user_id: string | null;
  admin_phone: string;
  action: string;
  payload: unknown;
  result: AdminAuditResult;
  result_detail: unknown;
  trace_id: string | null;
  created_at: string;
}

export interface ListAdminAuditFilter {
  admin_user_id?: string;
  action?: string;
  result?: AdminAuditResult;
  limit?: number;
  offset?: number;
}

// ── Business brief (markdown del contexto del negocio) ───────────────────
// Blob de markdown que el admin construye conversando con el AdminOrchestrator
// vía WhatsApp. Se inyecta al system prompt del customer bot. Panel solo READ —
// la edición es exclusivamente WA. version autoincrement por commit.

export interface BusinessBrief {
  content: string;
  version: number;
  updated_at: string | null;
  updated_by_admin_id: string | null;
}

// ── Virtual numbers marketplace (Telnyx + Stripe markup) ──────────────────
// Reventa de números virtuales. El tenant compra desde el panel, Zero paga al
// provider (Telnyx) y cobra al tenant via Stripe markup fijo. La activación
// final en WhatsApp Business la hace el tenant manualmente en business.facebook.com.

export type TenantNumberProvider = "telnyx" | "twilio";
export type TenantNumberStatus = "purchased" | "pairing" | "active" | "released";

export interface TenantNumber {
  id: string;
  tenant_id: string;
  phone_e164: string;
  country: string;
  provider: TenantNumberProvider;
  provider_number_id: string;
  provider_cost_cents: number;
  markup_cents: number;
  total_monthly_cents: number;
  currency: string;
  stripe_subscription_item_id: string | null;
  forward_to_phone: string | null;
  status: TenantNumberStatus;
  paired_waba_id: string | null;
  purchased_at: string;
  released_at: string | null;
}

export interface AvailableNumber {
  phone_e164: string;
  country: string;
  region: string | null;
  provider_cost_cents: number;
  markup_cents: number;
  total_monthly_cents: number;
  currency: string;
  capabilities: string[];
}

export interface BuyNumberInput {
  phone_e164: string;
  country: string;
  forward_to_phone?: string;
}

// ── Errors ─────────────────────────────────────────────────────────────────
export type ApiErrorCode =
  | "email_not_verified"
  | "already_paired"
  | "not_paired"
  | string;

export interface ApiErrorEnvelope {
  ok: false;
  error: string;
  code?: ApiErrorCode;
  [key: string]: unknown;
}

export type ApiEnvelope<T extends object> =
  | ({ ok: true } & T)
  | ApiErrorEnvelope;
