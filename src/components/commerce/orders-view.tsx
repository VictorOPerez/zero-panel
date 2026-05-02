"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  Truck,
  XCircle,
} from "lucide-react";
import {
  listOrders,
  updateOrderStatus,
  type Order,
  type OrderStatus,
} from "@/lib/api/commerce";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";

const STATUS_FILTERS: Array<{ key: OrderStatus | "all"; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendientes" },
  { key: "paid", label: "Pagados" },
  { key: "fulfilled", label: "Completados" },
  { key: "cancelled", label: "Cancelados" },
];

export function OrdersView() {
  return (
    <RequireTenant>
      {(tenantId) => <OrdersInner tenantId={tenantId} />}
    </RequireTenant>
  );
}

function OrdersInner({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<OrderStatus | "all">("paid");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["orders", tenantId, filter],
    queryFn: () =>
      listOrders(tenantId, {
        status: filter === "all" ? undefined : filter,
        limit: 200,
      }),
    refetchInterval: 30_000,
  });

  const update = useMutation({
    mutationFn: (input: { orderId: string; status: OrderStatus }) =>
      updateOrderStatus(tenantId, input.orderId, { status: input.status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", tenantId] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos actualizar el pedido."
      ),
  });

  return (
    <PageShell
      title="Pedidos"
      subtitle="Pedidos generados desde WhatsApp. Marcá como completados cuando termines de despacharlos."
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

      {query.data && query.data.orders.length === 0 && (
        <div className="glass" style={{ ...cardStyle, textAlign: "center", padding: 32 }}>
          <Package size={28} style={{ color: "var(--text-3)", marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 500 }}>Sin pedidos</div>
        </div>
      )}

      {query.data && query.data.orders.length > 0 && (
        <div className="glass" style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          {query.data.orders.map((o, i, arr) => (
            <OrderRow
              key={o.id}
              order={o}
              isLast={i === arr.length - 1}
              onMarkFulfilled={() =>
                update.mutate({ orderId: o.id, status: "fulfilled" })
              }
              onMarkCancelled={() =>
                update.mutate({ orderId: o.id, status: "cancelled" })
              }
              busy={update.isPending && update.variables?.orderId === o.id}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function OrderRow({
  order,
  isLast,
  onMarkFulfilled,
  onMarkCancelled,
  busy,
}: {
  order: Order;
  isLast: boolean;
  onMarkFulfilled: () => void;
  onMarkCancelled: () => void;
  busy: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: 14,
        borderBottom: isLast ? "none" : "1px solid var(--hair)",
        alignItems: "center",
      }}
    >
      <StatusIcon status={order.status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            #{order.id.slice(0, 8)}
          </span>
          <span
            style={{
              padding: "1px 6px",
              borderRadius: 4,
              fontSize: 10,
              background: "rgba(255,255,255,0.06)",
              color: "var(--text-2)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {order.status}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            {order.client_name ?? order.client_phone ?? "anon"}
          </span>
          <span>
            {order.currency.toUpperCase()}{" "}
            {(order.total_cents / 100).toLocaleString("en-US", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
          </span>
          <span>{new Date(order.created_at).toLocaleString()}</span>
        </div>
        {order.shipping_address && (
          <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>
            📦 {order.shipping_address}
          </div>
        )}
      </div>
      {order.status === "paid" && (
        <button type="button" onClick={onMarkFulfilled} disabled={busy} style={primaryButton}>
          {busy ? (
            <Loader2 size={11} style={{ animation: "spin 900ms linear infinite" }} />
          ) : (
            <Truck size={11} />
          )}
          Marcar despachado
        </button>
      )}
      {order.status === "pending" && (
        <button type="button" onClick={onMarkCancelled} disabled={busy} style={dangerButton}>
          {busy ? <Loader2 size={11} style={{ animation: "spin 900ms linear infinite" }} /> : null}
          Cancelar
        </button>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { icon: typeof Clock; color: string; bg: string }> = {
    pending: { icon: Clock, color: "oklch(0.78 0.10 240)", bg: "oklch(0.78 0.10 240 / 0.15)" },
    paid: { icon: CheckCircle2, color: "var(--z-green)", bg: "oklch(0.78 0.15 155 / 0.15)" },
    fulfilled: { icon: Truck, color: "var(--z-green)", bg: "oklch(0.78 0.15 155 / 0.20)" },
    cancelled: { icon: XCircle, color: "var(--text-3)", bg: "rgba(255,255,255,0.04)" },
    refunded: { icon: XCircle, color: "var(--z-red)", bg: "oklch(0.68 0.21 25 / 0.15)" },
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
      <Icon size={14} />
    </div>
  );
}

const primaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  borderRadius: 5,
  border: "none",
  background: "var(--aurora)",
  color: "#0a0a0f",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const dangerButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  borderRadius: 5,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.08)",
  color: "var(--z-red)",
  fontSize: 11,
  cursor: "pointer",
};
