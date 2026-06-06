"use client";

import { X, Check, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listPlans } from "@/lib/api/billing";
import { useAuthStore } from "@/store/auth";
import { useBillingActions } from "@/lib/hooks/use-billing-actions";
import {
  resolveTiers,
  SALES_CONTACT_HREF,
  type ResolvedTier,
} from "@/lib/billing/plan-presentation";

interface Props {
  open: boolean;
  onClose: () => void;
}

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

  const tiers = resolveTiers(plansQuery.data?.plans ?? []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Planes"
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
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}
      />

      <div className="plans-modal-shell">
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

        {/* Header */}
        <div style={{ padding: "32px 28px 14px", textAlign: "center" }}>
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
            Planes
          </div>
          <h2
            style={{
              margin: "14px 0 8px",
              fontSize: "clamp(22px, 4vw, 30px)",
              fontWeight: 700,
              letterSpacing: -0.5,
              lineHeight: 1.15,
              color: "var(--text-0)",
            }}
          >
            Tu negocio atendiendo clientes <span className="aurora-text">24/7</span>
          </h2>
          <p style={{ margin: "0 auto", maxWidth: 520, fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.55 }}>
            Elegí según cuánto vende tu negocio. Sin permanencia, cancelás en 1 clic.
          </p>
        </div>

        {plansQuery.isLoading ? (
          <div style={loadingBoxStyle}>
            <Loader2 size={16} style={{ animation: "spin 900ms linear infinite" }} />
            Cargando planes…
          </div>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                style={{
                  margin: "0 28px 8px",
                  padding: "8px 12px",
                  borderRadius: 7,
                  border: "1px solid oklch(0.68 0.21 25 / 0.35)",
                  background: "oklch(0.68 0.21 25 / 0.08)",
                  color: "var(--z-red)",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            <div className="plans-tier-grid">
              {tiers.map((tier) => (
                <TierCard
                  key={tier.id}
                  tier={tier}
                  disabled={!tenantId}
                  inFlight={busy === "checkout" && checkoutVariables === tier.priceId}
                  onCheckout={() => tier.priceId && checkout(tier.priceId)}
                />
              ))}
            </div>

            <p
              style={{
                margin: 0,
                padding: "0 28px 24px",
                textAlign: "center",
                fontSize: 11.5,
                color: "var(--text-3)",
                lineHeight: 1.5,
              }}
            >
              Pago seguro con Stripe · Una conversación = un cliente que te escribe, sin importar cuántos mensajes intercambien.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function TierCard({
  tier,
  disabled,
  inFlight,
  onCheckout,
}: {
  tier: ResolvedTier;
  disabled: boolean;
  inFlight: boolean;
  onCheckout: () => void;
}) {
  const accent = tier.highlight ? "var(--z-purple)" : "var(--z-cyan)";

  return (
    <div className={`plan-tier-card${tier.highlight ? " is-highlight" : ""}`}>
      {tier.badge && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "3px 12px",
            borderRadius: 999,
            background: "var(--aurora)",
            color: "#0a0a0f",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {tier.badge}
        </div>
      )}

      {/* Nombre + tagline */}
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-0)" }}>{tier.name}</div>
      <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.4, marginTop: 3, minHeight: 34 }}>
        {tier.tagline}
      </div>

      {/* Precio */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 14 }}>
        {tier.monthlyUsd === null ? (
          <span className="aurora-text" style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
            Hablemos
          </span>
        ) : (
          <>
            <span
              className={tier.highlight ? "aurora-text" : undefined}
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 36,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: -1,
                color: tier.highlight ? undefined : "var(--text-0)",
              }}
            >
              ${tier.monthlyUsd}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--text-3)", fontWeight: 500 }}>USD/mes</span>
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-jetbrains-mono)", marginTop: 4 }}>
        {tier.capacity}
      </div>

      {/* CTA */}
      {tier.contact ? (
        <a
          href={SALES_CONTACT_HREF}
          style={{ ...ctaBase, background: "rgba(255,255,255,0.06)", color: "var(--text-0)", border: "1px solid var(--hair-strong)" }}
        >
          Hablar con ventas
          <ArrowRight size={14} />
        </a>
      ) : (
        <button
          type="button"
          onClick={onCheckout}
          disabled={!tier.canCheckout || disabled || inFlight}
          title={
            disabled
              ? "Seleccioná un workspace primero"
              : !tier.canCheckout
                ? "Pronto vas a poder activarlo desde acá. Escribinos por WhatsApp mientras tanto."
                : undefined
          }
          style={{
            ...ctaBase,
            background: tier.canCheckout
              ? tier.highlight
                ? "var(--aurora)"
                : "rgba(255,255,255,0.06)"
              : "rgba(255,255,255,0.04)",
            color: tier.canCheckout ? (tier.highlight ? "#0a0a0f" : "var(--text-0)") : "var(--text-3)",
            border: tier.highlight ? "none" : "1px solid var(--hair-strong)",
            cursor: !tier.canCheckout || disabled || inFlight ? "not-allowed" : "pointer",
            boxShadow: tier.highlight && tier.canCheckout ? "0 8px 24px oklch(0.62 0.22 295 / 0.35)" : undefined,
          }}
        >
          {inFlight ? <Loader2 size={14} style={{ animation: "spin 900ms linear infinite" }} /> : null}
          {inFlight ? "Redirigiendo…" : tier.canCheckout ? "Activar plan" : "Próximamente"}
        </button>
      )}

      {/* Features */}
      <ul
        style={{
          margin: "16px 0 0",
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {tier.features.map((f) => (
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--text-1)", lineHeight: 1.4 }}>
            <Check size={13} strokeWidth={3} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ctaBase: React.CSSProperties = {
  marginTop: 16,
  width: "100%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "11px 16px",
  borderRadius: 10,
  fontSize: 13.5,
  fontWeight: 700,
  letterSpacing: 0.2,
  textDecoration: "none",
};

const loadingBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "80px 40px",
  color: "var(--text-3)",
  fontSize: 13,
};
