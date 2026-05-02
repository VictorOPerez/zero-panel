"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type Product,
} from "@/lib/api/commerce";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";

export function ProductsView() {
  return (
    <RequireTenant>
      {(tenantId) => <ProductsInner tenantId={tenantId} />}
    </RequireTenant>
  );
}

function ProductsInner({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ["products", tenantId, search],
    queryFn: () =>
      listProducts(tenantId, {
        search: search.trim() || undefined,
        limit: 100,
      }),
    refetchInterval: 30_000,
  });

  const remove = useMutation({
    mutationFn: (productId: string) => deleteProduct(tenantId, productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", tenantId] });
    },
  });

  return (
    <PageShell
      title="Productos"
      subtitle="Catálogo del negocio. El bot consulta esta lista al cobrar productos por WhatsApp."
      actions={
        <button
          type="button"
          onClick={() => setCreating(true)}
          style={primaryButton}
        >
          <Plus size={13} /> Agregar producto
        </button>
      }
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--hair)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <Search size={14} style={{ color: "var(--text-3)" }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, SKU, descripción…"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text-1)",
            fontSize: 13,
          }}
        />
        {query.data && (
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            {query.data.total} productos
          </span>
        )}
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

      {query.data && query.data.products.length === 0 && (
        <div className="glass" style={{ ...cardStyle, textAlign: "center", padding: 32 }}>
          <Package size={28} style={{ color: "var(--text-3)", marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
            Sin productos cargados
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 14 }}>
            Agregá tu catálogo y el bot va a poder cobrar a tus clientes por WhatsApp.
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            style={primaryButton}
          >
            <Plus size={12} /> Agregar primer producto
          </button>
        </div>
      )}

      {query.data && query.data.products.length > 0 && (
        <div className="glass" style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          {query.data.products.map((p, i, arr) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                gap: 12,
                padding: 14,
                borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--hair)",
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                  {p.sku && (
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontSize: 10,
                        background: "rgba(255,255,255,0.06)",
                        color: "var(--text-2)",
                        fontFamily: "var(--font-jetbrains-mono)",
                      }}
                    >
                      {p.sku}
                    </span>
                  )}
                  {!p.active && (
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontSize: 10,
                        background: "rgba(255,255,255,0.04)",
                        color: "var(--text-3)",
                      }}
                    >
                      inactivo
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", display: "flex", gap: 12 }}>
                  <span>
                    {p.currency.toUpperCase()}{" "}
                    {(p.price_cents / 100).toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span>
                    Stock: {p.stock === null ? "∞" : p.stock}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(p)}
                style={iconButton}
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Eliminar "${p.name}"?`)) {
                    remove.mutate(p.id);
                  }
                }}
                style={dangerButton}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ProductFormModal
          tenantId={tenantId}
          product={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </PageShell>
  );
}

function ProductFormModal({
  tenantId,
  product,
  onClose,
}: {
  tenantId: string;
  product: Product | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    description: product?.description ?? "",
    price: product ? (product.price_cents / 100).toString() : "",
    currency: product?.currency ?? "usd",
    stock: product?.stock === null ? "" : String(product?.stock ?? ""),
    image_url: product?.image_url ?? "",
    active: product?.active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const priceCents = Math.round(Number(form.price) * 100);
      const stockValue = form.stock.trim() === "" ? null : Math.floor(Number(form.stock));
      const body = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        description: form.description.trim() || null,
        price_cents: priceCents,
        currency: form.currency.trim().toLowerCase(),
        stock: stockValue,
        image_url: form.image_url.trim() || null,
        active: form.active,
      };
      if (product) {
        return await updateProduct(tenantId, product.id, body);
      }
      return await createProduct(tenantId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", tenantId] });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.payload.error : "No pudimos guardar el producto."
      ),
  });

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
          maxWidth: 520,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: 24,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            {product ? "Editar producto" : "Nuevo producto"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-2)" }}
          >
            <X size={16} />
          </button>
        </div>

        <Field label="Nombre">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputStyle}
          />
        </Field>

        <Field label="SKU (opcional)">
          <input
            type="text"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            style={inputStyle}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
          <Field label="Precio">
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="Moneda">
            <input
              type="text"
              value={form.currency}
              onChange={(e) =>
                setForm({ ...form, currency: e.target.value.toLowerCase() })
              }
              style={inputStyle}
              maxLength={3}
            />
          </Field>
        </div>

        <Field label="Stock (vacío = ilimitado)">
          <input
            type="number"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            style={inputStyle}
          />
        </Field>

        <Field label="Descripción (opcional)">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </Field>

        <Field label="Imagen URL (opcional)">
          <input
            type="url"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            style={inputStyle}
          />
        </Field>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-1)" }}>
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Activo (visible para el bot)
        </label>

        {error && (
          <div
            role="alert"
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid oklch(0.68 0.21 25 / 0.4)",
              background: "oklch(0.68 0.21 25 / 0.08)",
              color: "var(--z-red)",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={ghostButton}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!form.name.trim() || !form.price.trim() || mutation.isPending}
            style={primaryButton}
          >
            {mutation.isPending ? (
              <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
            ) : null}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 5,
  border: "1px solid var(--hair-strong)",
  background: "rgba(0,0,0,0.3)",
  color: "var(--text-1)",
  fontSize: 12.5,
  outline: "none",
};

const primaryButton: React.CSSProperties = {
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

const ghostButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 12px",
  borderRadius: 5,
  border: "1px solid var(--hair-strong)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-1)",
  fontSize: 12,
  cursor: "pointer",
};

const iconButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 5,
  border: "1px solid var(--hair-strong)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-1)",
  fontSize: 11,
  cursor: "pointer",
};

const dangerButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 5,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.08)",
  color: "var(--z-red)",
  fontSize: 11,
  cursor: "pointer",
};
