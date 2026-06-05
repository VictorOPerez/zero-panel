"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Megaphone,
  Wand2,
  Wallet,
  Phone,
  CalendarClock,
  ArrowRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import { WhatsappBusinessCard } from "@/components/channels/whatsapp-business-card";
import { getPaymentsProvider, connectStripe } from "@/lib/api/payments";
import { listTenantNumbers } from "@/lib/api/numbers";
import { getNylasStatus } from "@/lib/api/nylas-calendar";
import { ApiError } from "@/lib/api/client";

export function IntegrationsView() {
  return (
    <RequireTenant>{(tenantId) => <Home tenantId={tenantId} />}</RequireTenant>
  );
}

function Home({ tenantId }: { tenantId: string }) {
  return (
    <PageShell
      title="Conexiones"
      subtitle="Conectá las piezas que tu agente usa para trabajar."
    >
      <TwoFacesBanner />

      <SectionLabel>Tu agente (WhatsApp)</SectionLabel>
      <p style={captionStyle}>
        El agente es parte de tu{" "}
        <Link href="/billing" style={inlineLinkStyle}>
          suscripción de Zero
        </Link>
        . Conectá WhatsApp para que empiece a atender.
      </p>
      <div className="grid-integrations" style={{ marginBottom: 12 }} role="list">
        <WhatsappBusinessCard tenantId={tenantId} />
      </div>

      <SectionLabel>Lo que podés conectar</SectionLabel>
      <div className="grid-integrations">
        <StripeConnectCard tenantId={tenantId} />
        <NumbersCard tenantId={tenantId} />
        <CalendarCard tenantId={tenantId} />
      </div>
    </PageShell>
  );
}

// ─────────────────────── Las dos caras del agente ───────────────────────────

function TwoFacesBanner() {
  return (
    <div
      className="glass"
      style={{
        ...cardStyle,
        marginBottom: 18,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkles size={15} style={{ color: "var(--z-cyan)" }} />
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-0)" }}>
          Tu agente tiene dos caras
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        <FaceCol
          icon={Megaphone}
          color="oklch(0.78 0.15 155)"
          title="Cara al público"
          desc="Atiende a tus clientes 24/7 por WhatsApp: responde, agenda turnos, vende y cobra — solo, sin que muevas un dedo."
        />
        <FaceCol
          icon={Wand2}
          color="oklch(0.70 0.16 295)"
          title="Cara a vos (el dueño)"
          desc="Manejás el negocio por WhatsApp en lenguaje natural: «enviale un cobro a Juan de $20», «resumen de hoy», «bloqueá mañana»."
        />
      </div>
    </div>
  );
}

function FaceCol({
  icon: Icon,
  color,
  title,
  desc,
}: {
  icon: typeof Megaphone;
  color: string;
  title: string;
  desc: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--hair)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          flexShrink: 0,
        }}
      >
        <Icon size={16} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3, lineHeight: 1.5 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Cobros (Stripe) ──────────────────────────────

function StripeConnectCard({ tenantId }: { tenantId: string }) {
  const statusQuery = useQuery({
    queryKey: ["payments-provider", tenantId],
    queryFn: () => getPaymentsProvider(tenantId),
  });
  const connect = useMutation({
    mutationFn: () => connectStripe(tenantId, {}),
    onSuccess: (res) => {
      if (res.onboarding?.url) window.location.assign(res.onboarding.url);
    },
  });

  const provider = statusQuery.data?.provider ?? null;
  const active = provider?.status === "active" && provider.charges_enabled;
  const pending = Boolean(provider) && !active;

  return (
    <ConnectionCard
      icon={Wallet}
      accent="0.70 0.18 295"
      title="Cobros"
      badge={
        active
          ? { label: "Conectado", tone: "ok" }
          : pending
          ? { label: "En revisión", tone: "warn" }
          : undefined
      }
      description={
        <>
          Cobrá a tus clientes sin vueltas: le decís al bot{" "}
          <span style={quoteStyle}>«enviale un cobro a Juan de $20»</span> y el
          agente le manda el link de pago. Conectá tu cuenta de Stripe para
          recibir la plata.
        </>
      }
      footer={
        active ? (
          <Link href="/payments" style={secondaryLinkBtn}>
            Ver cobros <ArrowRight size={12} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => connect.mutate()}
            disabled={connect.isPending}
            style={primaryCardBtn}
          >
            {connect.isPending ? (
              <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <ExternalLink size={12} />
            )}
            {pending ? "Continuar configuración" : "Conectar Stripe"}
          </button>
        )
      }
      error={
        connect.isError
          ? connect.error instanceof ApiError
            ? connect.error.payload.error
            : "No pudimos iniciar la conexión con Stripe."
          : null
      }
    />
  );
}

// ─────────────────────────── Números virtuales ──────────────────────────────

function NumbersCard({ tenantId }: { tenantId: string }) {
  const query = useQuery({
    queryKey: ["tenant-numbers", tenantId],
    queryFn: () => listTenantNumbers(tenantId),
  });
  const count = query.data?.length ?? 0;

  return (
    <ConnectionCard
      icon={Phone}
      accent="0.80 0.13 200"
      title="Números virtuales"
      badge={count > 0 ? { label: `${count} activo${count > 1 ? "s" : ""}`, tone: "ok" } : undefined}
      description={
        <>
          ¿No tenés un número para WhatsApp Business? Comprá uno virtual en
          segundos y conectalo a tu agente — te guiamos paso a paso.
        </>
      }
      footer={
        <Link href="/numbers" style={primaryCardBtn}>
          {count > 0 ? "Ver mis números" : "Comprar número"} <ArrowRight size={12} />
        </Link>
      }
    />
  );
}

// ────────────────────────────── Calendario ──────────────────────────────────

function CalendarCard({ tenantId }: { tenantId: string }) {
  const query = useQuery({
    queryKey: ["nylas-status", tenantId],
    queryFn: () => getNylasStatus(tenantId),
  });
  const connected = Boolean(query.data?.status?.connected);

  return (
    <ConnectionCard
      icon={CalendarClock}
      accent="0.78 0.15 155"
      title="Calendario"
      badge={connected ? { label: "Conectado", tone: "ok" } : undefined}
      description={
        <>
          Conectá Google, Outlook o iCloud para que el agente vea tu
          disponibilidad real y agende turnos sin doble-bookear.
        </>
      }
      footer={
        <Link href="/calendar" style={connected ? secondaryLinkBtn : primaryCardBtn}>
          {connected ? "Administrar" : "Conectar calendario"} <ArrowRight size={12} />
        </Link>
      }
    />
  );
}

// ─────────────────────────── Tarjeta genérica ───────────────────────────────

function ConnectionCard({
  icon: Icon,
  accent,
  title,
  badge,
  description,
  footer,
  error,
}: {
  icon: typeof Wallet;
  // Triplete oklch (ej. "0.70 0.18 295") — el acento de color de la tarjeta.
  accent: string;
  title: string;
  badge?: { label: string; tone: "ok" | "warn" };
  description: React.ReactNode;
  footer: React.ReactNode;
  error?: string | null;
}) {
  const accentSolid = `oklch(${accent})`;
  return (
    <div
      className="glass"
      style={{
        ...cardStyle,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 168,
        // Color distintivo por tarjeta: borde superior, tinte de fondo y glow.
        borderTop: `2px solid oklch(${accent} / 0.55)`,
        background: `linear-gradient(180deg, oklch(${accent} / 0.06), transparent 60%)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: `oklch(${accent} / 0.14)`,
            border: `1px solid oklch(${accent} / 0.35)`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: accentSolid,
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)", flex: 1 }}>
          {title}
        </div>
        {badge && (
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: 4,
              color: badge.tone === "ok" ? "var(--z-green)" : "oklch(0.85 0.18 90)",
              background:
                badge.tone === "ok"
                  ? "oklch(0.78 0.15 155 / 0.12)"
                  : "oklch(0.85 0.18 90 / 0.12)",
              border: `1px solid ${
                badge.tone === "ok"
                  ? "oklch(0.78 0.15 155 / 0.4)"
                  : "oklch(0.85 0.18 90 / 0.4)"
              }`,
            }}
          >
            {badge.tone === "ok" && <CheckCircle2 size={10} style={{ marginRight: 3, display: "inline", verticalAlign: "middle" }} />}
            {badge.label}
          </span>
        )}
      </div>

      <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55, flex: 1 }}>
        {description}
      </div>

      {error && (
        <div style={{ fontSize: 11.5, color: "var(--z-red)" }}>{error}</div>
      )}

      <div>{footer}</div>
    </div>
  );
}

// ───────────────────────────────── styles ───────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        fontWeight: 600,
        marginBottom: 6,
        marginTop: 18,
      }}
    >
      {children}
    </div>
  );
}

const captionStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-3)",
  margin: "0 0 10px",
  lineHeight: 1.5,
};

const inlineLinkStyle: React.CSSProperties = {
  color: "var(--z-cyan)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const quoteStyle: React.CSSProperties = {
  color: "var(--text-1)",
  fontStyle: "italic",
};

const primaryCardBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 6,
  border: "none",
  background: "var(--aurora)",
  color: "#0a0a0f",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
  width: "fit-content",
};

const secondaryLinkBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 6,
  border: "1px solid var(--hair-strong)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-1)",
  fontSize: 12.5,
  fontWeight: 500,
  cursor: "pointer",
  textDecoration: "none",
  width: "fit-content",
};
