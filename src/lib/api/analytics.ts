import { api } from "./client";
import type { Analytics } from "./types";

export type AnalyticsPeriod = "24h" | "7d" | "30d" | "90d";

export async function getAnalytics(
  tenantId: string,
  period: AnalyticsPeriod = "7d"
): Promise<Analytics> {
  const res = await api.get<{ analytics: Analytics }>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/analytics`,
    { query: { period } }
  );
  return res.analytics;
}
