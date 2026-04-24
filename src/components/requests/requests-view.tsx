"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarOff,
  Check,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Undo2,
  X,
} from "lucide-react";
import { listPublicRequests, patchPublicRequest } from "@/lib/api/requests";
import { useRealtime } from "@/lib/socket/use-realtime";
import { useAuthStore } from "@/store/auth";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import type {
  PublicRequest,
  PublicRequestReason,
  PublicRequestStatus,
} from "@/lib/api/contract";

// ── Meta por motivo ─────────────────────────────────────────────────────────
type ReasonMeta = {
  label: string;
  hint: string;
  tone: "danger" | "warn" | "info";
  cta?: { label: string; href: string };
  icon: typeof AlertTriangle;
};

const REASON_META: Record<PublicRequestReason, ReasonMeta> = {
  calendar_not_connected: {
    label: "Calendario no conectado",
    hint: "El bot no pudo reservar porque Google Calendar no está conectado.",
    tone: "danger",
    cta: { label: "Conectar Calendar", href: "/integrations" },
    icon: CalendarOff,
  },
  calendar_reauth_required: {
    label: "Reautorizar Calendar",
    hint: "El permiso con Google caducó. Hay que volver a conectar el calendario.",
    tone: "danger",
    cta: { label: "Reconectar Calendar", href: "/integrations" },
    icon: CalendarOff,
  },
  executor_error: {
    label: "Error del bot",
    hint: "El bot intentó resolverlo varias veces y no pudo. Revisalo manualmente.",
    tone: "warn",
    icon: AlertTriangle,
  },
  manual_intervention: {
    label: "Derivó al humano",
    hint: "El cliente pidió hablar con alguien.",
    tone: "info",
    icon: MessageCircle,
  },
  other: {
    label: "Otro motivo",
    hint: "El bot no pudo resolverlo por un motivo genérico.",
    tone: "info",
    icon: ShieldAlert,
  },
};

function resolveReason(reason: PublicRequestReason | null): ReasonMeta {
  return REASON_META[reason ?? "other"];
}

const TONE_STYLES: Record<
  ReasonMeta["tone"],
  { border: string; background: string; color: string }
> = {
  danger: {
    border: "oklch(0.68 0.21 25 / 0.38)",
    background: "oklch(0.68 0.21 25 / 0.10)",
    color: "var(--z-red)",
  },
  warn: {
    border: "oklch(0.80 0.14 75 / 0.38)",
    background: "oklch(0.80 0.14 75 / 0.10)",
    color: "var(--z-amber)",
  },
  info: {
    border: "oklch(0.80 0.13 200 / 0.32)",
    background: "oklch(0.80 0.13 200 / 0.08)",
    color: "var(--z-cyan)",
  },
};

// ── Vista principal ─────────────────────────────────────────────────────────

type FilterKey = "pending" | "all" | "done";

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "pending", label: "Pendientes" },
  { id: "all", label: "Todas" },
  { id: "done", label: "Resueltas" },
];

export function RequestsView() {
  return <RequireTenant>{(tenantId) => <Notepad tenantId={tenantId} />}</RequireTenant>;
}

function Notepad({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const activeTenantId = useAuthStore((s) => s.activeTenantId);
  useRealtime(activeTenantId); // socket "request:new" invalida la query

  const [filter, setFilter] = useState<FilterKey>("pending");

  const query = useQuery({
    queryKey: ["requests", tenantId, filter],
    queryFn: () =>
      listPublicRequests(tenantId, {
        // "pending" = open + in_progress (mostramos todo lo no cerrado).
        // "all" y "done" los maneja el filtro client-side.
        status: undefined,
        limit: 200,
      }),
    refetchInterval: 60_000,
  });

  const pendingCountQuery = useQuery({
    queryKey: ["requests-pending-count", tenantId],
    queryFn: () => listPublicRequests(tenantId, { status: "open", limit: 200 }),
    refetchInterval: 30_000,
  });

  const patch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PublicRequestStatus }) =>
      patchPublicRequest(tenantId, id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests", tenantId] });
      qc.invalidateQueries({ queryKey: ["requests-pending-count", tenantId] });
    },
  });

  const allItems = query.data?.requests ?? [];
  const items = useMemo(() => {
    if (filter === "pending")
      return allItems.filter(
        (r) => r.status === "open" || r.status === "in_progress"
      );
    if (filter === "done") return allItems.filter((r) => r.status === "done");
    return allItems;
  }, [allItems, filter]);

  const pendingCount = (pendingCountQuery.data?.requests ?? []).length;

  return (
    <PageShell
      title="Solicitudes"
      subtitle="Lo que el bot no pudo resolver. Revisá, resolvé y archivá."
      actions={
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
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
            cursor: "pointer",
          }}
        >
          {query.isFetching ? (
            <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
          ) : (
            <RefreshCw size={12} />
          )}
          Refrescar
        </button>
      }
    >
      {/* Counter + tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div
          className="filter-tabs"
          style={{ flex: "0 0 auto" }}
          role="tablist"
          aria-label="Filtro de solicitudes"
        >
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 5,
                  border: "none",
                  background: on ? "rgba(255,255,255,0.07)" : "transparent",
                  color: on ? "var(--text-0)" : "var(--text-2)",
                  fontSize: 12,
                  fontWeight: on ? 500 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {f.label}
                {f.id === "pending" && pendingCount > 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 10,
                      fontFamily: "var(--font-jetbrains-mono)",
                      padding: "1px 6px",
                      borderRadius: 10,
                      background: "var(--aurora)",
                      color: "#0a0a0f",
                      fontWeight: 700,
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      {query.isLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          <Loader2 size={14} style={{ animation: "spin 900ms linear infinite", verticalAlign: "middle" }} />{" "}
          Cargando…
        </div>
      ) : items.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((r) => (
            <RequestNote
              key={r.id}
              request={r}
              onResolve={() => patch.mutate({ id: r.id, status: "done" })}
              onReopen={() => patch.mutate({ id: r.id, status: "open" })}
              onDismiss={() => patch.mutate({ id: r.id, status: "dismissed" })}
              busy={patch.isPending}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}

// ── Tarjeta de nota ─────────────────────────────────────────────────────────

function RequestNote({
  request: r,
  onResolve,
  onReopen,
  onDismiss,
  busy,
}: {
  request: PublicRequest;
  onResolve: () => void;
  onReopen: () => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  const reasonMeta = resolveReason(r.reason);
  const tone = TONE_STYLES[reasonMeta.tone];
  const Icon = reasonMeta.icon;
  const [showDetail, setShowDetail] = useState(false);

  const isResolved = r.status === "done" || r.status === "dismissed";

  return (
    <article
      className="glass"
      style={{
        ...cardStyle,
        padding: 14,
        borderLeft: `3px solid ${tone.color}`,
        opacity: isResolved ? 0.6 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header: badge motivo + timestamp + status */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 9px",
            borderRadius: 999,
            fontSize: 10.5,
            fontWeight: 700,
            fontFamily: "var(--font-jetbrains-mono)",
            background: tone.background,
            color: tone.color,
            border: `1px solid ${tone.border}`,
          }}
        >
          <Icon size={10} />
          {reasonMeta.label}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--font-jetbrains-mono)",
          }}
          title={new Date(r.created_at).toLocaleString()}
          suppressHydrationWarning
        >
          {relativeTime(r.created_at)}
        </span>
        {r.status === "in_progress" && (
          <StatusChip label="en curso" tone="warn" />
        )}
        {r.status === "done" && <StatusChip label="resuelta" tone="ok" />}
        {r.status === "dismissed" && <StatusChip label="descartada" tone="muted" />}
      </header>

      {/* Hint del motivo + CTA contextual */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.4 }}>
          {reasonMeta.hint}
        </span>
        {reasonMeta.cta && !isResolved && (
          <Link
            href={reasonMeta.cta.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 5,
              background: "var(--aurora)",
              color: "#0a0a0f",
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            {reasonMeta.cta.label}
          </Link>
        )}
      </div>

      {/* Cliente + mensaje */}
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(0,0,0,0.2)",
          border: "1px solid var(--hair)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 5,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-0)" }}>
            {r.sender_name || r.sender_id}
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-jetbrains-mono)",
              color: "var(--text-3)",
              padding: "1px 6px",
              borderRadius: 3,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            {r.source}
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-1)",
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          {r.text || "(sin mensaje)"}
        </div>
      </div>

      {/* Detalle técnico colapsable */}
      {r.detail && (
        <div>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              fontSize: 11,
              color: "var(--text-3)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {showDetail ? "Ocultar detalle técnico" : "Ver detalle técnico"}
          </button>
          {showDetail && (
            <pre
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--hair)",
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 11,
                color: "var(--text-2)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: "6px 0 0 0",
              }}
            >
              {r.detail}
            </pre>
          )}
        </div>
      )}

      {/* Acciones */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {r.conversation_id && (
            <Link
              href={`/inbox?conversation=${encodeURIComponent(r.conversation_id)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 5,
                border: "1px solid var(--hair-strong)",
                background: "rgba(255,255,255,0.03)",
                color: "var(--text-1)",
                fontSize: 11,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              <MessageCircle size={12} />
              Ir a la conversación
            </Link>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {!isResolved ? (
            <>
              <ActionButton
                label="Descartar"
                onClick={onDismiss}
                busy={busy}
                icon={X}
              />
              <ActionButton
                label="Marcar resuelta"
                primary
                onClick={onResolve}
                busy={busy}
                icon={Check}
              />
            </>
          ) : (
            <ActionButton label="Reabrir" onClick={onReopen} busy={busy} icon={Undo2} />
          )}
        </div>
      </footer>
    </article>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "muted";
}) {
  const map: Record<typeof tone, { background: string; color: string; border: string }> = {
    ok: {
      background: "oklch(0.70 0.18 160 / 0.12)",
      color: "var(--z-green)",
      border: "oklch(0.70 0.18 160 / 0.3)",
    },
    warn: {
      background: "oklch(0.80 0.14 75 / 0.14)",
      color: "var(--z-amber)",
      border: "oklch(0.80 0.14 75 / 0.3)",
    },
    muted: {
      background: "rgba(255,255,255,0.04)",
      color: "var(--text-3)",
      border: "var(--hair)",
    },
  };
  const t = map[tone];
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 3,
        fontFamily: "var(--font-jetbrains-mono)",
        background: t.background,
        color: t.color,
        border: `1px solid ${t.border}`,
      }}
    >
      {label}
    </span>
  );
}

function ActionButton({
  label,
  icon: Icon,
  primary,
  busy,
  onClick,
}: {
  label: string;
  icon: typeof Check;
  primary?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 12px",
        borderRadius: 5,
        border: primary ? "none" : "1px solid var(--hair-strong)",
        background: primary ? "var(--aurora)" : "rgba(255,255,255,0.03)",
        color: primary ? "#0a0a0f" : "var(--text-1)",
        fontSize: 11,
        fontWeight: primary ? 700 : 500,
        cursor: busy ? "not-allowed" : "pointer",
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

function EmptyState({ filter }: { filter: FilterKey }) {
  if (filter === "pending") {
    return (
      <div
        style={{
          padding: "40px 24px",
          borderRadius: 10,
          border: "1px dashed var(--hair)",
          background: "oklch(0.70 0.18 160 / 0.04)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          textAlign: "center",
        }}
      >
        <CheckCircle2 size={22} style={{ color: "var(--z-green)" }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>
          Todo al día
        </div>
        <div style={{ fontSize: 12, color: "var(--text-2)", maxWidth: 420, lineHeight: 1.5 }}>
          El bot está resolviendo todas las solicitudes. Si algo falla, te avisamos
          acá al instante.
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        padding: "40px 24px",
        borderRadius: 10,
        border: "1px dashed var(--hair-strong)",
        background: "rgba(255,255,255,0.015)",
        textAlign: "center",
        color: "var(--text-3)",
        fontSize: 13,
      }}
    >
      Sin solicitudes en esta vista.
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.round(diffMs / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString();
}
