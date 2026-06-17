"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Check,
  Zap,
} from "lucide-react";
import {
  getTelnyxBalance,
  getTelnyxAutoRecharge,
  setTelnyxAutoRecharge,
} from "@/lib/api/platform";
import { ApiError } from "@/lib/api/client";

export function TelnyxBalanceCard() {
  const qc = useQueryClient();

  const balanceQ = useQuery({
    queryKey: ["telnyx-balance"],
    queryFn: getTelnyxBalance,
    staleTime: 30_000,
    retry: false,
  });

  const notConfigured =
    balanceQ.error instanceof ApiError &&
    balanceQ.error.payload.error === "telnyx_not_configured";

  return (
    <div
      className="glass"
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid var(--hair)",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: "oklch(0.78 0.15 155 / 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Wallet size={18} style={{ color: "oklch(0.78 0.15 155)" }} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-3)", fontWeight: 600 }}>
            Saldo del proveedor de números (Telnyx)
          </div>
          {balanceQ.isLoading ? (
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Cargando saldo…</div>
          ) : notConfigured ? (
            <div style={{ fontSize: 13, color: "var(--z-amber)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={13} /> Cargá <code style={codeStyle}>TELNYX_API_KEY</code> en Railway para ver el saldo.
            </div>
          ) : balanceQ.isError ? (
            <div style={{ fontSize: 13, color: "var(--z-red)", marginTop: 4 }}>
              No pudimos leer el saldo de Telnyx.
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text-0)", fontFamily: "var(--font-jetbrains-mono)" }}>
                {balanceQ.data!.balance.currency} {balanceQ.data!.balance.balance.toFixed(2)}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                disponible: {balanceQ.data!.balance.currency} {balanceQ.data!.balance.availableCredit.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: ["telnyx-balance"] })}
            disabled={balanceQ.isFetching}
            title="Actualizar saldo"
            style={iconBtn}
          >
            <RefreshCw
              size={13}
              style={balanceQ.isFetching ? { animation: "spin 900ms linear infinite" } : undefined}
            />
          </button>
          <a
            href={balanceQ.data?.add_funds_url || "https://portal.telnyx.com/#/app/billing/payments"}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...primaryBtn, textDecoration: "none" }}
          >
            <ExternalLink size={13} /> Cargar fondos
          </a>
        </div>
      </div>

      {/* Nota: cargar a mano es por el portal (no hay API). La auto-recarga SÍ. */}
      {!notConfigured && !balanceQ.isError && <AutoRechargeRow />}
    </div>
  );
}

function AutoRechargeRow() {
  const q = useQuery({
    queryKey: ["telnyx-auto-recharge"],
    queryFn: getTelnyxAutoRecharge,
    staleTime: 60_000,
    retry: false,
  });

  const [editing, setEditing] = useState(false);
  const [threshold, setThreshold] = useState("20");
  const [recharge, setRecharge] = useState("50");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (q.data?.auto_recharge) {
      if (q.data.auto_recharge.thresholdAmount != null)
        setThreshold(String(q.data.auto_recharge.thresholdAmount));
      if (q.data.auto_recharge.rechargeAmount != null)
        setRecharge(String(q.data.auto_recharge.rechargeAmount));
    }
  }, [q.data]);

  const mut = useMutation({
    mutationFn: (body: { enabled: boolean; threshold_amount?: number; recharge_amount?: number }) =>
      setTelnyxAutoRecharge(body),
    onSuccess: () => {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 1500);
      q.refetch();
    },
  });

  const ar = q.data?.auto_recharge;
  const enabled = ar?.enabled ?? false;

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--hair)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Zap size={13} style={{ color: enabled ? "oklch(0.85 0.18 90)" : "var(--text-3)" }} />
        <span style={{ fontSize: 12.5, color: "var(--text-1)" }}>
          Recarga automática:{" "}
          <strong style={{ color: enabled ? "var(--z-green)" : "var(--text-2)" }}>
            {q.isLoading ? "…" : enabled ? "Activada" : "Desactivada"}
          </strong>
          {enabled && ar?.thresholdAmount != null && (
            <span style={{ color: "var(--text-3)" }}>
              {" "}— si baja de {ar.thresholdAmount.toFixed(0)}, recarga {ar.rechargeAmount?.toFixed(0)}
            </span>
          )}
        </span>

        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {saved && (
            <span style={{ fontSize: 11.5, color: "var(--z-green)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Check size={12} /> Guardado
            </span>
          )}
          {enabled && !editing && (
            <button
              type="button"
              onClick={() => mut.mutate({ enabled: false })}
              disabled={mut.isPending}
              style={miniGhostBtn}
            >
              Desactivar
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            style={miniGhostBtn}
          >
            {editing ? "Cerrar" : enabled ? "Editar" : "Configurar"}
          </button>
        </div>
      </div>

      {editing && (
        <div style={{ display: "flex", gap: 8, alignItems: "end", marginTop: 10, flexWrap: "wrap" }}>
          <label style={fieldStyle}>
            <span style={fieldLabel}>Recargar si baja de (USD)</span>
            <input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabel}>Monto a recargar (mín. 10)</span>
            <input
              value={recharge}
              onChange={(e) => setRecharge(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              style={inputStyle}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              mut.mutate({
                enabled: true,
                threshold_amount: Number(threshold) || 0,
                recharge_amount: Number(recharge) || 10,
              })
            }
            disabled={mut.isPending}
            style={primaryBtn}
          >
            {mut.isPending ? (
              <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <Check size={13} />
            )}
            Activar recarga auto
          </button>
        </div>
      )}

      {mut.isError && (
        <div style={{ fontSize: 12, color: "var(--z-red)", marginTop: 8 }}>
          {mut.error instanceof ApiError && typeof mut.error.payload.detail === "string"
            ? mut.error.payload.detail
            : "No pudimos guardar la auto-recarga (Telnyx puede requerir una tarjeta cargada en el portal)."}
        </div>
      )}
    </div>
  );
}

const codeStyle: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 11,
  padding: "1px 5px",
  borderRadius: 3,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid var(--hair)",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 10,
  color: "var(--text-3)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: 150,
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--hair)",
  background: "rgba(0,0,0,0.2)",
  color: "var(--text-0)",
  fontSize: 13,
  fontFamily: "var(--font-jetbrains-mono)",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
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
  cursor: "pointer",
};

const miniGhostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  borderRadius: 5,
  border: "1px solid var(--hair)",
  background: "transparent",
  color: "var(--text-1)",
  fontSize: 11.5,
  fontWeight: 500,
  cursor: "pointer",
};

const iconBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 6,
  border: "1px solid var(--hair)",
  background: "transparent",
  color: "var(--text-2)",
  cursor: "pointer",
  flexShrink: 0,
};
