"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  MessageSquare,
  Pencil,
  Zap,
} from "lucide-react";
import { getTenant } from "@/lib/api/tenants";
import { getTenantSubscriptionStatus } from "@/lib/api/billing";
import { PageShell, cardStyle } from "./page-shell";
import { RequireTenant } from "./require-tenant";
import { BusinessInfoModal } from "./business-info-modal";
import type { TenantStatus } from "@/lib/api/contract";

export function OverviewView() {
  return (
    <RequireTenant>
      {(tenantId) => <OverviewContent tenantId={tenantId} />}
    </RequireTenant>
  );
}

function OverviewContent({ tenantId }: { tenantId: string }) {
  const [editing, setEditing] = useState(false);
  const tenantQuery = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => getTenant(tenantId),
  });
  const statusQuery = useQuery({
    queryKey: ["tenant-status", tenantId],
    queryFn: () => getTenantSubscriptionStatus(tenantId),
  });

  const tenant = tenantQuery.data?.tenant;
  const status = statusQuery.data;

  return (
    <PageShell
      title={tenant?.business?.name || "Resumen del tenant"}
      subtitle={
        tenant
          ? `${tenant.business?.type || "—"} · ${tenant.business?.location || "—"} · ${tenantId}`
          : tenantId
      }
      actions={
        tenant && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 6,
              border: "1px solid var(--hair-strong)",
              background: "rgba(255,255,255,0.03)",
              color: "var(--text-1)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Pencil size={12} /> Editar info del negocio
          </button>
        )
      }
    >
      {status && <BillingStatusBanner status={status} />}

      {tenant?.business?.description && (
        <div
          className="glass"
          style={{
            ...cardStyle,
            marginBottom: 12,
            fontSize: 12.5,
            color: "var(--text-1)",
            lineHeight: 1.55,
          }}
        >
          {tenant.business.description}
        </div>
      )}

      {editing && tenant && (
        <BusinessInfoModal
          tenantId={tenantId}
          initial={tenant.business}
          onClose={() => setEditing(false)}
        />
      )}

      <div className="grid-kpis" style={{ marginTop: 12 }}>
        <KpiCard
          label="Estado"
          value={status ? humanStatus(status.status) : "—"}
          hint={status?.can_serve ? "Sirviendo" : status?.reason || "Sin servicio"}
          tone={status?.can_serve ? "green" : "red"}
        />
        <KpiCard
          label="Uso de tokens"
          value={status ? `${Math.round(status.usage_percent)}%` : "—"}
          hint={
            status
              ? `${status.tokens_used_this_period.toLocaleString()} / ${status.monthly_token_limit.toLocaleString()}`
              : "Consumo del período"
          }
          tone={
            status && status.usage_percent > 90
              ? "red"
              : status && status.usage_percent > 80
              ? "amber"
              : "default"
          }
        />
        <KpiCard
          label="Plan"
          value={tenant?.billing?.plan?.toString() ?? "—"}
          hint={status?.stripe_subscription_status ?? "Suscripción"}
        />
        <KpiCard
          label="Trial restante"
          value={
            status?.trial_days_remaining !== undefined
              ? `${status.trial_days_remaining}d`
              : "—"
          }
          hint={status?.trial_ends_at ? new Date(status.trial_ends_at).toLocaleDateString() : "Sin trial"}
        />
      </div>

      <div
        className="grid-chart-2"
        style={{ marginTop: 16 }}
      >
        <div className="glass" style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionTitle>Canales</SectionTitle>
          <ChannelRow
            name="WhatsApp"
            connected={Boolean(tenant?.channels.whatsapp.enabled)}
            detail={tenant?.channels.whatsapp.number || "sin número"}
            href="/integrations"
          />
          <ChannelRow
            name="Telegram"
            connected={Boolean(tenant?.channels.telegram.configured)}
            detail={tenant?.channels.telegram.admin_chat_id || "sin chat admin"}
            href="/integrations"
          />
          <ChannelRow
            name="Websocket"
            connected={Boolean(tenant?.channels.websocket.enabled)}
            detail={tenant?.channels.websocket.enabled ? "habilitado" : "deshabilitado"}
            href="/integrations"
          />
        </div>

        <div className="glass" style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionTitle>Accesos rápidos</SectionTitle>
          <QuickAction
            href="/sandbox"
            icon={<MessageSquare size={16} />}
            title="Probar el bot"
            subtitle="Sandbox chat con trace_id y typing_ms"
          />
          <QuickAction
            href="/persona"
            icon={<Zap size={16} />}
            title="Editar persona"
            subtitle="Tono, idioma, horarios por canal"
          />
          <QuickAction
            href="/bookings"
            icon={<CalendarCheck size={16} />}
            title="Ver reservas"
            subtitle="Kanban de automations"
          />
        </div>
      </div>
    </PageShell>
  );
}

function humanStatus(s: TenantStatus): string {
  const map: Record<TenantStatus, string> = {
    trial: "Trial",
    trial_expired: "Trial expirado",
    active: "Activo",
    past_due: "Pago atrasado",
    canceled: "Cancelado",
    granted: "Concedido",
    suspended: "Suspendido",
  };
  return map[s] ?? s;
}

function BillingStatusBanner({
  status,
}: {
  status: { can_serve: boolean; reason: string; usage_percent: number; status: TenantStatus };
}) {
  if (!status.can_serve) {
    return (
      <div
        role="alert"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid oklch(0.68 0.21 25 / 0.4)",
          background: "oklch(0.68 0.21 25 / 0.12)",
          marginBottom: 12,
        }}
      >
        <AlertTriangle size={16} style={{ color: "var(--z-red)", flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: "var(--text-1)" }}>
          <strong style={{ color: "var(--z-red)" }}>Servicio pausado.</strong> {status.reason}
        </div>
      </div>
    );
  }
  if (status.usage_percent > 80) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid oklch(0.80 0.14 75 / 0.4)",
          background: "oklch(0.80 0.14 75 / 0.10)",
          marginBottom: 12,
        }}
      >
        <AlertTriangle size={16} style={{ color: "var(--z-amber)", flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: "var(--text-1)" }}>
          Estás al <strong style={{ color: "var(--z-amber)" }}>{Math.round(status.usage_percent)}%</strong> de tu límite mensual.
        </div>
      </div>
    );
  }
  return null;
}

function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "green" | "red" | "amber";
}) {
  const toneColor =
    tone === "green"
      ? "var(--z-green)"
      : tone === "red"
      ? "var(--z-red)"
      : tone === "amber"
      ? "var(--z-amber)"
      : "var(--text-0)";
  return (
    <div className="glass" style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 4 }}>
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
      <div style={{ fontSize: 20, fontWeight: 600, color: toneColor }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{hint}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function ChannelRow({
  name,
  connected,
  detail,
  href,
}: {
  name: string;
  connected: boolean;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid var(--hair)",
        background: "rgba(255,255,255,0.015)",
        textDecoration: "none",
        color: "var(--text-0)",
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: connected ? "var(--z-green)" : "var(--text-3)",
          boxShadow: connected ? "0 0 6px var(--z-green)" : "none",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--font-jetbrains-mono)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {detail}
        </div>
      </div>
      {connected ? (
        <CheckCircle2 size={14} style={{ color: "var(--z-green)" }} />
      ) : (
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>Conectar</span>
      )}
    </Link>
  );
}

function QuickAction({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid var(--hair)",
        background: "rgba(255,255,255,0.015)",
        textDecoration: "none",
        color: "var(--text-0)",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: "rgba(255,255,255,0.05)",
          color: "var(--text-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{subtitle}</div>
      </div>
    </Link>
  );
}
