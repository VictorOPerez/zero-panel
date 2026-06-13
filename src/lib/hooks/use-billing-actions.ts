"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCheckoutSession,
  createPortalSession,
} from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";

/**
 * Hook compartido para iniciar checkout / portal de Stripe desde cualquier
 * parte del panel (banner global, plans-modal, página /billing).
 *
 *   - `checkout(priceId?)` llama al backend. Si el tenant NO tiene sub, el
 *     backend devuelve una URL de Stripe Checkout y redirigimos. Si YA tiene
 *     una sub viva, el backend cambia el plan con proration (sin redirect) y
 *     mostramos `notice`.
 *   - `portal()` idem para el portal de gestión.
 *   - `success_url` apunta a /payment-success (landing dedicado), `cancel_url`
 *     vuelve a /billing con ?checkout=cancel para mostrar un mensaje.
 */
export function useBillingActions(tenantId: string | null) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const checkoutMut = useMutation({
    mutationFn: (priceId: string | undefined) => {
      if (!tenantId) throw new Error("missing_tenant");
      const base = typeof window !== "undefined" ? window.location.origin : "";
      return createCheckoutSession(tenantId, {
        price_id: priceId,
        success_url: `${base}/payment-success`,
        cancel_url: `${base}/billing?checkout=cancel`,
      });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos iniciar el checkout."
      );
    },
    onSuccess: (res) => {
      if (res.upgraded) {
        // Cambio de plan sobre la sub existente: sin redirect. Refrescamos
        // todo lo que muestra plan/estado.
        qc.invalidateQueries({ queryKey: ["billing", tenantId] });
        qc.invalidateQueries({ queryKey: ["tenant-status", tenantId] });
        qc.invalidateQueries({ queryKey: ["subscription", tenantId] });
        setNotice(
          "¡Plan actualizado! La diferencia se prorratea automáticamente en tu próxima factura."
        );
        return;
      }
      if (res.url && typeof window !== "undefined") {
        window.location.assign(res.url);
      }
    },
  });

  const portalMut = useMutation({
    mutationFn: () => {
      if (!tenantId) throw new Error("missing_tenant");
      const base = typeof window !== "undefined" ? window.location.origin : "";
      return createPortalSession(tenantId, { return_url: `${base}/billing` });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos abrir el portal de Stripe."
      );
    },
    onSuccess: (res) => {
      if (res.url && typeof window !== "undefined") {
        window.location.assign(res.url);
      }
    },
  });

  const checkout = useCallback(
    (priceId?: string) => {
      setError(null);
      setNotice(null);
      checkoutMut.mutate(priceId);
    },
    [checkoutMut]
  );

  const portal = useCallback(() => {
    setError(null);
    portalMut.mutate();
  }, [portalMut]);

  const busy: "checkout" | "portal" | null = checkoutMut.isPending
    ? "checkout"
    : portalMut.isPending
      ? "portal"
      : null;

  return {
    checkout,
    portal,
    busy,
    error,
    notice,
    resetError: () => setError(null),
    resetNotice: () => setNotice(null),
    checkoutVariables: checkoutMut.variables,
  };
}
