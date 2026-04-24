"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useAuthStore } from "@/store/auth";

/**
 * Landing post-Stripe checkout. Stripe redirige acá con el payment confirmado.
 * Invalidamos la query del tenant-status para que el webhook de Stripe (que
 * actualiza el billing en backend) se refleje en cuanto el usuario vuelva al
 * dashboard.
 */
export default function PaymentSuccessPage() {
  const tenantId = useAuthStore((s) => s.activeTenantId);
  const qc = useQueryClient();

  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["tenant-status", tenantId] });
    qc.invalidateQueries({ queryKey: ["billing", tenantId] });
  }, [qc, tenantId]);

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        minHeight: 0,
      }}
    >
      <div
        className="glass"
        style={{
          maxWidth: 440,
          width: "100%",
          padding: "40px 32px",
          borderRadius: 14,
          display: "grid",
          gap: 18,
          textAlign: "center",
          animation: "fade-up 360ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "oklch(0.70 0.18 160 / 0.16)",
            border: "2px solid oklch(0.70 0.18 160 / 0.4)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
            animation: "pop-in 420ms cubic-bezier(0.22, 1.4, 0.36, 1) 120ms both",
          }}
        >
          <Check size={28} style={{ color: "var(--z-green)" }} strokeWidth={2.5} />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: -0.3,
              color: "var(--text-0)",
            }}
          >
            ¡Pago exitoso!
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              color: "var(--text-2)",
              lineHeight: 1.5,
            }}
          >
            Tu suscripción ya está activa. El bot puede seguir respondiendo a
            tus clientes sin interrupciones.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/overview"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 18px",
              borderRadius: 7,
              background: "var(--aurora)",
              color: "#0a0a0f",
              fontSize: 12.5,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Volver al panel →
          </Link>
          <Link
            href="/billing"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 18px",
              borderRadius: 7,
              border: "1px solid var(--hair-strong)",
              background: "rgba(255,255,255,0.03)",
              color: "var(--text-1)",
              fontSize: 12.5,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Ver facturación
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pop-in {
          from { opacity: 0; transform: scale(0.2); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </main>
  );
}
