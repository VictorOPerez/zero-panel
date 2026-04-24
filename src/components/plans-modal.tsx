"use client";

import { X, Check, Zap, Loader2, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listPlans } from "@/lib/api/billing";
import { useAuthStore } from "@/store/auth";
import { useBillingActions } from "@/lib/hooks/use-billing-actions";
import { resolvePlanDisplay } from "@/lib/billing/default-plan";

interface Props {
  open: boolean;
  onClose: () => void;
}

const HIGHLIGHT_FEATURES = [
  { label: "Tu bot responde 24/7", hint: "incluso mientras dormís" },
  { label: "Reservas automáticas", hint: "directo a Google Calendar" },
  { label: "Panel en tu mano", hint: "desde el teléfono" },
];

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

  const backendPlans = plansQuery.data?.plans ?? [];
  const plan = backendPlans[0];
  const display = resolvePlanDisplay(plan);
  const { name, description, features, monthly_price_usd: priceUsd, token_limit: tokenLimit, canCheckout } = display;

  const checkoutInFlight = busy === "checkout" && checkoutVariables === plan?.price_id;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Activar plan"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(0px, 3vw, 20px)",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(8px)",
        }}
      />

      {/* Panel */}
      <div className="plans-modal-panel-v2">
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 7,
            border: "1px solid var(--hair)",
            background: "rgba(10,10,15,0.6)",
            color: "var(--text-2)",
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          <X size={14} />
        </button>

        {plansQuery.isLoading ? (
          <div style={loadingBoxStyle}>
            <Loader2 size={16} style={{ animation: "spin 900ms linear infinite" }} />
            Cargando plan…
          </div>
        ) : (
          <div className="plans-modal-grid-v2">
            {/* Columna izquierda: hero + beneficios chicos */}
            <div className="plans-modal-hero">
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "oklch(0.62 0.22 295 / 0.15)",
                  border: "1px solid oklch(0.62 0.22 295 / 0.35)",
                  color: "var(--text-0)",
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  fontFamily: "var(--font-jetbrains-mono)",
                  textTransform: "uppercase",
                }}
              >
                <Sparkles size={11} />
                Plan único · Básico
              </div>

              <h2
                style={{
                  margin: "14px 0 10px",
                  fontSize: "clamp(22px, 4.2vw, 30px)",
                  fontWeight: 700,
                  letterSpacing: -0.5,
                  lineHeight: 1.15,
                  color: "var(--text-0)",
                }}
              >
                Tu negocio atendiendo clientes{" "}
                <span className="aurora-text">24 horas al día</span>, sin que vos
                tengas que contestar.
              </h2>

              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  color: "var(--text-2)",
                  lineHeight: 1.55,
                  marginBottom: 18,
                }}
              >
                {description}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {HIGHLIGHT_FEATURES.map((h) => (
                  <div
                    key={h.label}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 7,
                        background: "oklch(0.70 0.18 160 / 0.14)",
                        border: "1px solid oklch(0.70 0.18 160 / 0.4)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <Check size={12} style={{ color: "var(--z-green)" }} strokeWidth={3} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "var(--text-0)",
                          lineHeight: 1.35,
                        }}
                      >
                        {h.label}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.3 }}>
                        {h.hint}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Columna derecha: card de precio + features + CTA */}
            <div className="plans-modal-card">
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

              <div style={{ padding: "28px 26px 22px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--aurora)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#0a0a0f",
                      flexShrink: 0,
                    }}
                  >
                    <Zap size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--text-3)",
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                        fontWeight: 600,
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
                      {name}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span
                    className="aurora-text"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontSize: "clamp(42px, 7vw, 54px)",
                      fontWeight: 800,
                      lineHeight: 1,
                      letterSpacing: -1,
                    }}
                  >
                    ${priceUsd}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--text-3)",
                      fontWeight: 500,
                    }}
                  >
                    USD / mes
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-3)",
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                >
                  ≈ {tokenLimit.toLocaleString("en-US")} tokens · ~2.500 conversaciones/mes
                </div>

                {/* Error */}
                {error && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 14,
                      padding: "8px 12px",
                      borderRadius: 7,
                      border: "1px solid oklch(0.68 0.21 25 / 0.35)",
                      background: "oklch(0.68 0.21 25 / 0.08)",
                      color: "var(--z-red)",
                      fontSize: 12,
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* CTA */}
                <button
                  type="button"
                  onClick={() => canCheckout && plan?.price_id && checkout(plan.price_id)}
                  disabled={!canCheckout || !tenantId || checkoutInFlight}
                  title={
                    !tenantId
                      ? "Seleccioná un workspace primero"
                      : !canCheckout
                        ? "Pronto vas a poder activar el plan desde acá. Escribinos por WhatsApp mientras tanto."
                        : undefined
                  }
                  style={{
                    marginTop: 18,
                    width: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "13px 18px",
                    borderRadius: 10,
                    border: "none",
                    background: canCheckout ? "var(--aurora)" : "rgba(255,255,255,0.06)",
                    color: canCheckout ? "#0a0a0f" : "var(--text-3)",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 0.2,
                    cursor:
                      !canCheckout || !tenantId || checkoutInFlight
                        ? "not-allowed"
                        : "pointer",
                    boxShadow: canCheckout
                      ? "0 8px 24px oklch(0.62 0.22 295 / 0.35)"
                      : undefined,
                    transition: "transform 80ms ease",
                  }}
                  onMouseDown={(e) => {
                    if (canCheckout) e.currentTarget.style.transform = "scale(0.98)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  {checkoutInFlight ? (
                    <Loader2 size={14} style={{ animation: "spin 900ms linear infinite" }} />
                  ) : null}
                  {checkoutInFlight
                    ? "Redirigiendo a pago…"
                    : canCheckout
                      ? "Activar plan ahora →"
                      : "Próximamente"}
                </button>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11.5,
                    color: "var(--text-3)",
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  Pago seguro con Stripe · Sin permanencia · Cancelás en 1 clic
                </div>
              </div>

              {/* Features completas */}
              <div
                style={{
                  padding: "18px 26px 24px",
                  borderTop: "1px solid var(--hair)",
                  background: "rgba(255,255,255,0.015)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    fontWeight: 700,
                    marginBottom: 10,
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
                    gap: 8,
                  }}
                >
                  {features.map((f) => (
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
        )}
      </div>
    </div>
  );
}

const loadingBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "80px 40px",
  color: "var(--text-3)",
  fontSize: 13,
};
