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
