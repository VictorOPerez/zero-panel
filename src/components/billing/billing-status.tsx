"use client";

import type { TenantStatus, TenantStatusReport } from "@/lib/api/contract";

// ── Meta por estado ─────────────────────────────────────────────────────────
type StatusMeta = {
  icon: string;
  label: string;
  tone: "ok" | "warn" | "info" | "danger" | "muted";
  copy: (d: TenantStatusReport) => string;
  cta?: { label: string; kind: "checkout" | "portal" };
};

const TONE_STYLES: Record<
  StatusMeta["tone"],
  { background: string; color: string; border: string }
> = {
  ok: {
    background: "oklch(0.70 0.18 160 / 0.14)",
    color: "var(--z-green)",
    border: "1px solid oklch(0.70 0.18 160 / 0.32)",
  },
  warn: {
    background: "oklch(0.80 0.14 75 / 0.14)",
    color: "var(--z-amber)",
    border: "1px solid oklch(0.80 0.14 75 / 0.35)",
  },
  info: {
    background: "oklch(0.80 0.13 200 / 0.14)",
    color: "var(--z-cyan)",
    border: "1px solid oklch(0.80 0.13 200 / 0.32)",
  },
  danger: {
    background: "oklch(0.68 0.21 25 / 0.14)",
    color: "var(--z-red)",
    border: "1px solid oklch(0.68 0.21 25 / 0.38)",
  },
  muted: {
    background: "rgba(255,255,255,0.04)",
    color: "var(--text-3)",
    border: "1px solid var(--hair)",
  },
};

export const STATUS_META: Record<TenantStatus, StatusMeta> = {
  active: {
    icon: "✓",
    label: "Activo",
    tone: "ok",
    copy: () => "Plan activo — tu bot responde 24/7.",
  },
  trial: {
    icon: "⏱",
    label: "Prueba",
    tone: "warn",
    copy: (d) =>
      `Estás en prueba gratis · quedan ${d.trial_days_remaining ?? 0} días.`,
    cta: { label: "Suscribirme", kind: "checkout" },
  },
  granted: {
    icon: "★",
    label: "Cortesía",
    tone: "info",
    copy: (d) =>
      `Acceso activado por el administrador${d.override?.reason ? ` · ${d.override.reason}` : ""}.`,
  },
  trial_expired: {
    icon: "✕",
    label: "Prueba vencida",
    tone: "danger",
    copy: (d) =>
      `Tu prueba terminó${d.trial_ends_at ? ` el ${fmtDate(d.trial_ends_at)}` : ""}. Activá tu plan para seguir usando el bot.`,
    cta: { label: "Activar plan", kind: "checkout" },
  },
  past_due: {
    icon: "⚠",
    label: "Pago pendiente",
    tone: "warn",
    copy: (d) =>
      d.hard_cap_exceeded
        ? "Tu bot está pausado hasta el próximo ciclo."
        : "Tu último pago falló. Actualizá tu método de pago.",
    cta: { label: "Actualizar método", kind: "portal" },
  },
  canceled: {
    icon: "✕",
    label: "Cancelada",
    tone: "muted",
    copy: () => "Tu suscripción está cancelada.",
    cta: { label: "Reactivar", kind: "checkout" },
  },
  suspended: {
    icon: "⛔",
    label: "Suspendido",
    tone: "danger",
    copy: (d) =>
      d.hard_cap_exceeded
        ? "Bot pausado por superar el límite de seguridad."
        : d.override
          ? `Suspendido por el administrador: ${d.override.reason}`
          : d.reason,
  },
};

function fmtDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Badge pill ──────────────────────────────────────────────────────────────
export function BillingBadgePill({ status }: { status: TenantStatus }) {
  const meta = STATUS_META[status];
  const tone = TONE_STYLES[meta.tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 600,
        fontFamily: "var(--font-jetbrains-mono)",
        whiteSpace: "nowrap",
        background: tone.background,
        color: tone.color,
        border: tone.border,
      }}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────
export function BillingStatusSkeleton() {
  return (
    <div
      style={{
        height: 56,
        borderRadius: 10,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--hair)",
        animation: "pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

// ── Banner ──────────────────────────────────────────────────────────────────
export interface BillingStatusBannerProps {
  data: TenantStatusReport;
  onCheckout?: () => void;
  onPortal?: () => void;
  busy?: "checkout" | "portal" | null;
  compact?: boolean;
  onDismiss?: () => void;
}

export function BillingStatusBanner({
  data,
  onCheckout,
  onPortal,
  busy = null,
  compact = false,
  onDismiss,
}: BillingStatusBannerProps) {
  const meta = STATUS_META[data.status];
  const tone = TONE_STYLES[meta.tone];
  const copyText = meta.copy(data);

  return (
    <div
      role={data.can_serve ? undefined : "alert"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: compact ? "8px 14px" : "10px 16px",
        background: tone.background,
        borderTop: compact ? undefined : tone.border,
        borderBottom: compact ? undefined : tone.border,
        borderRadius: compact ? 8 : 0,
        border: compact ? tone.border : undefined,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          flex: "1 1 auto",
          minWidth: 0,
        }}
      >
        <BillingBadgePill status={data.status} />
        <span
          style={{
            fontSize: 12.5,
            color: "var(--text-1)",
            lineHeight: 1.4,
          }}
        >
          {copyText}
        </span>
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        {meta.cta?.kind === "checkout" && onCheckout && (
          <button
            type="button"
            onClick={onCheckout}
            disabled={busy === "checkout"}
            style={primaryBtn}
          >
            {busy === "checkout" ? "Redirigiendo…" : meta.cta.label}
          </button>
        )}
        {meta.cta?.kind === "portal" && onPortal && (
          <button
            type="button"
            onClick={onPortal}
            disabled={busy === "portal"}
            style={primaryBtn}
          >
            {busy === "portal" ? "Abriendo…" : meta.cta.label}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Ocultar"
            style={dismissBtn}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "6px 14px",
  borderRadius: 6,
  border: "none",
  background: "var(--aurora)",
  color: "#0a0a0f",
  fontSize: 11.5,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const dismissBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  borderRadius: 4,
  border: "none",
  background: "transparent",
  color: "var(--text-3)",
  fontSize: 16,
  lineHeight: 1,
  cursor: "pointer",
};
