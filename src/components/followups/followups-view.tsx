"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import {
  cancelFollowupApi,
  listFollowups,
  type Followup,
  type FollowupStatus,
} from "@/lib/api/followups";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";

const STATUS_FILTERS: Array<{ key: FollowupStatus | "all"; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendientes" },
  { key: "sent", label: "Enviados" },
  { key: "failed", label: "Fallidos" },
  { key: "cancelled", label: "Cancelados" },
];

export function FollowupsView() {
  return (
    <RequireTenant>
      {(tenantId) => <FollowupsInner tenantId={tenantId} />}
    </RequireTenant>
  );
}

function FollowupsInner({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FollowupStatus | "all">("pending");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["followups", tenantId, filter],
    queryFn: () =>
      listFollowups(tenantId, {
        status: filter === "all" ? undefined : filter,
        limit: 200,
      }),
    refetchInterval: 30_000,
  });

  const cancel = useMutation({
    mutationFn: (followupId: string) => cancelFollowupApi(tenantId, followupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["followups", tenantId] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos cancelar el followup."
      ),
  });

  const counts = {
    pending: 0,
    sent: 0,
    failed: 0,
  };
  for (const f of query.data?.followups ?? []) {
    if (f.status === "pending") counts.pending++;
    if (f.status === "sent") counts.sent++;
    if (f.status === "failed") counts.failed++;
  }

  return (
    <PageShell
      title="Followups"
      subtitle="Mensajes de WhatsApp que el bot agendó para volver a contactar a tus clientes en el futuro."
    >
      {error && (
        <div
          role="alert"
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid oklch(0.68 0.21 25 / 0.4)",
            background: "oklch(0.68 0.21 25 / 0.08)",
            color: "var(--z-red)",
            fontSize: 12.5,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            style={{
              padding: "6px 12px",
              borderRadius: 5,
              border:
                filter === f.key
                  ? "1px solid var(--text-1)"
                  : "1px solid var(--hair-strong)",
              background:
                filter === f.key
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0.02)",
              color: filter === f.key ? "var(--text-0)" : "var(--text-1)",
              fontSize: 12,
              fontWeight: filter === f.key ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isLoading && (
        <div style={{ ...cardStyle, textAlign: "center", color: "var(--text-2)" }}>
          <Loader2
            size={14}
            style={{ animation: "spin 900ms linear infinite", marginRight: 6 }}
          />
          Cargando…
        </div>
      )}

      {query.data && query.data.followups.length === 0 && (
        <div className="glass" style={{ ...cardStyle, textAlign: "center", padding: 32 }}>
          <CalendarClock size={28} style={{ color: "var(--text-3)", marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
            Sin followups todavía
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>
            El bot agenda followups automáticamente cuando un cliente dice
            cosas como "te escribo el lunes" o "recordamelo en 2 horas".
          </div>
        </div>
      )}

      {query.data && query.data.followups.length > 0 && (
        <div className="glass" style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          {query.data.followups.map((f, i, arr) => (
            <FollowupRow
              key={f.id}
              followup={f}
              isLast={i === arr.length - 1}
              onCancel={() => cancel.mutate(f.id)}
              cancelling={cancel.isPending && cancel.variables === f.id}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function FollowupRow({
  followup,
  isLast,
  onCancel,
  cancelling,
}: {
  followup: Followup;
  isLast: boolean;
  onCancel: () => void;
  cancelling: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: 14,
        borderBottom: isLast ? "none" : "1px solid var(--hair)",
        alignItems: "flex-start",
      }}
    >
      <StatusIcon status={followup.status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "var(--font-jetbrains-mono)",
              color: "var(--text-1)",
            }}
          >
            {new Date(followup.scheduled_for).toLocaleString()}
          </span>
          {followup.tag && (
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 10,
                background: "rgba(255,255,255,0.06)",
                color: "var(--text-2)",
              }}
            >
              {followup.tag}
            </span>
          )}
          <span
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {followup.created_by}
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-1)",
            lineHeight: 1.4,
            wordBreak: "break-word",
          }}
        >
          {followup.message}
        </div>
        {followup.last_error && (
          <div
            style={{
              fontSize: 11,
              color: "var(--z-red)",
              marginTop: 4,
            }}
          >
            Error: {followup.last_error}
            {followup.attempt_count > 0 && ` · intento ${followup.attempt_count}`}
          </div>
        )}
      </div>
      {followup.status === "pending" && (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            borderRadius: 5,
            border: "1px solid var(--hair-strong)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--text-1)",
            fontSize: 11,
            cursor: cancelling ? "progress" : "pointer",
          }}
        >
          {cancelling ? (
            <Loader2 size={11} style={{ animation: "spin 900ms linear infinite" }} />
          ) : (
            <X size={11} />
          )}
          Cancelar
        </button>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: FollowupStatus }) {
  const config: Record<
    FollowupStatus,
    { icon: typeof Clock; color: string; bg: string }
  > = {
    pending: { icon: Clock, color: "oklch(0.78 0.10 240)", bg: "oklch(0.78 0.10 240 / 0.15)" },
    sending: { icon: Loader2, color: "oklch(0.80 0.14 75)", bg: "oklch(0.80 0.14 75 / 0.15)" },
    sent: { icon: CheckCircle2, color: "var(--z-green)", bg: "oklch(0.78 0.15 155 / 0.15)" },
    failed: { icon: AlertTriangle, color: "var(--z-red)", bg: "oklch(0.68 0.21 25 / 0.15)" },
    cancelled: { icon: XCircle, color: "var(--text-3)", bg: "rgba(255,255,255,0.04)" },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        background: c.bg,
        color: c.color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon
        size={14}
        style={status === "sending" ? { animation: "spin 900ms linear infinite" } : undefined}
      />
    </div>
  );
}
