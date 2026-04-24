import { api } from "./client";
import type { WhatsappOnboardingState } from "./contract";

// Todas las rutas del backend responden { ok, whatsapp: WhatsappOnboardingState }.
// El client global ya desenvuelve el envelope { ok, data }, así que acá solo nos
// queda sacar el .whatsapp y devolver el state "plano" al caller.

type OnboardingResponse = { whatsapp: WhatsappOnboardingState };

function unwrap(res: OnboardingResponse): WhatsappOnboardingState {
  return res.whatsapp;
}

export function getWhatsappOnboarding(tenantId: string): Promise<WhatsappOnboardingState> {
  return api
    .get<OnboardingResponse>(
      `/api/admin/tenants/${encodeURIComponent(tenantId)}/whatsapp/onboarding`
    )
    .then(unwrap);
}

export function requestPairingCode(
  tenantId: string,
  body: { number: string; force?: boolean; pairing_timeout_ms?: number }
): Promise<WhatsappOnboardingState> {
  return api
    .post<OnboardingResponse>(
      `/api/admin/tenants/${encodeURIComponent(tenantId)}/whatsapp/pairing-code`,
      body
    )
    .then(unwrap);
}

export function resetWhatsapp(tenantId: string): Promise<WhatsappOnboardingState> {
  return api
    .post<OnboardingResponse>(
      `/api/admin/tenants/${encodeURIComponent(tenantId)}/whatsapp/reset`
    )
    .then(unwrap);
}

export function reconnectWhatsapp(tenantId: string): Promise<WhatsappOnboardingState> {
  return api
    .post<OnboardingResponse>(
      `/api/admin/tenants/${encodeURIComponent(tenantId)}/whatsapp/reconnect`
    )
    .then(unwrap);
}

export function setWhatsappBotEnabled(
  tenantId: string,
  bot_enabled: boolean
): Promise<WhatsappOnboardingState> {
  return api
    .patch<OnboardingResponse>(
      `/api/admin/tenants/${encodeURIComponent(tenantId)}/whatsapp/bot-enabled`,
      { bot_enabled }
    )
    .then(unwrap);
}

export function setWhatsappAllowedContacts(
  tenantId: string,
  bot_allowed_contacts: string[]
): Promise<WhatsappOnboardingState> {
  return api
    .patch<OnboardingResponse>(
      `/api/admin/tenants/${encodeURIComponent(tenantId)}/whatsapp/allowed-contacts`,
      { bot_allowed_contacts }
    )
    .then(unwrap);
}

export function setWhatsappBlockedContacts(
  tenantId: string,
  bot_blocked_contacts: string[]
): Promise<WhatsappOnboardingState> {
  return api
    .patch<OnboardingResponse>(
      `/api/admin/tenants/${encodeURIComponent(tenantId)}/whatsapp/blocked-contacts`,
      { bot_blocked_contacts }
    )
    .then(unwrap);
}
