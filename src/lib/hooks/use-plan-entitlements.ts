"use client";

import { useQuery } from "@tanstack/react-query";
import { getTenantBilling } from "@/lib/api/billing";
import { useAuthStore } from "@/store/auth";
import { isFeatureLocked, type GatedFeature } from "@/lib/billing/entitlements";

/**
 * Plan actual del tenant + helper de candado. Lo usa el sidebar (y donde haga
 * falta) para mostrar el candado en features que el plan no incluye.
 */
export function usePlanEntitlements() {
  const tenantId = useAuthStore((s) => s.activeTenantId);

  const query = useQuery({
    queryKey: ["tenant-billing", tenantId],
    queryFn: () => getTenantBilling(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
  });

  const plan = query.data?.billing?.plan;

  return {
    plan,
    loading: query.isLoading,
    isLocked: (feature: GatedFeature) => isFeatureLocked(plan, feature),
  };
}
