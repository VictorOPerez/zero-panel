import type { Integration, IntegrationStatus } from "./types";
import { getCalendarStatus } from "./calendar";
import { getTelegramOnboarding } from "./telegram";
import { getWhatsappOnboarding } from "./whatsapp";

function mapWhatsappStatus(status: string, configured: boolean): IntegrationStatus {
  if (status === "connected") return "connected";
  if (status === "error") return "error";
  if (!configured) return "disconnected";
  return "disconnected";
}

function mapTelegramStatus(status: string): IntegrationStatus {
  if (status === "connected") return "connected";
  if (status === "missing_token") return "disconnected";
  return "disconnected";
}

function mapCalendarStatus(connected: boolean, error?: string | null): IntegrationStatus {
  if (error) return "error";
  return connected ? "connected" : "disconnected";
}

export async function listIntegrations(tenantId: string): Promise<Integration[]> {
  const [wa, tg, cal] = await Promise.allSettled([
    getWhatsappOnboarding(tenantId),
    getTelegramOnboarding(tenantId),
    getCalendarStatus(tenantId),
  ]);

  const out: Integration[] = [];

  if (wa.status === "fulfilled") {
    const w = wa.value;
    out.push({
      key: "whatsapp",
      name: "WhatsApp",
      channel: "wa",
      status: mapWhatsappStatus(w.status, w.configured),
      detail: w.number ? `Número ${w.number}` : "Sin vincular",
      syncedAt: undefined,
    });
  }

  if (tg.status === "fulfilled") {
    const t = tg.value;
    out.push({
      key: "telegram",
      name: "Telegram",
      channel: "tg",
      status: mapTelegramStatus(t.status),
      detail: t.admin_chat_id
        ? `Chat ${t.admin_chat_id}`
        : t.suggested_bot_username
          ? `@${t.suggested_bot_username}`
          : "Sin vincular",
      syncedAt: undefined,
    });
  }

  if (cal.status === "fulfilled") {
    const c = cal.value.status;
    out.push({
      key: "google-calendar",
      name: "Google Calendar",
      status: mapCalendarStatus(c.connected, c.last_error ?? undefined),
      detail: c.account_email || (c.connected ? "Conectada" : "Sin vincular"),
      syncedAt: c.last_sync_at ?? undefined,
    });
  }

  return out;
}
