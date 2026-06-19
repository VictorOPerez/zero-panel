"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, X, Sparkles } from "lucide-react";
import { getTenant } from "@/lib/api/tenants";
import { getTenantBrief } from "@/lib/api/brief";
import { listTenantServices } from "@/lib/api/services";
import { getPaymentsProvider } from "@/lib/api/payments";

/**
 * Checklist de onboarding: guía al dueño nuevo por los pasos clave en vez de
 * tirarlo a un panel vacío. Las 5 señales ya existen como queries; acá solo
 * las juntamos. Se oculta sola cuando está todo completo (y el dueño puede
 * cerrarla antes — la decisión se recuerda en localStorage).
 */
export function OnboardingChecklist({ tenantId }: { tenantId: string }) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(`zero.onboarding.dismissed.${tenantId}`) === "1";
  });

  const tenantQ = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => getTenant(tenantId).then((r) => r.tenant),
  });
  const briefQ = useQuery({
    queryKey: ["brief", tenantId],
    queryFn: () => getTenantBrief(tenantId),
  });
  const servicesQ = useQuery({
    queryKey: ["services", tenantId],
    queryFn: () => listTenantServices(tenantId),
  });
  const paymentsQ = useQuery({
    queryKey: ["payments-provider", tenantId],
    queryFn: () => getPaymentsProvider(tenantId),
  });

  const loading =
    tenantQ.isLoading ||
    briefQ.isLoading ||
    servicesQ.isLoading ||
    paymentsQ.isLoading;

  const steps: ChecklistStep[] = [
    {
      key: "whatsapp",
      label: "Conectá WhatsApp",
      hint: "El canal por donde tu agente atiende.",
      href: "/integrations",
      done: Boolean(tenantQ.data?.channels?.whatsapp?.enabled),
    },
    {
      key: "brief",
      label: "Escribí el brief de tu negocio",
      hint: "Qué hacés, tu tono, tus reglas — la personalidad del bot.",
      href: "/brief",
      done: (briefQ.data?.content?.trim().length ?? 0) > 0,
    },
    {
      key: "services",
      label: "Cargá tus servicios",
      hint: "Para que el agente sepa qué ofrecés y cuánto dura.",
      href: "/services",
      done: (servicesQ.data?.length ?? 0) > 0,
    },
    {
      key: "payments",
      label: "Conectá cobros (Stripe)",
      hint: "Para que el bot mande links de pago. Opcional.",
      href: "/integrations",
      done: paymentsQ.data?.provider?.status === "active",
      optional: true,
    },
  ];

  const requiredSteps = steps.filter((s) => !s.optional);
  const doneRequired = requiredSteps.filter((s) => s.done).length;
  const allRequiredDone = doneRequired === requiredSteps.length;

  // Mientras carga, no parpadear. Si ya está todo (o lo cerró), no mostrar.
  if (loading || dismissed || allRequiredDone) return null;

  const doneTotal = steps.filter((s) => s.done).length;

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`zero.onboarding.dismissed.${tenantId}`, "1");
    }
    setDismissed(true);
  };

  return (
    <div
      className="glass"
      style={{
        marginBottom: 18,
        borderRadius: 12,
        border: "1px solid oklch(0.62 0.22 295 / 0.35)",
        background: "linear-gradient(180deg, oklch(0.62 0.22 295 / 0.07), transparent 70%)",
        padding: "16px 18px",
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ocultar checklist"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 26,
          height: 26,
          borderRadius: 6,
          border: "none",
          background: "transparent",
          color: "var(--text-3)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={14} />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Sparkles size={15} style={{ color: "var(--z-cyan)" }} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>Configurá tu agente</span>
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--font-jetbrains-mono)",
            color: "var(--text-3)",
          }}
        >
          {doneTotal}/{steps.length}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Unos pocos pasos y tu agente empieza a vender y agendar solo.
      </p>

      {/* Barra de progreso (sobre los pasos requeridos) */}
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: "rgba(255,255,255,0.06)",
          marginBottom: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${(doneRequired / requiredSteps.length) * 100}%`,
            height: "100%",
            background: "var(--aurora)",
            transition: "width 300ms ease",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {steps.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "9px 10px",
              borderRadius: 8,
              textDecoration: "none",
              color: "inherit",
              transition: "background 120ms ease",
            }}
            className="onboarding-step"
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: s.done ? "oklch(0.78 0.15 155 / 0.18)" : "rgba(255,255,255,0.05)",
                border: s.done
                  ? "1px solid oklch(0.78 0.15 155 / 0.5)"
                  : "1px solid var(--hair-strong)",
                color: s.done ? "var(--z-green)" : "var(--text-3)",
              }}
            >
              {s.done && <Check size={12} strokeWidth={3} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: s.done ? "var(--text-3)" : "var(--text-0)",
                  textDecoration: s.done ? "line-through" : "none",
                }}
              >
                {s.label}
                {s.optional && !s.done && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-3)" }}>
                    opcional
                  </span>
                )}
              </span>
              {!s.done && (
                <span style={{ display: "block", fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                  {s.hint}
                </span>
              )}
            </span>
            {!s.done && <ChevronRight size={15} style={{ color: "var(--text-3)", flexShrink: 0 }} />}
          </Link>
        ))}
      </div>
    </div>
  );
}

interface ChecklistStep {
  key: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
  optional?: boolean;
}
