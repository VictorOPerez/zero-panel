import { api } from "./client";
import type {
  BillingPlan,
  TenantBillingConfig,
  TenantStatusReport,
} from "./contract";

export function listPlans(): Promise<{ ok: true; plans: BillingPlan[] }> {
  return api.get("/api/billing/plans", { skipAuth: true });
}

export function getTenantBilling(
  tenantId: string
): Promise<{ ok: true; billing: TenantBillingConfig }> {
  return api.get(`/api/billing/tenants/${encodeURIComponent(tenantId)}`);
}

export function createCheckoutSession(
  tenantId: string,
  body: { price_id?: string; success_url?: string; cancel_url?: string }
): Promise<{ ok: true; checkout_session_id: string; url: string }> {
  return api.post(
    `/api/billing/tenants/${encodeURIComponent(tenantId)}/checkout-session`,
    body
  );
}

export function createPortalSession(
  tenantId: string,
  body: { return_url?: string } = {}
): Promise<{ ok: true; url: string }> {
  return api.post(
    `/api/billing/tenants/${encodeURIComponent(tenantId)}/portal-session`,
    body
  );
}

export async function getTenantSubscriptionStatus(
  tenantId: string
): Promise<TenantStatusReport> {
  const res = await api.get<{ tenant_status: TenantStatusReport }>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/billing/tenant-status`
  );
  return res.tenant_status;
}

export function cancelSubscription(tenantId: string, immediate = false) {
  return api.post(
    `/api/billing/tenants/${encodeURIComponent(tenantId)}/cancel-subscription`,
    { immediate }
  );
}
