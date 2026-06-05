"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Cloud,
  ExternalLink,
  Loader2,
  Mail,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import {
  disconnectNylas,
  getNylasConnectUrl,
  getNylasStatus,
  type NylasProvider,
} from "@/lib/api/nylas-calendar";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";

interface ProviderDef {
  id: NylasProvider;
  name: string;
  desc: string;
  icon: LucideIcon;
  color: string; // oklch para el ícono
}

// Una tarjeta por cada calendario que Nylas permite conectar.
const PROVIDERS: ProviderDef[] = [
  {
    id: "google",
    name: "Google Calendar",
    desc: "Gmail · Google Workspace",
    icon: Calendar,
    color: "oklch(0.72 0.18 145)",
  },
  {
    id: "microsoft",
    name: "Outlook / Microsoft 365",
    desc: "Outlook · Office 365 · Hotmail",
    icon: Mail,
    color: "oklch(0.68 0.16 245)",
  },
  {
    id: "icloud",
    name: "iCloud",
    desc: "Apple · iCloud Calendar",
    icon: Cloud,
    color: "oklch(0.80 0.02 250)",
  },
  {
    id: "ews",
    name: "Exchange",
    desc: "Exchange Web Services (on-prem)",
    icon: Building2,
    color: "oklch(0.74 0.13 195)",
  },
];

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google Calendar",
  microsoft: "Outlook / Microsoft 365",
  icloud: "iCloud",
  ews: "Exchange",
};

export function NylasCalendarView() {
  return (
    <RequireTenant>
      {(tenantId) => <NylasCalendarInner tenantId={tenantId} />}
    </RequireTenant>
  );
}

function NylasCalendarInner({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState<NylasProvider | null>(null);

  // Procesa ?calendar=connected|error&reason=... que setea el backend al volver
  // del callback de Nylas. Muestra un banner y limpia la URL.
  useEffect(() => {
    const result = searchParams.get("calendar");
    if (!result) return;
    if (result === "connected") {
      setSuccess("Calendario conectado.");
      setError(null);
      qc.invalidateQueries({ queryKey: ["nylas-status", tenantId] });
    } else if (result === "error") {
      const reason = searchParams.get("reason") ?? "unknown";
      if (reason === "access_denied") {
        setError("Cancelaste la autorización.");
      } else {
        setError(`No pudimos completar la conexión (${reason}).`);
      }
      setSuccess(null);
    }
    router.replace("/calendar", { scroll: false });
  }, [searchParams, router, qc, tenantId]);

  const statusQuery = useQuery({
    queryKey: ["nylas-status", tenantId],
    queryFn: () => getNylasStatus(tenantId),
    refetchInterval: 15_000,
  });

  const connect = useMutation({
    mutationFn: (provider: NylasProvider) => {
      setPending(provider);
      return getNylasConnectUrl(tenantId, provider);
    },
    onSuccess: (res) => {
      if (res.url) window.location.assign(res.url);
    },
    onError: (err) => {
      setPending(null);
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos iniciar la conexión."
      );
    },
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectNylas(tenantId),
    onSuccess: () => {
      setSuccess(null);
      qc.invalidateQueries({ queryKey: ["nylas-status", tenantId] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos desconectar el calendario."
      ),
  });

  const status = statusQuery.data?.status;
  const connectedLabel = status?.provider
    ? PROVIDER_LABEL[status.provider] ?? status.provider
    : "Calendario";

  return (
    <PageShell
      title="Calendario"
      subtitle="Conectá el calendario de tu equipo para que el bot agende citas y respete tu disponibilidad."
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

      {success && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid oklch(0.78 0.15 155 / 0.4)",
            background: "oklch(0.78 0.15 155 / 0.10)",
            color: "var(--z-green)",
            fontSize: 12.5,
            marginBottom: 12,
          }}
        >
          <CheckCircle2 size={14} /> {success}
        </div>
      )}

      {status?.connected ? (
        // Estado conectado: una sola conexión activa (Nylas guarda una por tenant).
        <div className="glass" style={{ ...cardStyle }}>
          <div className="calendar-status-row">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "oklch(0.78 0.15 155 / 0.15)",
                color: "var(--z-green)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={18} />
            </div>
            <div className="calendar-status-info">
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                Conectado · {connectedLabel}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                  fontFamily: "var(--font-jetbrains-mono)",
                  wordBreak: "break-all",
                }}
              >
                {status.email}
              </div>
            </div>
            <button
              type="button"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 5,
                border: "1px solid var(--hair-strong)",
                background: "rgba(255,255,255,0.03)",
                color: "var(--text-1)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {disconnect.isPending ? (
                <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
              ) : (
                <Unplug size={13} />
              )}{" "}
              Desconectar
            </button>
          </div>
        </div>
      ) : (
        // Sin conexión: una tarjeta por cada calendario conectable.
        <>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Elegí tu calendario
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {PROVIDERS.map((p) => {
              const Icon = p.icon;
              const isPending = connect.isPending && pending === p.id;
              return (
                <div
                  key={p.id}
                  className="glass"
                  style={{
                    ...cardStyle,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--hair)",
                        color: p.color,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={19} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {p.desc}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => connect.mutate(p.id)}
                    disabled={connect.isPending}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 5,
                      border: "none",
                      background: "var(--aurora)",
                      color: "#0a0a0f",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: connect.isPending ? "progress" : "pointer",
                      opacity: connect.isPending && !isPending ? 0.5 : 1,
                    }}
                  >
                    {isPending ? (
                      <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
                    ) : (
                      <ExternalLink size={12} />
                    )}
                    Conectar
                  </button>
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 14,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--hair)",
              background: "rgba(255,255,255,0.02)",
              color: "var(--text-2)",
              fontSize: 12,
            }}
          >
            <AlertTriangle size={14} style={{ color: "var(--z-amber)", flexShrink: 0 }} />
            Sin un calendario conectado, el bot no puede agendar citas ni ver tu
            disponibilidad.
          </div>
        </>
      )}
    </PageShell>
  );
}
