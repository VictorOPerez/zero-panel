import { api } from "./client";

export interface PaymentProvider {
  provider: "stripe";
  account_id: string;
  status: "pending" | "active" | "restricted" | "rejected";
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  default_currency: string | null;
  country: string | null;
  requirements: {
    currentlyDue?: string[];
    pastDue?: string[];
    eventuallyDue?: string[];
    disabledReason?: string | null;
  } | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingLink {
  url: string;
  expires_at: string;
}

export function getPaymentsProvider(
  tenantId: string
): Promise<{ ok: true; provider: PaymentProvider | null }> {
  return api.get(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/payments/provider`
  );
}

export function connectStripe(
  tenantId: string,
  body: { country?: string; email?: string } = {}
): Promise<{ ok: true; provider: PaymentProvider; onboarding: OnboardingLink }> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/payments/connect/stripe`,
    body
  );
}

export function refreshOnboarding(
  tenantId: string
): Promise<{ ok: true; onboarding: OnboardingLink }> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/payments/onboarding/refresh`,
    {}
  );
}

export function syncProvider(
  tenantId: string
): Promise<{ ok: true; provider: PaymentProvider | null }> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/payments/sync`,
    {}
  );
}

export function disconnectProvider(
  tenantId: string
): Promise<{ ok: true; removed: boolean }> {
  return api.delete(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/payments/provider`
  );
}
