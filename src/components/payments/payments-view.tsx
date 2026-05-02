"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unplug,
} from "lucide-react";
import {
  connectStripe,
  disconnectProvider,
  getPaymentsProvider,
  refreshOnboarding,
  syncProvider,
} from "@/lib/api/payments";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";

export function PaymentsView() {
  return (
    <RequireTenant>
      {(tenantId) => <PaymentsInner tenantId={tenantId} />}
    </RequireTenant>
  );
}

function PaymentsInner({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["payments-provider", tenantId],
    queryFn: () => getPaymentsProvider(tenantId),
    refetchInterval: 15_000,
  });

  // Si volvemos del onboarding (?onboarding=complete), forzamos un sync
  // para reflejar el estado real sin esperar al webhook.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "complete") {
      syncProvider(tenantId).finally(() => {
        qc.invalidateQueries({ queryKey: ["payments-provider", tenantId] });
        const url = new URL(window.location.href);
        url.searchParams.delete("onboarding");
        window.history.replaceState({}, "", url.toString());
      });
    }
  }, [tenantId, qc]);

  const connect = useMutation({
    mutationFn: () => connectStripe(tenantId),
    onSuccess: (res) => {
      if (res.onboarding?.url) window.location.assign(res.onboarding.url);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos iniciar el alta de Stripe."
      ),
  });

  const refresh = useMutation({
    mutationFn: () => refreshOnboarding(tenantId),
    onSuccess: (res) => {
      if (res.onboarding?.url) window.location.assign(res.onboarding.url);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos generar un link nuevo."
      ),
  });

  const sync = useMutation({
    mutationFn: () => syncProvider(tenantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments-provider", tenantId] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos refrescar el estado."
      ),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectProvider(tenantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments-provider", tenantId] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos desconectar Stripe."
      ),
  });

  const provider = statusQuery.data?.provider;
  const isActive =
    provider?.status === "active" && provider.charges_enabled === true;
  const requirements =
    provider?.requirements?.currentlyDue ??
    provider?.requirements?.pastDue ??
    [];

  return (
    <PageShell
      title="Cobros"
      subtitle="Activá pagos por WhatsApp con tarjeta. El dinero llega directo a tu cuenta."
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

      <div className="glass" style={{ ...cardStyle, marginBottom: 14 }}>
        {!provider && (
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
              <CreditCard size={18} />
            </div>
            <div className="calendar-status-info">
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                Sin cobros activos
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                Conectá Stripe en 5 minutos. Cobrás con tarjeta y el dinero
                cae directo a tu cuenta — Zero no toca tu plata.
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
                <Loader2
                  size={12}
                  style={{ animation: "spin 900ms linear infinite" }}
                />
              ) : (
                <ExternalLink size={12} />
              )}
              Conectar Stripe
            </button>
          </div>
        )}

        {provider && isActive && (
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
              <div style={{ fontSize: 13, fontWeight: 500 }}>Cobros activos</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                  fontFamily: "var(--font-jetbrains-mono)",
                  wordBreak: "break-all",
                }}
              >
                {provider.account_id}
                {provider.country && ` · ${provider.country}`}
                {provider.default_currency &&
                  ` · ${provider.default_currency.toUpperCase()}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              style={iconButton}
              title="Refrescar estado"
            >
              {sync.isPending ? (
                <Loader2
                  size={13}
                  style={{ animation: "spin 900ms linear infinite" }}
                />
              ) : (
                <RefreshCw size={13} />
              )}
            </button>
            <button
              type="button"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              style={iconButton}
            >
              <Unplug size={13} /> Desconectar
            </button>
          </div>
        )}

        {provider && !isActive && (
          <div className="calendar-status-row">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "oklch(0.80 0.14 75 / 0.15)",
                color: "var(--z-amber)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div className="calendar-status-info">
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                Falta completar verificación
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                {provider.status === "rejected"
                  ? "Stripe rechazó la cuenta. Contactá soporte."
                  : "Stripe necesita más datos para habilitar los cobros."}
                {requirements.length > 0 && (
                  <span> Pendiente: {requirements.slice(0, 3).join(", ")}.</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
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
                cursor: refresh.isPending ? "progress" : "pointer",
              }}
            >
              {refresh.isPending ? (
                <Loader2
                  size={12}
                  style={{ animation: "spin 900ms linear infinite" }}
                />
              ) : (
                <ExternalLink size={12} />
              )}
              Continuar verificación
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}

const iconButton: React.CSSProperties = {
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
};
