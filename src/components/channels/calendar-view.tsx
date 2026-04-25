"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Loader2, Unplug } from "lucide-react";
import {
  disconnectCalendar,
  getCalendarAuthUrl,
  getCalendarStatus,
} from "@/lib/api/calendar";
import { listCalendarEvents } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/client";
import { connectSocket, getSocket } from "@/lib/socket/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";

export function CalendarView() {
  return <RequireTenant>{(tenantId) => <CalendarInner tenantId={tenantId} />}</RequireTenant>;
}

function CalendarInner({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["calendar-status", tenantId],
    queryFn: () => getCalendarStatus(tenantId),
    refetchInterval: 15_000,
  });

  const eventsQuery = useQuery({
    queryKey: ["calendar-events", tenantId],
    queryFn: () => listCalendarEvents(tenantId, { limit: 50 }),
    enabled: Boolean(statusQuery.data?.status?.connected),
  });

  const connect = useMutation({
    mutationFn: () => getCalendarAuthUrl(tenantId),
    onSuccess: (res) => {
      if (res.url) window.location.assign(res.url);
    },
    onError: (err) => {
      // Pre-flight bloqueado: el tenant aún no está autorizado para iniciar
      // el OAuth (la app GCP está en testing mode y el email no está como
      // Test user). Mostramos modal "Validando" en vez de un error feo.
      if (err instanceof ApiError && err.payload.code === "oauth_pending_approval") {
        setOauthPending(true);
        setError(null);
        return;
      }
      setError(err instanceof ApiError ? err.payload.error : "No pudimos iniciar la autorización.");
    },
  });

  // Socket: cuando el dueño autoriza el tenant desde /requests, el backend
  // emite tenant:oauth_authorized → cerramos el modal y refrescamos status.
  useEffect(() => {
    if (!tenantId) return;
    const socket = connectSocket(tenantId);
    const onAuthorized = (payload: { authorized: boolean }) => {
      if (payload.authorized) {
        setOauthPending(false);
        qc.invalidateQueries({ queryKey: ["calendar-status", tenantId] });
      }
    };
    socket.on("tenant:oauth_authorized", onAuthorized);
    return () => {
      getSocket().off("tenant:oauth_authorized", onAuthorized);
    };
  }, [tenantId, qc]);

  const disconnect = useMutation({
    mutationFn: () => disconnectCalendar(tenantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-status", tenantId] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.payload.error : "No pudimos desconectar Google Calendar."),
  });

  const status = statusQuery.data?.status;

  return (
    <PageShell
      title="Google Calendar"
      subtitle="Sincronizá el calendario de tu equipo para activar el booking orchestrator."
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

      {oauthPending && (
        <OauthPendingModal onClose={() => setOauthPending(false)} />
      )}

      {status?.last_error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid oklch(0.80 0.14 75 / 0.4)",
            background: "oklch(0.80 0.14 75 / 0.10)",
            color: "var(--text-1)",
            fontSize: 12.5,
            marginBottom: 12,
          }}
        >
          <AlertTriangle size={14} style={{ color: "var(--z-amber)" }} />
          Reauth requerido: {status.last_error}
        </div>
      )}

      <div className="glass" style={{ ...cardStyle, marginBottom: 14 }}>
        {status?.connected ? (
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
              <div style={{ fontSize: 13, fontWeight: 500 }}>Conectado</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                  fontFamily: "var(--font-jetbrains-mono)",
                  wordBreak: "break-all",
                }}
              >
                {status.account_email}
                {status.last_sync_at && ` · sync ${new Date(status.last_sync_at).toLocaleString()}`}
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
              <Unplug size={13} /> Desconectar
            </button>
          </div>
        ) : (
          <div className="calendar-status-row">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                color: "var(--text-2)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--hair)",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div className="calendar-status-info">
              <div style={{ fontSize: 13, fontWeight: 500 }}>No conectado</div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                Sin Google Calendar, el bot cae al fallback queue cuando intenta reservar.
              </div>
            </div>
            <button
              type="button"
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 5,
                border: "none",
                background: "var(--aurora)",
                color: "#0a0a0f",
                fontSize: 12,
                fontWeight: 600,
                cursor: connect.isPending ? "progress" : "pointer",
              }}
            >
              {connect.isPending ? (
                <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
              ) : (
                <ExternalLink size={12} />
              )}
              Conectar Google Calendar
            </button>
          </div>
        )}
      </div>

      {status?.connected && (
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
            Próximos eventos sincronizados
          </div>
          <div className="glass" style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            {eventsQuery.isLoading && (
              <div style={{ padding: 16, color: "var(--text-2)", fontSize: 12 }}>Cargando…</div>
            )}
            {eventsQuery.data?.events?.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                Sin eventos próximos
              </div>
            )}
            {eventsQuery.data?.events?.map((e, i, arr) => (
              <div
                key={e.id}
                className="calendar-event-row"
                style={{
                  borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--hair)",
                }}
              >
                <div style={{ minWidth: 90 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.date}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-jetbrains-mono)" }}>
                    {e.time}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {e.contact_name} · {e.source}
                  </div>
                </div>
                {e.details && <div style={{ fontSize: 11, color: "var(--text-2)" }}>{e.details}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}

function OauthPendingModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong"
        style={{
          maxWidth: 460,
          width: "100%",
          padding: 28,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "var(--aurora)",
            display: "grid",
            placeItems: "center",
            color: "#0a0a0f",
          }}
        >
          <Clock size={22} />
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>
          Estamos validando tu acceso
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}>
          Por seguridad, los conectores de Google Calendar se autorizan uno a uno.
          Ya avisamos al equipo y vamos a habilitarte en pocos minutos en horario laboral.
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
          Cuando esté listo, este modal se cierra solo y vas a poder conectar Google
          Calendar con un click. No hace falta que recargues la página.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <a
            href="mailto:hola@navapex.com?subject=Activación%20de%20Google%20Calendar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid var(--hair-strong)",
              background: "rgba(255,255,255,0.03)",
              color: "var(--text-1)",
              fontSize: 12,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Escribir al equipo
          </a>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: "var(--aurora)",
              color: "#0a0a0f",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
