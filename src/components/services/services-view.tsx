"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, ShieldCheck } from "lucide-react";
import {
  createTenantService,
  deleteTenantService,
  listTenantServices,
  updateTenantService,
} from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import type { TenantService } from "@/lib/api/contract";

const CURRENCIES = ["USD", "ARS", "EUR", "CLP", "UYU", "BRL", "MXN", "COP", "PEN"];

export function ServicesView() {
  return (
    <RequireTenant>{(tenantId) => <Services tenantId={tenantId} />}</RequireTenant>
  );
}

function Services({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<{
    name: string;
    duration: string;
    price: string;
  } | null>(null);

  const query = useQuery({
    queryKey: ["tenant-services", tenantId],
    queryFn: () => listTenantServices(tenantId),
  });

  const createMut = useMutation({
    mutationFn: (body: Parameters<typeof createTenantService>[1]) =>
      createTenantService(tenantId, body),
    onSuccess: (svc) => {
      qc.setQueryData<TenantService[] | undefined>(
        ["tenant-services", tenantId],
        (prev) => [...(prev ?? []), svc]
      );
      setNewDraft(null);
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.payload.error : "No pudimos crear el servicio."
      );
    },
  });

  function addService() {
    if (!newDraft) {
      setNewDraft({ name: "", duration: "45", price: "" });
      return;
    }
    const name = newDraft.name.trim();
    const duration = Number(newDraft.duration);
    if (!name) {
      setError("Poné un nombre al servicio.");
      return;
    }
    if (!Number.isFinite(duration) || duration < 5 || duration > 1440) {
      setError("La duración debe ser entre 5 y 1440 minutos.");
      return;
    }
    const priceCents = newDraft.price.trim()
      ? Math.round(Number(newDraft.price) * 100)
      : 0;
    if (priceCents < 0 || !Number.isFinite(priceCents)) {
      setError("El precio debe ser un número válido.");
      return;
    }
    setError(null);
    createMut.mutate({
      name,
      duration_minutes: duration,
      price_cents: priceCents,
    });
  }

  return (
    <PageShell
      title="Servicios"
      subtitle="Catálogo de lo que ofrece tu negocio. El bot lo usa para proponer y reservar."
      actions={
        <button
          type="button"
          onClick={addService}
          disabled={createMut.isPending}
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
            cursor: "pointer",
          }}
        >
          {createMut.isPending ? (
            <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
          ) : (
            <Plus size={13} />
          )}
          {newDraft ? "Guardar servicio" : "Agregar servicio"}
        </button>
      }
    >
      <ProtectedNotice />

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
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      {newDraft && (
        <div
          className="glass"
          style={{
            ...cardStyle,
            marginBottom: 12,
            border: "1px dashed var(--hair-strong)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontWeight: 600,
            }}
          >
            Nuevo servicio
          </div>
          <div className="services-draft-grid">
            <DraftField label="Nombre">
              <input
                autoFocus
                value={newDraft.name}
                onChange={(e) =>
                  setNewDraft({ ...newDraft, name: e.target.value })
                }
                placeholder="Ej: Corte"
                style={inputStyle}
              />
            </DraftField>
            <DraftField label="Duración (min)">
              <input
                type="number"
                min={5}
                max={1440}
                value={newDraft.duration}
                onChange={(e) =>
                  setNewDraft({ ...newDraft, duration: e.target.value })
                }
                style={inputStyle}
              />
            </DraftField>
            <DraftField label="Precio (opcional)">
              <input
                type="number"
                min={0}
                step={0.01}
                value={newDraft.price}
                onChange={(e) =>
                  setNewDraft({ ...newDraft, price: e.target.value })
                }
                placeholder="0"
                style={inputStyle}
              />
            </DraftField>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setNewDraft(null)}
              style={backBtn}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {query.isLoading && (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Cargando servicios…
        </div>
      )}

      {!query.isLoading && (query.data?.length ?? 0) === 0 && !newDraft && (
        <EmptyState onAdd={() => addService()} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {query.data?.map((svc) => (
          <ServiceRow
            key={svc.id}
            service={svc}
            tenantId={tenantId}
            onError={setError}
          />
        ))}
      </div>
    </PageShell>
  );
}

function ServiceRow({
  service,
  tenantId,
  onError,
}: {
  service: TenantService;
  tenantId: string;
  onError: (msg: string | null) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(service.name);
  const [duration, setDuration] = useState(String(service.duration_minutes));
  const [price, setPrice] = useState(
    service.price_cents > 0 ? (service.price_cents / 100).toString() : ""
  );
  const [currency, setCurrency] = useState(service.currency || "USD");
  const [description, setDescription] = useState(service.description ?? "");
  const [active, setActive] = useState(service.active);

  // Sincroniza si el backend actualizó
  useEffect(() => {
    setName(service.name);
    setDuration(String(service.duration_minutes));
    setPrice(service.price_cents > 0 ? (service.price_cents / 100).toString() : "");
    setCurrency(service.currency || "USD");
    setDescription(service.description ?? "");
    setActive(service.active);
  }, [service]);

  const updateMut = useMutation({
    mutationFn: (body: Parameters<typeof updateTenantService>[2]) =>
      updateTenantService(tenantId, service.id, body),
    onSuccess: (svc) => {
      qc.setQueryData<TenantService[] | undefined>(
        ["tenant-services", tenantId],
        (prev) => prev?.map((s) => (s.id === svc.id ? svc : s))
      );
      onError(null);
    },
    onError: (err) => {
      onError(
        err instanceof ApiError ? err.payload.error : "No pudimos actualizar el servicio."
      );
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteTenantService(tenantId, service.id),
    onSuccess: () => {
      qc.setQueryData<TenantService[] | undefined>(
        ["tenant-services", tenantId],
        (prev) => prev?.filter((s) => s.id !== service.id)
      );
      onError(null);
    },
    onError: (err) => {
      onError(
        err instanceof ApiError ? err.payload.error : "No pudimos eliminar el servicio."
      );
    },
  });

  function saveIfChanged<K extends string>(key: K, value: unknown, original: unknown) {
    if (value === original) return;
    updateMut.mutate({ [key]: value } as Parameters<typeof updateTenantService>[2]);
  }

  function onBlurDuration() {
    const n = Number(duration);
    if (!Number.isFinite(n) || n < 5 || n > 1440) {
      onError("Duración inválida (5–1440 min).");
      setDuration(String(service.duration_minutes));
      return;
    }
    if (n === service.duration_minutes) return;
    updateMut.mutate({ duration_minutes: n });
  }

  function onBlurPrice() {
    const trimmed = price.trim();
    const cents = trimmed ? Math.round(Number(trimmed) * 100) : 0;
    if (!Number.isFinite(cents) || cents < 0) {
      onError("Precio inválido.");
      setPrice(service.price_cents > 0 ? (service.price_cents / 100).toString() : "");
      return;
    }
    if (cents === service.price_cents) return;
    updateMut.mutate({ price_cents: cents });
  }

  return (
    <div
      className="glass services-row"
      style={{
        ...cardStyle,
        border: active ? "1px solid var(--hair)" : "1px solid var(--hair)",
        opacity: active ? 1 : 0.6,
      }}
    >
      <div className="services-row-grid">
        <Field label="Servicio" colSpan={2}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const trimmed = name.trim();
              if (!trimmed) {
                setName(service.name);
                return;
              }
              saveIfChanged("name", trimmed, service.name);
            }}
            placeholder="Corte / Masaje / Limpieza…"
            style={inputStyle}
          />
        </Field>
        <Field label="Duración">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number"
              min={5}
              max={1440}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              onBlur={onBlurDuration}
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ color: "var(--text-3)", fontSize: 11 }}>min</span>
          </div>
        </Field>
        <Field label="Precio">
          <div style={{ display: "flex", gap: 6 }}>
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                updateMut.mutate({ currency: e.target.value });
              }}
              style={{ ...inputStyle, width: 72 }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={onBlurPrice}
              placeholder="0"
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            />
          </div>
        </Field>
      </div>

      <Field label="Descripción (opcional)">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            saveIfChanged("description", description.trim() || null, service.description)
          }
          maxLength={500}
          placeholder="Ej: máquina + tijera"
          style={inputStyle}
        />
      </Field>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 4,
          gap: 8,
        }}
      >
        <Toggle
          label={active ? "Activo" : "Inactivo"}
          description={
            active
              ? "El bot puede ofrecerlo y reservarlo."
              : "El bot no lo va a mencionar ni reservar."
          }
          checked={active}
          onChange={(v) => {
            setActive(v);
            updateMut.mutate({ active: v });
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (confirm(`¿Eliminar "${service.name}"? Las reservas pasadas se mantienen.`)) {
              deleteMut.mutate();
            }
          }}
          disabled={deleteMut.isPending}
          aria-label={`Eliminar ${service.name}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 6,
            border: "1px solid var(--hair)",
            background: "transparent",
            color: "var(--text-3)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {deleteMut.isPending ? (
            <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
          ) : (
            <Trash2 size={13} />
          )}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        padding: "40px 24px",
        borderRadius: 10,
        border: "1px dashed var(--hair-strong)",
        background: "rgba(255,255,255,0.015)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>
        Todavía no cargaste servicios
      </div>
      <div style={{ fontSize: 12, color: "var(--text-2)", maxWidth: 420, lineHeight: 1.5 }}>
        El bot funciona igual, pero si cargás los servicios de tu negocio (duración,
        precio, descripción) va a saber qué ofrecer y reservar con la duración
        correcta.
      </div>
      <button
        type="button"
        onClick={onAdd}
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
          cursor: "pointer",
        }}
      >
        <Plus size={13} />
        Agregar primer servicio
      </button>
    </div>
  );
}

function ProtectedNotice() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid oklch(0.80 0.13 200 / 0.25)",
        background: "oklch(0.80 0.13 200 / 0.06)",
        marginBottom: 14,
      }}
    >
      <ShieldCheck
        size={16}
        style={{ color: "var(--z-cyan)", flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--text-0)" }}>Catálogo liviano por diseño.</strong>
        <div style={{ marginTop: 3, color: "var(--text-2)" }}>
          El bot lee esta lista para proponer servicios y bloquear la duración
          correcta en el calendario. Mantené los nombres cortos y descripciones
          breves — cuantos más servicios, más tokens gasta cada conversación.
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  colSpan,
  children,
}: {
  label: string;
  colSpan?: number;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        gridColumn: colSpan ? `span ${colSpan}` : undefined,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function DraftField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        minWidth: 0,
        flex: 1,
      }}
    >
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 34,
          height: 20,
          borderRadius: 10,
          border: "1px solid var(--hair-strong)",
          background: checked ? "var(--aurora)" : "rgba(255,255,255,0.05)",
          position: "relative",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: checked ? 15 : 1,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            transition: "left 120ms",
          }}
        />
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-0)" }}>
          {label}
        </span>
        {description && (
          <span style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.3 }}>
            {description}
          </span>
        )}
      </div>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--hair)",
  background: "rgba(0,0,0,0.2)",
  color: "var(--text-0)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  minWidth: 0,
};
const backBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "7px 12px",
  borderRadius: 6,
  border: "none",
  background: "transparent",
  color: "var(--text-3)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};
