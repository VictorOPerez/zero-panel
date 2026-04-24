"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getTenantSubscriptionStatus } from "@/lib/api/billing";
import { useAuthStore } from "@/store/auth";
import { useBillingActions } from "@/lib/hooks/use-billing-actions";
import {
  BillingStatusBanner,
  STATUS_META,
} from "@/components/billing/billing-status";
import { PlansModal } from "./plans-modal";

/**
 * Banner global de billing que vive arriba del dashboard. Sólo aparece si el
 * tenant activo NO está en `active`. En `trial` ofrece abrir el modal de
 * planes; en `past_due` abre el portal de Stripe; en los estados bloqueantes
 * muestra la razón y el CTA que corresponde.
 *
 * El banner es dismissible por sesión de navegador (sessionStorage) pero
 * vuelve a aparecer si el estado cambia a algo peor.
 */
export function PaymentBanner() {
  const tenantId = useAuthStore((s) => s.activeTenantId);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [plansOpen, setPlansOpen] = useState(false);
  const [dismissedStatus, setDismissedStatus] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["tenant-status", tenantId],
    queryFn: () => getTenantSubscriptionStatus(tenantId!),
    enabled: Boolean(hydrated && tenantId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const { checkout, portal, busy, error, resetError } = useBillingActions(tenantId);

  const status = statusQuery.data;

  // Sin status, sin tenant, o estado "active" → el banner no aparece.
  if (!status || status.status === "active") {
    return null;
  }
  // Dismiss sólo válido para el mismo status; si cambia, re-aparece.
  if (dismissedStatus === status.status) {
    return null;
  }

  const meta = STATUS_META[status.status];
  // Si el estado tiene CTA=checkout y es "trial" → preferimos abrir el modal
  // de planes (el cliente elige un plan concreto) en vez de ir directo al
  // checkout con el price default.
  const shouldOpenPlans =
    meta.cta?.kind === "checkout" &&
    (status.status === "trial" ||
      status.status === "trial_expired" ||
      status.status === "canceled");

  return (
    <>
      <div style={{ flexShrink: 0 }}>
        <BillingStatusBanner
          data={status}
          busy={busy}
          onCheckout={() => {
            if (shouldOpenPlans) {
              setPlansOpen(true);
            } else {
              checkout();
            }
          }}
          onPortal={() => portal()}
          onDismiss={
            status.can_serve ? () => setDismissedStatus(status.status) : undefined
          }
        />
        {error && (
          <div
            role="alert"
            style={{
              padding: "6px 14px",
              fontSize: 11.5,
              color: "var(--z-red)",
              background: "oklch(0.68 0.21 25 / 0.08)",
              borderBottom: "1px solid oklch(0.68 0.21 25 / 0.32)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ flex: 1 }}>{error}</span>
            <button
              type="button"
              onClick={resetError}
              aria-label="Descartar error"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                borderRadius: 4,
                border: "none",
                background: "transparent",
                color: "var(--text-3)",
                cursor: "pointer",
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      <PlansModal open={plansOpen} onClose={() => setPlansOpen(false)} />
    </>
  );
}
