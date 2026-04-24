"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Loader2, X } from "lucide-react";
import { patchTenant } from "@/lib/api/tenants";
import { ApiError } from "@/lib/api/client";
import type { TenantBusiness } from "@/lib/api/contract";

interface Props {
  tenantId: string;
  initial: TenantBusiness | undefined;
  onClose: () => void;
}

export function BusinessInfoModal({ tenantId, initial, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState(initial?.type ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [owner, setOwner] = useState(initial?.owner ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setType(initial?.type ?? "");
    setLocation(initial?.location ?? "");
    setOwner(initial?.owner ?? "");
  }, [initial]);

  const save = useMutation({
    mutationFn: () =>
      patchTenant(tenantId, {
        business: {
          name: name.trim(),
          owner: owner.trim(),
          type: type.trim(),
          location: location.trim(),
          description: description.trim(),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.payload.error : "No pudimos guardar los cambios.");
    },
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="biz-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(8,8,18,0.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="glass-strong"
        style={{ width: 520, maxWidth: "100%", borderRadius: 12, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--hair)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Building2 size={16} style={{ color: "var(--text-2)" }} />
          <div id="biz-title" style={{ fontSize: 14, fontWeight: 600 }}>
            Información del negocio
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: 5,
              border: "none",
              background: "transparent",
              color: "var(--text-2)",
              cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!name.trim()) {
              setError("El nombre del negocio es obligatorio.");
              return;
            }
            save.mutate();
          }}
          style={{
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {error && (
            <div
              role="alert"
              style={{
                padding: "8px 10px",
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

          <Field
            label="Nombre del negocio"
            value={name}
            onChange={setName}
            placeholder="Aurora Bazar"
            required
          />

          <Field
            label="Descripción"
            value={description}
            onChange={setDescription}
            placeholder="Breve descripción de qué hace tu negocio — la usa el bot para contextualizar sus respuestas."
            multiline
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field
              label="Rubro"
              value={type}
              onChange={setType}
              placeholder="Peluquería, gimnasio, clínica…"
            />
            <Field
              label="Ubicación"
              value={location}
              onChange={setLocation}
              placeholder="Buenos Aires"
            />
          </div>

          <Field
            label="Responsable"
            value={owner}
            onChange={setOwner}
            placeholder="Nombre del owner / titular"
          />
        </form>

        <footer
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--hair)",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            style={secondaryBtn}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              if (!name.trim()) {
                setError("El nombre del negocio es obligatorio.");
                return;
              }
              save.mutate();
            }}
            disabled={save.isPending}
            style={primaryBtn}
          >
            {save.isPending ? (
              <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <Check size={12} />
            )}
            Guardar
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  const commonInputStyle: React.CSSProperties = {
    padding: "9px 11px",
    borderRadius: 6,
    border: "1px solid var(--hair-strong)",
    background: "rgba(0,0,0,0.2)",
    color: "var(--text-0)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    resize: "vertical" as const,
  };
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
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
        {required && <span style={{ color: "var(--z-red)", marginLeft: 4 }}>*</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={commonInputStyle}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={commonInputStyle}
        />
      )}
    </label>
  );
}

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 6,
  border: "none",
  background: "var(--aurora)",
  color: "#0a0a0f",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "7px 12px",
  borderRadius: 6,
  border: "1px solid var(--hair-strong)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-1)",
  fontSize: 11.5,
  fontWeight: 500,
  cursor: "pointer",
};
