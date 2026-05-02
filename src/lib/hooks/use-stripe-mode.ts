"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getStripePublicConfig,
  type StripePublicConfig,
} from "@/lib/api/payments";

// Refetch cada 5 min: si el operador flippea STRIPE_MODE en Railway, el
// banner se actualiza solo en los siguientes 5 minutos sin recargar el
// panel. Para forzar refresh inmediato, recargá la página.
const REFETCH_INTERVAL_MS = 5 * 60 * 1000;

export function useStripeMode(): {
  mode: "live" | "test";
  isTest: boolean;
  publishableKey: string | null;
  isLoading: boolean;
} {
  const query = useQuery<StripePublicConfig>({
    queryKey: ["stripe-public-config"],
    queryFn: getStripePublicConfig,
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: REFETCH_INTERVAL_MS,
  });

  const mode = query.data?.mode ?? "live";
  return {
    mode,
    isTest: mode === "test",
    publishableKey: query.data?.publishable_key ?? null,
    isLoading: query.isLoading,
  };
}
