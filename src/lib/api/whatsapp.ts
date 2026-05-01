import { api } from "./client";
import type { WhatsappOnboardingState } from "./contract";

// Endpoints agnosticos del transporte (sirven para Baileys legacy y para
// la futura integracion con WhatsApp Cloud API).

type OnboardingResponse = { whatsapp: WhatsappOnboardingState };

function unwrap(res: OnboardingResponse): WhatsappOnboardingState {
  return res.whatsapp;
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
