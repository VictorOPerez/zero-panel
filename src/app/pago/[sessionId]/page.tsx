import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Check, Clock, AlertCircle } from "lucide-react";

// Página PÚBLICA post-checkout. Cliente del tenant llega acá tras pagar
// (Stripe redirige con `?session_id`). NO está dentro de (dashboard)/ así
// que no tiene AuthGate — el cliente NO necesita login del panel.
//
// Solo consume `/api/public/payment-status/:sessionId` que devuelve los
// campos seguros: tenantName + amount + concept + status. Sin
// client_phone / metadata / checkout_url.

export const dynamic = "force-dynamic";

interface PaymentStatus {
  ok: true;
  tenantName: string;
  amountCents: number;
  currency: string;
  concept: string;
  status: "pending" | "paid" | "expired" | "refunded" | "partially_refunded" | "failed";
  paidAt: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3000";

async function fetchPaymentStatus(
  sessionId: string
): Promise<PaymentStatus | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/public/payment-status/${encodeURIComponent(sessionId)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as PaymentStatus | { ok: false };
    if (!("ok" in json) || !json.ok) return null;
    return json;
  } catch {
    return null;
  }
}

function formatAmount(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2);
  return `${amount} ${currency.toUpperCase()}`;
}

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sessionId } = await params;
  const data = await fetchPaymentStatus(sessionId);
  if (!data) return { title: "Pago — Zero" };
  const verb =
    data.status === "paid"
      ? "Pago confirmado"
      : data.status === "pending"
        ? "Procesando pago"
        : "Pago";
  return { title: `${verb} — ${data.tenantName}` };
}

export default async function PaymentResultPage({ params }: PageProps) {
  const { sessionId } = await params;
  const data = await fetchPaymentStatus(sessionId);

  if (!data) notFound();

  const isPaid = data.status === "paid";
  const isPending = data.status === "pending";
  const isFailedState =
    data.status === "expired" ||
    data.status === "failed" ||
    data.status === "refunded" ||
    data.status === "partially_refunded";

  const accentColor = isPaid
    ? "oklch(0.70 0.18 160)"
    : isFailedState
      ? "oklch(0.65 0.20 25)"
      : "oklch(0.70 0.15 240)";

  const Icon = isPaid ? Check : isFailedState ? AlertCircle : Clock;

  const headline = isPaid
    ? "¡Pago confirmado!"
    : isPending
      ? "Procesando tu pago..."
      : data.status === "expired"
        ? "Este link de pago expiró"
        : data.status === "refunded"
          ? "Pago reembolsado"
          : data.status === "partially_refunded"
            ? "Pago reembolsado parcialmente"
            : "El pago no se pudo completar";

  const body = isPaid
    ? `Gracias por confiar en ${data.tenantName}. Te enviamos la confirmación por WhatsApp.`
    : isPending
      ? `Estamos esperando que el banco confirme tu pago. Vas a recibir el mensaje en WhatsApp en cuanto se acredite.`
      : data.status === "expired"
        ? `El link ya no está activo. Volvé al chat de ${data.tenantName} para pedir uno nuevo.`
        : `Volvé al chat de ${data.tenantName} para resolver el pago.`;

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
          maxWidth: 480,
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
            background: `${accentColor.replace(")", " / 0.16)")}`,
            border: `2px solid ${accentColor.replace(")", " / 0.4)")}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
            animation:
              "pop-in 420ms cubic-bezier(0.22, 1.4, 0.36, 1) 120ms both",
          }}
        >
          <Icon size={28} style={{ color: accentColor }} strokeWidth={2.5} />
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
            {headline}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              color: "var(--text-2)",
              lineHeight: 1.5,
            }}
          >
            {body}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            padding: "16px 18px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--hair)",
            borderRadius: 10,
            textAlign: "left",
          }}
        >
          <Row label="Negocio" value={data.tenantName} />
          <Row label="Concepto" value={data.concept} />
          <Row
            label="Monto"
            value={formatAmount(data.amountCents, data.currency)}
            mono
          />
          <Row
            label="Estado"
            value={
              isPaid
                ? "Pagado"
                : isPending
                  ? "Pendiente"
                  : data.status === "expired"
                    ? "Expirado"
                    : data.status === "failed"
                      ? "Fallido"
                      : data.status === "refunded"
                        ? "Reembolsado"
                        : "Reembolso parcial"
            }
          />
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 11.5,
            color: "var(--text-3)",
            opacity: 0.7,
          }}
        >
          Podés cerrar esta ventana y volver a WhatsApp.
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

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-3)" }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          color: "var(--text-0)",
          fontWeight: 500,
          fontFamily: mono ? "var(--font-jetbrains-mono)" : undefined,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}
