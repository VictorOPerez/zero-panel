"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import {
  cancelSubscription,
  getSubscriptionInfo,
  getTenantBilling,
  getTenantSubscriptionStatus,
  listPlans,
  resumeSubscription,
} from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import {
  BillingStatusBanner,
  BillingStatusSkeleton,
} from "@/components/billing/billing-status";
import { useBillingActions } from "@/lib/hooks/use-billing-actions";
import {
  resolveTiers,
  SALES_CONTACT_HREF,
  type ResolvedTier,
} from "@/lib/billing/plan-presentation";
import type { TenantStatusReport } from "@/lib/api/contract";

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

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const billingQuery = useQuery({
    queryKey: ["billing", tenantId],
    queryFn: () => getTenantBilling(tenantId),
  });
  const statusQuery = useQuery({
    queryKey: ["tenant-status", tenantId],
    queryFn: () => getTenantSubscriptionStatus(tenantId),
  });
  const subscriptionQuery = useQuery({
    queryKey: ["subscription", tenantId],
    queryFn: () => getSubscriptionInfo(tenantId),
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
    notice: actionNotice,
    resetError,
    resetNotice,
    checkoutVariables,
  } = useBillingActions(tenantId);

  const invalidateBilling = () => {
    qc.invalidateQueries({ queryKey: ["billing", tenantId] });
    qc.invalidateQueries({ queryKey: ["tenant-status", tenantId] });
    qc.invalidateQueries({ queryKey: ["subscription", tenantId] });
  };

  const cancel = useMutation({
    mutationFn: () => cancelSubscription(tenantId, false),
    onSuccess: () => {
      invalidateBilling();
      setConfirmCancelOpen(false);
      setBanner({
        kind: "ok",
        text: "Tu suscripción queda activa hasta el final del período actual.",
      });
    },
    onError: (err) => {
      setConfirmCancelOpen(false);
      setBanner({
        kind: "error",
        text:
          err instanceof ApiError
            ? err.payload.error
            : "No pudimos cancelar la suscripción.",
      });
    },
  });

  const resume = useMutation({
    mutationFn: () => resumeSubscription(tenantId),
    onSuccess: () => {
      invalidateBilling();
      setBanner({
        kind: "ok",
        text: "¡Listo! Tu suscripción sigue activa — la cancelación quedó sin efecto.",
      });
    },
    onError: (err) => {
      setBanner({
        kind: "error",
        text:
          err instanceof ApiError
            ? err.payload.error
            : "No pudimos reanudar la suscripción.",
      });
    },
  });

  const status = statusQuery.data;
  const billing = billingQuery.data?.billing;
  const subscription = subscriptionQuery.data?.subscription;
  const plans = plansQuery.data?.plans ?? [];

  const periodEndLabel = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const combinedError = actionError ?? (banner?.kind === "error" ? banner.text : null);
  const okBanner = actionNotice ?? (banner?.kind === "ok" ? banner.text : null);

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

      {/* Aviso de cancelación programada + reanudar */}
      {subscription?.cancel_at_period_end && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 14,
            background: "oklch(0.80 0.14 75 / 0.10)",
            border: "1px solid oklch(0.80 0.14 75 / 0.35)",
            color: "var(--z-amber)",
          }}
        >
          <span style={{ flex: 1, fontSize: 12.5, minWidth: 220 }}>
            Tu suscripción se cancela{" "}
            {periodEndLabel ? `el ${periodEndLabel}` : "al final del período actual"}. Hasta
            entonces seguís con todas las funciones.
          </span>
          <button
            type="button"
            onClick={() => resume.mutate()}
            disabled={resume.isPending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid oklch(0.80 0.14 75 / 0.45)",
              background: "oklch(0.80 0.14 75 / 0.15)",
              color: "var(--z-amber)",
              fontSize: 12,
              fontWeight: 600,
              cursor: resume.isPending ? "wait" : "pointer",
            }}
          >
            {resume.isPending ? (
              <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
            ) : null}
            {resume.isPending ? "Reanudando…" : "Mantener mi suscripción"}
          </button>
        </div>
      )}

      {/* Feedback banners */}
      {okBanner && (
        <Toast
          kind="ok"
          text={okBanner}
          onClose={() => {
            resetNotice();
            setBanner(null);
          }}
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
          label="Uso del plan"
          value={status ? planUsageValue(status) : "—"}
          hint={
            status && !isUnlimited(status)
              ? `${Math.round(status.usage_percent)}% usado`
              : status
                ? "este mes"
                : undefined
          }
        />
        {subscription?.has_subscription ? (
          <Kpi
            label={subscription.cancel_at_period_end ? "Activo hasta" : "Próxima renovación"}
            value={
              subscription.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString("es-AR")
                : "—"
            }
            hint={subscription.cancel_at_period_end ? "cancelación programada" : undefined}
          />
        ) : (
          <Kpi
            label="Trial"
            value={
              status?.trial_days_remaining !== undefined
                ? `${status.trial_days_remaining} días`
                : "—"
            }
            hint={
              status?.trial_ends_at
                ? `hasta ${new Date(status.trial_ends_at).toLocaleDateString("es-AR")}`
                : undefined
            }
          />
        )}
      </div>

      {status && <PlanUsageCard status={status} />}

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

      {/* Grilla de planes con la presentación canónica (Esencial / Pro / Escala
          + A medida): features completas — incluyendo que el NÚMERO de WhatsApp
          va incluido en el alquiler. Cruza los price_id reales del backend para
          habilitar el checkout. El número virtual ya NO aparece como plan. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 12,
        }}
      >
        {resolveTiers(plans).map((tier) => (
          <TierBillingCard
            key={tier.id}
            tier={tier}
            current={
              billing?.plan === tier.id ||
              (!!tier.priceId && billing?.stripe_price_id === tier.priceId)
            }
            loading={busy === "checkout" && checkoutVariables === tier.priceId}
            disabled={busy === "checkout" && checkoutVariables !== tier.priceId}
            onChoose={() => tier.priceId && checkout(tier.priceId)}
          />
        ))}
      </div>

      {billing?.stripe_subscription_id &&
        status?.can_serve &&
        !subscription?.cancel_at_period_end && (
          <div style={{ marginTop: 18, fontSize: 12, color: "var(--text-3)" }}>
            <button
              type="button"
              onClick={() => setConfirmCancelOpen(true)}
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
              Cancelar suscripción al final del período
            </button>
          </div>
        )}

      {confirmCancelOpen && (
        <ConfirmCancelDialog
          periodEndLabel={periodEndLabel}
          pending={cancel.isPending}
          onConfirm={() => cancel.mutate()}
          onClose={() => setConfirmCancelOpen(false)}
        />
      )}
    </PageShell>
  );
}

function ConfirmCancelDialog({
  periodEndLabel,
  pending,
  onConfirm,
  onClose,
}: {
  periodEndLabel: string | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar cancelación de suscripción"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(3px)",
        padding: 16,
      }}
    >
      <div
        className="glass"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 12,
          border: "1px solid var(--hair-strong)",
          padding: "22px 22px 18px",
          background: "rgba(10,10,18,0.92)",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
          ¿Cancelar tu suscripción?
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55, margin: "0 0 6px" }}>
          Tu plan sigue activo{" "}
          {periodEndLabel ? (
            <>
              hasta el <strong style={{ color: "var(--text-0)" }}>{periodEndLabel}</strong>
            </>
          ) : (
            "hasta el final del período ya pagado"
          )}
          . Después de esa fecha tu agente deja de responder a tus clientes y el panel queda en
          modo lectura de tu plan.
        </p>
        <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55, margin: "0 0 16px" }}>
          Podés arrepentirte cuando quieras antes de esa fecha con un clic.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            style={{
              padding: "8px 14px",
              borderRadius: 7,
              border: "1px solid var(--hair-strong)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--text-1)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Mantener mi plan
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 7,
              border: "1px solid oklch(0.58 0.21 25)",
              background: "oklch(0.52 0.20 25)",
              color: "#fff",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? (
              <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
            ) : null}
            {pending ? "Cancelando…" : "Sí, cancelar"}
          </button>
        </div>
      </div>
    </div>
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

// Uso siempre en conversaciones (lenguaje del cliente), nunca tokens.
const UNLIMITED_CONV_THRESHOLD = 50_000; // por encima = "Ilimitado" (grants dueño)

function isUnlimited(s: TenantStatusReport): boolean {
  const total = s.estimated_conversations_total ?? -1;
  return total < 0 || total > UNLIMITED_CONV_THRESHOLD;
}

function planUsageValue(s: TenantStatusReport): string {
  if (isUnlimited(s)) return "Ilimitado";
  const used = s.estimated_conversations_used ?? 0;
  const total = s.estimated_conversations_total ?? 0;
  return `${used.toLocaleString("es-AR")} / ${total.toLocaleString("es-AR")}`;
}

function usageTone(percent: number): { color: string; track: string } {
  if (percent >= 100) return { color: "var(--z-red)", track: "oklch(0.68 0.21 25 / 0.18)" };
  if (percent >= 80) return { color: "var(--z-amber)", track: "oklch(0.80 0.14 75 / 0.16)" };
  return { color: "var(--z-green)", track: "rgba(255,255,255,0.06)" };
}

/**
 * Barra grande del consumo del período en /billing. Habla en conversaciones,
 * colores a 80% (ámbar) / 100% (rojo), con mensaje de upsell cuando se acerca
 * o llega al límite. Para tenants ilimitados muestra el estado sin barra.
 */
function PlanUsageCard({ status }: { status: TenantStatusReport }) {
  const unlimited = isUnlimited(status);
  const percent = Math.min(100, Math.max(0, Math.round(status.usage_percent)));
  const tone = usageTone(status.usage_percent);
  const used = status.estimated_conversations_used ?? 0;
  const total = status.estimated_conversations_total ?? 0;
  const remaining = status.estimated_conversations_remaining ?? -1;

  return (
    <div className="glass" style={{ ...cardStyle, marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "var(--text-3)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontWeight: 600,
          }}
        >
          Uso de este período
        </div>
        {!unlimited && (
          <div
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 13,
              fontWeight: 700,
              color: tone.color,
            }}
          >
            {percent}%
          </div>
        )}
      </div>

      {unlimited ? (
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>
          Conversaciones ilimitadas
        </div>
      ) : (
        <>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: tone.track,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                borderRadius: 999,
                background: tone.color,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 8,
              fontSize: 12,
              color: "var(--text-2)",
            }}
          >
            <span>
              ≈ {used.toLocaleString("es-AR")} de {total.toLocaleString("es-AR")} conversaciones
            </span>
            {remaining >= 0 && (
              <span style={{ color: tone.color, fontWeight: 600, whiteSpace: "nowrap" }}>
                {remaining.toLocaleString("es-AR")} restantes
              </span>
            )}
          </div>
          {status.usage_percent >= 80 && (
            <div style={{ fontSize: 11.5, color: tone.color, marginTop: 10, lineHeight: 1.45 }}>
              {status.usage_percent >= 100
                ? "Alcanzaste el límite de tu plan. Escalá para que tu asistente siga respondiendo conversaciones nuevas."
                : "Estás cerca del límite. Considerá escalar de plan para no quedarte sin conversaciones este mes."}
            </div>
          )}
        </>
      )}
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

function TierBillingCard({
  tier,
  current,
  loading,
  disabled,
  onChoose,
}: {
  tier: ResolvedTier;
  current: boolean;
  loading: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const accent = tier.highlight ? "var(--z-purple)" : "var(--z-cyan)";
  return (
    <div
      className="glass"
      style={{
        ...cardStyle,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        border: current
          ? "1px solid oklch(0.62 0.22 295 / 0.5)"
          : tier.highlight
            ? "1px solid oklch(0.62 0.22 295 / 0.35)"
            : "1px solid var(--hair)",
        background: current
          ? "linear-gradient(180deg, oklch(0.62 0.22 295 / 0.10), transparent)"
          : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{tier.name}</div>
        {current ? (
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-jetbrains-mono)",
              padding: "2px 6px",
              borderRadius: 4,
              background: "oklch(0.70 0.18 160 / 0.16)",
              color: "var(--z-green)",
              border: "1px solid oklch(0.70 0.18 160 / 0.35)",
            }}
          >
            actual
          </span>
        ) : tier.badge ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "var(--font-jetbrains-mono)",
              padding: "2px 7px",
              borderRadius: 4,
              background: "var(--aurora)",
              color: "#0a0a0f",
            }}
          >
            {tier.badge}
          </span>
        ) : null}
      </div>

      <div style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.4, minHeight: 30 }}>
        {tier.tagline}
      </div>

      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)" }}>
        {tier.monthlyUsd === null ? (
          <span className="aurora-text">Hablemos</span>
        ) : (
          <>
            ${tier.monthlyUsd}
            <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}> /mes</span>
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-jetbrains-mono)" }}>
        {tier.capacity}
      </div>

      <ul
        style={{
          margin: "4px 0 0",
          padding: 0,
          listStyle: "none",
          fontSize: 12,
          color: "var(--text-1)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {tier.features.map((f) => (
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 7, lineHeight: 1.4 }}>
            <Check size={12} strokeWidth={3} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {tier.contact ? (
        <a
          href={SALES_CONTACT_HREF}
          style={{
            marginTop: "auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid var(--hair-strong)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--text-0)",
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Hablar con ventas
        </a>
      ) : (
        <button
          type="button"
          onClick={onChoose}
          disabled={current || loading || disabled || !tier.canCheckout}
          title={
            !tier.canCheckout && !current
              ? "Pronto vas a poder activarlo desde acá. Escribinos por WhatsApp mientras tanto."
              : undefined
          }
          style={{
            marginTop: "auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 6,
            border: current || !tier.canCheckout ? "1px solid var(--hair-strong)" : "none",
            background:
              current || !tier.canCheckout ? "rgba(255,255,255,0.04)" : "var(--aurora)",
            color: current || !tier.canCheckout ? "var(--text-3)" : "#0a0a0f",
            fontSize: 12,
            fontWeight: 600,
            cursor:
              current || loading || disabled || !tier.canCheckout ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {loading ? (
            <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
          ) : null}
          {loading
            ? "Redirigiendo…"
            : current
              ? "Plan actual"
              : tier.canCheckout
                ? "Elegir plan"
                : "Próximamente"}
        </button>
      )}
    </div>
  );
}
