import { api } from "./client";
import type { TelegramOnboardingState } from "./contract";

// Todos los endpoints de Telegram devuelven { telegram: TelegramOnboardingState }
// bajo `data` tras el envoltorio de Fastify. Desenvolvemos acá para que los
// callers trabajen con el shape plano.
interface TelegramEnvelope {
  telegram: TelegramOnboardingState;
}

export async function getTelegramOnboarding(
  tenantId: string
): Promise<TelegramOnboardingState> {
  const res = await api.get<TelegramEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/telegram/onboarding`
  );
  return res.telegram;
}

export async function connectTelegram(
  tenantId: string,
  body: { bot_token: string; admin_chat_id?: string }
): Promise<TelegramOnboardingState> {
  const res = await api.post<TelegramEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/telegram/connect`,
    body
  );
  return res.telegram;
}

export async function setTelegramChat(
  tenantId: string,
  admin_chat_id: string
): Promise<TelegramOnboardingState> {
  const res = await api.patch<TelegramEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/telegram/chat`,
    { admin_chat_id }
  );
  return res.telegram;
}

export async function regenerateTelegramConnectCode(
  tenantId: string
): Promise<TelegramOnboardingState> {
  const res = await api.post<TelegramEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/telegram/connect-code`
  );
  return res.telegram;
}
