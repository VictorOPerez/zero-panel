"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Check, ExternalLink, Loader2, X, Zap } from "lucide-react";
import {
  cancelSubscription,
  getTenantBilling,
  getTenantSubscriptionStatus,
  listPlans,
} from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import {
  BillingStatusBanner,
  BillingStatusSkeleton,
} from "@/components/billing/billing-status";
import { useBillingActions } from "@/lib/hooks/use-billing-actions";
import { resolvePlanDisplay } from "@/lib/billing/default-plan";
import type { BillingPlan } from "@/lib/api/contract";

export function BillingView() {
  return <RequireTenant>{(tenantId) => <Billing tenantId={tenantId} />}</RequireTenant>;
}

function Billing({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<
    | { kind: "ok"; text: string }
    | { kind: "error"; text: string }
    | null
  >(null);

  // Lee ?checkout=ok|cancel para mostrar feedback post-redirect desde Stripe.
  useEffect(() => {
    const checkout = searchParams?.get("checkout");
    if (checkout === "cancel") {
      setBanner({
        kind: "error",
        text: "El checkout se canceló. Tu suscripción no cambió.",
      });
    } else if (checkout === "ok") {
      setBanner({
        kind: "ok",
        text: "Suscripción confirmada. El cambio puede tardar unos segundos en reflejarse.",
      });
      // El webhook de Stripe actualiza el backend; invalidamos para tomar el
      // nuevo estado apenas esté listo.
      qc.invalidateQueries({ queryKey: ["tenant-status", tenantId] });
      qc.invalidateQueries({ queryKey: ["billing", tenantId] });
    }
  }, [searchParams, qc, tenantId]);

  const billingQuery = useQuery({
    queryKey: ["billing", tenantId],
    queryFn: () => getTenantBilling(tenantId),
  });
  const statusQuery = useQuery({
    queryKey: ["tenant-status", tenantId],
    queryFn: () => getTenantSubscriptionStatus(tenantId),
  });
  const plansQuery = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => listPlans(),
  });

  const {
    checkout,
    portal,
    busy,
    error: actionError,
    resetError,
    checkoutVariables,
  } = useBillingActions(tenantId);

  const cancel = useMutation({
    mutationFn: () => cancelSubscription(tenantId, false),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing", tenantId] });
      qc.invalidateQueries({ queryKey: ["tenant-status", tenantId] });
      setBanner({
        kind: "ok",
        text: "Tu suscripción queda activa hasta el final del período actual.",
      });
    },
    onError: (err) => {
      setBanner({
        kind: "error",
        text:
          err instanceof ApiError
            ? err.payload.error
            : "No pudimos cancelar la suscripción.",
      });
    },
  });

  const status = statusQuery.data;
  const billing = billingQuery.data?.billing;
  const plans = plansQuery.data?.plans ?? [];

  const combinedError = actionError ?? (banner?.kind === "error" ? banner.text : null);
  const okBanner = banner?.kind === "ok" ? banner.text : null;

  return (
    <PageShell
      title="Facturación"
      subtitle="Plan, consumo y gestión de suscripción."
      actions={
        <button
          type="button"
          onClick={() => portal()}
          disabled={busy === "portal" || !billing?.stripe_customer_id}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 5,
            border: "1px solid var(--hair-strong)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--text-1)",
            fontSize: 12,
            fontWeight: 500,
            cursor: billing?.stripe_customer_id ? "pointer" : "not-allowed",
            opacity: billing?.stripe_customer_id ? 1 : 0.6,
          }}
          title={
            !billing?.stripe_customer_id
              ? "Activá un plan primero para acceder al portal."
              : undefined
          }
        >
          {busy === "portal" ? (
            <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
          ) : (
            <ExternalLink size={12} />
          )}
          Portal de Stripe
        </button>
      }
    >
      {/* Banner de estado — arriba de todo */}
      <div style={{ marginBottom: 14 }}>
        {statusQuery.isLoading && !status ? (
          <BillingStatusSkeleton />
        ) : status ? (
          <BillingStatusBanner
            data={status}
            busy={busy}
            compact
            onCheckout={() => checkout()}
            onPortal={() => portal()}
          />
        ) : null}
      </div>

      {/* Feedback banners */}
      {okBanner && (
        <Toast
          kind="ok"
          text={okBanner}
          onClose={() => setBanner(null)}
        />
      )}
      {combinedError && (
        <Toast
          kind="error"
          text={combinedError}
          onClose={() => {
            resetError();
            setBanner(null);
          }}
        />
      )}

      <div className="grid-kpis" style={{ marginBottom: 14 }}>
        <Kpi label="Plan" value={billing?.plan ?? "—"} />
        <Kpi
          label="Estado Stripe"
          value={
            status?.stripe_subscription_status ??
            billing?.stripe_subscription_status ??
            "—"
          }
        />
        <Kpi
          label="Uso mensual"
          value={
            status
              ? `${status.tokens_used_this_period.toLocaleString()} / ${status.monthly_token_limit.toLocaleString()}`
              : "—"
          }
          hint={status ? `${Math.round(status.usage_percent)}% usado` : undefined}
        />
        <Kpi
          label="Trial"
          value={
            status?.trial_days_remaining !== undefined
              ? `${status.trial_days_remaining} días`
              : "—"
          }
          hint={
            status?.trial_ends_at
              ? `hasta ${new Date(status.trial_ends_at).toLocaleDateString()}`
              : undefined
          }
        />
      </div>

      <div
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        Planes disponibles
      </div>

      {/* Si hay exactamente 1 plan (el Básico hoy) mostramos la ficha rica con
          features completas. Si en el futuro hay múltiples, cae al grid. */}
      {plans.length <= 1 ? (
        <RichPlanCard
          plan={plans[0]}
          billing={billing}
          loading={busy === "checkout"}
          onChoose={(priceId) => checkout(priceId)}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 12,
          }}
        >
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              current={billing?.plan === p.id || billing?.stripe_price_id === p.price_id}
              loading={busy === "checkout" && checkoutVariables === p.price_id}
              disabled={busy === "checkout" && checkoutVariables !== p.price_id}
              onChoose={() => checkout(p.price_id)}
            />
          ))}
        </div>
      )}

      {billing?.stripe_subscription_id && status?.can_serve && (
        <div style={{ marginTop: 18, fontSize: 12, color: "var(--text-3)" }}>
          <button
            type="button"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
            style={{
              padding: "6px 12px",
              borderRadius: 5,
              border: "1px solid var(--hair-strong)",
              background: "transparent",
              color: "var(--text-2)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {cancel.isPending
              ? "Cancelando…"
              : "Cancelar suscripción al final del período"}
          </button>
        </div>
      )}
    </PageShell>
  );
}

function Toast({
  kind,
  text,
  onClose,
}: {
  kind: "ok" | "error";
  text: string;
  onClose: () => void;
}) {
  const tone =
    kind === "ok"
      ? {
          background: "oklch(0.70 0.18 160 / 0.10)",
          border: "1px solid oklch(0.70 0.18 160 / 0.32)",
          color: "var(--z-green)",
        }
      : {
          background: "oklch(0.68 0.21 25 / 0.08)",
          border: "1px solid oklch(0.68 0.21 25 / 0.38)",
          color: "var(--z-red)",
        };
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 8,
        marginBottom: 14,
        ...tone,
      }}
    >
      <span style={{ flex: 1, fontSize: 12.5 }}>{text}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: 4,
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass" style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 3 }}>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{hint}</div>}
    </div>
  );
}

/**
 * Card rica del plan — usada cuando hay 1 solo plan para vender. Muestra
 * features completas (hardcodeadas si el backend no las trae), precio
 * grande, CTA prominente. Mismo copy/estructura que el PlansModal pero
 * inline en la página /billing.
 */
function RichPlanCard({
  plan,
  billing,
  loading,
  onChoose,
}: {
  plan: BillingPlan | undefined;
  billing:
    | { plan?: string; stripe_price_id?: string }
    | undefined;
  loading: boolean;
  onChoose: (priceId: string) => void;
}) {
  const display = resolvePlanDisplay(plan);
  const isCurrent =
    !!plan &&
    (billing?.plan === plan.id || billing?.stripe_price_id === plan.price_id);

  const handleClick = () => {
    if (!display.canCheckout || !plan?.price_id) return;
    onChoose(plan.price_id);
  };

  return (
    <div
      className="glass rich-plan-card"
      style={{
        position: "relative",
        padding: 0,
        overflow: "hidden",
        border: "1px solid oklch(0.62 0.22 295 / 0.35)",
      }}
    >
      {/* Top accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "var(--aurora)",
        }}
      />

      <div className="rich-plan-grid">
        {/* Lado izquierdo: precio + CTA */}
        <div
          style={{
            padding: "26px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "var(--aurora)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0a0a0f",
                flexShrink: 0,
              }}
            >
              <Zap size={17} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  fontWeight: 700,
                }}
              >
                Plan
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: "var(--text-0)",
                  lineHeight: 1.1,
                }}
              >
                {display.name}
                {isCurrent && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: "oklch(0.70 0.18 160 / 0.16)",
                      color: "var(--z-green)",
                      border: "1px solid oklch(0.70 0.18 160 / 0.35)",
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontWeight: 600,
                      verticalAlign: "middle",
                    }}
                  >
                    ACTUAL
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span
              className="aurora-text"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: "clamp(38px, 6vw, 50px)",
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: -1,
              }}
            >
              ${display.monthly_price_usd}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 500 }}>
              USD / mes
            </span>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-3)",
              fontFamily: "var(--font-jetbrains-mono)",
              marginTop: -4,
            }}
          >
            ≈ {display.token_limit.toLocaleString("en-US")} tokens · ~2.500 conversaciones/mes
          </div>

          <p
            style={{
              fontSize: 13,
              color: "var(--text-2)",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {display.description}
          </p>

          <button
            type="button"
            onClick={handleClick}
            disabled={!display.canCheckout || loading || isCurrent}
            title={
              isCurrent
                ? "Ya estás suscripto a este plan"
                : !display.canCheckout
                  ? "Pronto vas a poder activar el plan desde acá. Mientras tanto escribinos por WhatsApp."
                  : undefined
            }
            style={{
              marginTop: 4,
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 18px",
              borderRadius: 9,
              border: "none",
              background:
                isCurrent
                  ? "rgba(255,255,255,0.04)"
                  : display.canCheckout
                    ? "var(--aurora)"
                    : "rgba(255,255,255,0.06)",
              color: isCurrent
                ? "var(--text-2)"
                : display.canCheckout
                  ? "#0a0a0f"
                  : "var(--text-3)",
              fontSize: 13.5,
              fontWeight: 700,
              letterSpacing: 0.2,
              cursor:
                !display.canCheckout || loading || isCurrent ? "not-allowed" : "pointer",
              boxShadow:
                display.canCheckout && !isCurrent
                  ? "0 6px 18px oklch(0.62 0.22 295 / 0.3)"
                  : undefined,
            }}
          >
            {loading ? (
              <Loader2 size={14} style={{ animation: "spin 900ms linear infinite" }} />
            ) : null}
            {loading
              ? "Redirigiendo…"
              : isCurrent
                ? "Plan actual"
                : display.canCheckout
                  ? "Activar plan ahora →"
                  : "Próximamente"}
          </button>

          <div
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Pago seguro con Stripe · Sin permanencia · Cancelás en 1 clic
          </div>
        </div>

        {/* Lado derecho: features completas */}
        <div
          style={{
            padding: "26px 24px",
            borderLeft: "1px solid var(--hair)",
            background: "rgba(255,255,255,0.015)",
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Todo incluido
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 9,
            }}
          >
            {display.features.map((f) => (
              <li
                key={f}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 9,
                  fontSize: 12.5,
                  color: "var(--text-1)",
                  lineHeight: 1.45,
                }}
              >
                <Check
                  size={13}
                  strokeWidth={3}
                  style={{
                    color: "var(--z-cyan)",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  current,
  loading,
  disabled,
  onChoose,
}: {
  plan: BillingPlan;
  current: boolean;
  loading: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  return (
    <div
      className="glass"
      style={{
        ...cardStyle,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        border: current ? "1px solid oklch(0.62 0.22 295 / 0.5)" : "1px solid var(--hair)",
        background: current
          ? "linear-gradient(180deg, oklch(0.62 0.22 295 / 0.10), transparent)"
          : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{plan.name}</div>
        {current && (
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-jetbrains-mono)",
              padding: "2px 6px",
              borderRadius: 4,
              background: "oklch(0.62 0.22 295 / 0.2)",
              color: "var(--text-0)",
            }}
          >
            actual
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)" }}>
        {plan.monthly_price_usd !== undefined ? `$${plan.monthly_price_usd}` : "—"}
        <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}> /mes</span>
      </div>
      {plan.token_limit !== undefined && (
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>
          {plan.token_limit.toLocaleString("en-US")} tokens/mes
        </div>
      )}
      {plan.description && (
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>{plan.description}</div>
      )}
      {plan.features && (
        <ul
          style={{
            margin: 0,
            paddingLeft: 16,
            fontSize: 12,
            color: "var(--text-1)",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {plan.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onChoose}
        disabled={current || loading || disabled}
        style={{
          marginTop: "auto",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "7px 14px",
          borderRadius: 6,
          border: current ? "1px solid var(--hair-strong)" : "none",
          background: current ? "rgba(255,255,255,0.04)" : "var(--aurora)",
          color: current ? "var(--text-3)" : "#0a0a0f",
          fontSize: 12,
          fontWeight: 600,
          cursor: current || loading || disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {loading ? (
          <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
        ) : null}
        {loading ? "Redirigiendo…" : current ? "Plan actual" : "Elegir plan"}
      </button>
    </div>
  );
}
