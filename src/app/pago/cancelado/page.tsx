import type { Metadata } from "next";
import { X } from "lucide-react";

// Página PÚBLICA de cancelación de checkout. Stripe redirige acá si el
// cliente cancela el pago en el formulario de Stripe. Sin AuthGate por la
// misma razón que /pago/[sessionId].

export const metadata: Metadata = { title: "Pago cancelado — Zero" };

export default function PaymentCancelledPage() {
  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        minHeight: "100vh",
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
          gap: 22,
          textAlign: "center",
          animation: "fade-up 360ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "oklch(0.65 0.20 25 / 0.16)",
            border: "2px solid oklch(0.65 0.20 25 / 0.4)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
            animation:
              "pop-in 420ms cubic-bezier(0.22, 1.4, 0.36, 1) 120ms both",
          }}
        >
          <X size={28} style={{ color: "oklch(0.65 0.20 25)" }} strokeWidth={2.5} />
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
            Pago cancelado
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              color: "var(--text-2)",
              lineHeight: 1.5,
            }}
          >
            No se realizó ningún cargo. Si querés volver a intentar, escribinos
            por WhatsApp y te enviamos un nuevo link.
          </p>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 11.5,
            color: "var(--text-3)",
            opacity: 0.7,
          }}
        >
          Podés cerrar esta ventana.
        </p>
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
