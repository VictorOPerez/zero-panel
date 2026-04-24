"use client";

import { X, Check, Zap, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { IconSparkle } from "@/components/icons";
import { listPlans } from "@/lib/api/billing";
import { useAuthStore } from "@/store/auth";
import { useBillingActions } from "@/lib/hooks/use-billing-actions";
import type { BillingPlan } from "@/lib/api/contract";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal con los planes disponibles en Stripe.
 *
 * Carga `GET /api/billing/plans` (misma fuente de verdad que la página
 * /billing) y cada botón dispara `createCheckoutSession` para el price_id
 * correspondiente, redirigiendo al checkout alojado en Stripe.
 *
 * Si el backend no devuelve planes (entorno sin Stripe configurado), muestra
 * un fallback con un CTA para contactar ventas.
 */
export function PlansModal({ open, onClose }: Props) {
  const tenantId = useAuthStore((s) => s.activeTenantId);

  const plansQuery = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => listPlans(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const { checkout, busy, checkoutVariables, error } = useBillingActions(tenantId);

  if (!open) return null;

  const plans = plansQuery.data?.plans ?? [];
  const highlightIdx = plans.length > 1 ? 1 : plans.length === 1 ? 0 : -1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Seleccionar plan"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(0px, 4vw, 16px)",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(6px)",
        }}
      />

      {/* Panel */}
      <div className="plans-modal-panel">
        {/* Header */}
        <div
          style={{
            padding: "24px 28px 20px",
            borderBottom: "1px solid var(--hair)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "var(--aurora)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0a0a0f",
              flexShrink: 0,
            }}
          >
            <Zap size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>
              Activar plan
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>
              Elegí el plan que mejor se adapta a tu negocio. Podés cambiar o cancelar cuando quieras.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid var(--hair)",
              background: "transparent",
              color: "var(--text-2)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            style={{
              margin: "12px 28px 0",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid oklch(0.68 0.21 25 / 0.35)",
              background: "oklch(0.68 0.21 25 / 0.08)",
              color: "var(--z-red)",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Plans body */}
        {plansQuery.isLoading ? (
          <div
            style={{
              padding: "48px 28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              color: "var(--text-3)",
              fontSize: 13,
            }}
          >
            <Loader2 size={14} style={{ animation: "spin 900ms linear infinite" }} />
            Cargando planes…
          </div>
        ) : plans.length === 0 ? (
          <div
            style={{
              padding: "40px 28px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              textAlign: "center",
              color: "var(--text-2)",
              fontSize: 13,
            }}
          >
            <div style={{ color: "var(--text-0)", fontWeight: 600 }}>
              No hay planes configurados
            </div>
            <div>
              Todavía no hay planes disponibles en este entorno. Contactá al
              equipo para activar tu suscripción.
            </div>
          </div>
        ) : (
          <div className="grid-plans plans-modal-body">
            {plans.map((plan, idx) => (
              <PlanColumn
                key={plan.id}
                plan={plan}
                highlight={idx === highlightIdx}
                busy={busy === "checkout" && checkoutVariables === plan.price_id}
                disabled={busy === "checkout" && checkoutVariables !== plan.price_id}
                tenantMissing={!tenantId}
                onChoose={() => checkout(plan.price_id)}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: "14px 28px",
            borderTop: "1px solid var(--hair)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontSize: 11,
            color: "var(--text-3)",
          }}
        >
          <Check size={11} style={{ color: "var(--z-green)" }} />
          Sin permanencia · Cancelá cuando quieras · Soporte incluido en todos los planes
        </div>
      </div>
    </div>
  );
}

function PlanColumn({
  plan,
  highlight,
  busy,
  disabled,
  tenantMissing,
  onChoose,
}: {
  plan: BillingPlan;
  highlight: boolean;
  busy: boolean;
  disabled: boolean;
  tenantMissing: boolean;
  onChoose: () => void;
}) {
  const priceLabel =
    plan.monthly_price_usd !== undefined ? `$${plan.monthly_price_usd}` : "Custom";
  const period = plan.monthly_price_usd !== undefined ? "/ mes" : "";

  return (
    <div
      style={{
        padding: "24px 24px 28px",
        position: "relative",
        background: highlight
          ? "linear-gradient(180deg, oklch(0.62 0.22 295 / 0.08) 0%, transparent 60%)"
          : "transparent",
      }}
    >
      {highlight && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "var(--aurora)",
          }}
        />
      )}

      {highlight ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 9px",
            borderRadius: 20,
            background: "var(--aurora)",
            color: "#0a0a0f",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.05em",
            marginBottom: 12,
          }}
        >
          <IconSparkle size={9} />
          MÁS POPULAR
        </div>
      ) : (
        <div style={{ height: 33 }} />
      )}

      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-0)" }}>
        {plan.name}
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          className={highlight ? "aurora-text" : ""}
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 32,
            fontWeight: 700,
            color: highlight ? undefined : "var(--text-0)",
          }}
        >
          {priceLabel}
        </span>
        {period && (
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{period}</span>
        )}
      </div>
      {plan.description && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-2)",
            marginTop: 8,
            lineHeight: 1.5,
            minHeight: 40,
          }}
        >
          {plan.description}
        </div>
      )}
      {plan.token_limit !== undefined && (
        <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--text-3)" }}>
          {plan.token_limit.toLocaleString("en-US")} tokens / mes
        </div>
      )}

      <button
        type="button"
        onClick={onChoose}
        disabled={busy || disabled || tenantMissing}
        title={tenantMissing ? "Seleccioná un workspace primero" : undefined}
        style={{
          marginTop: 18,
          width: "100%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "9px 16px",
          borderRadius: 7,
          border: highlight ? "none" : "1px solid var(--hair-strong)",
          background: highlight ? "var(--aurora)" : "rgba(255,255,255,0.04)",
          color: highlight ? "#0a0a0f" : "var(--text-1)",
          fontSize: 12,
          fontWeight: 600,
          cursor:
            busy || disabled || tenantMissing ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {busy ? (
          <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
        ) : null}
        {busy ? "Redirigiendo…" : `Elegir ${plan.name}`}
      </button>

      {plan.features && plan.features.length > 0 && (
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 9 }}>
          {plan.features.map((f) => (
            <div
              key={f}
              style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}
            >
              <Check
                size={13}
                style={{
                  color: highlight ? "var(--z-cyan)" : "var(--z-green)",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              />
              <span style={{ color: "var(--text-1)", lineHeight: 1.4 }}>{f}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
