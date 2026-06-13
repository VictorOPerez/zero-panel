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

export type CheckoutSessionResponse = {
  ok: true;
  // Camino checkout (sin sub previa): redirect a Stripe.
  checkout_session_id?: string;
  url?: string;
  // Camino upgrade (sub existente): el backend cambió el plan con proration,
  // no hay redirect.
  upgraded?: boolean;
  plan?: string | null;
  status?: string;
};

export function createCheckoutSession(
  tenantId: string,
  body: { price_id?: string; success_url?: string; cancel_url?: string }
): Promise<CheckoutSessionResponse> {
  return api.post(
    `/api/billing/tenants/${encodeURIComponent(tenantId)}/checkout-session`,
    body
  );
}

export interface SubscriptionInfo {
  plan: string;
  status: string;
  has_subscription: boolean;
  stripe_price_id: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
}

export function getSubscriptionInfo(
  tenantId: string
): Promise<{ ok: true; subscription: SubscriptionInfo | null }> {
  return api.get(
    `/api/billing/tenants/${encodeURIComponent(tenantId)}/subscription`
  );
}

export function resumeSubscription(
  tenantId: string
): Promise<{ ok: true; subscription_id: string; status: string }> {
  return api.post(
    `/api/billing/tenants/${encodeURIComponent(tenantId)}/resume-subscription`,
    {}
  );
}

export function syncSubscription(
  tenantId: string
): Promise<{ ok: true; synced: boolean; plan: string | null; status: string | null }> {
  return api.post(
    `/api/billing/tenants/${encodeURIComponent(tenantId)}/sync-subscription`,
    {}
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
