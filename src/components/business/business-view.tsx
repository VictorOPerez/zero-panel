"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Loader2 } from "lucide-react";
import { getTenant, patchTenant } from "@/lib/api/tenants";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import type { TenantBusiness } from "@/lib/api/contract";

export function BusinessView() {
  return (
    <RequireTenant>
      {(tenantId) => <BusinessForm tenantId={tenantId} />}
    </RequireTenant>
  );
}

function BusinessForm({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();

  const tenantQuery = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => getTenant(tenantId).then((r) => r.tenant),
  });
  const initial: TenantBusiness | undefined = tenantQuery.data?.business;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [owner, setOwner] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Hidratar el form cuando llega la data del backend.
  useEffect(() => {
    if (!initial) return;
    setName(initial.name ?? "");
    setDescription(initial.description ?? "");
    setType(initial.type ?? "");
    setLocation(initial.location ?? "");
    setOwner(initial.owner ?? "");
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
      setError(null);
      setSaved(true);
      // Banner de "guardado" se auto-oculta a los 2s.
      window.setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.payload.error || "No pudimos guardar los cambios."
          : "Error de red."
      );
    },
  });

  const dirty =
    initial !== undefined &&
    (name !== (initial.name ?? "") ||
      description !== (initial.description ?? "") ||
      type !== (initial.type ?? "") ||
      location !== (initial.location ?? "") ||
      owner !== (initial.owner ?? ""));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!name.trim()) {
      setError("El nombre del negocio es obligatorio.");
      return;
    }
    save.mutate();
  };

  return (
    <PageShell
      title="Negocio"
      subtitle="Información que el agente usa para contextualizar todas sus respuestas. Cambialo cuando quieras."
      actions={
        <button
          type="button"
          onClick={submit}
          disabled={!dirty || save.isPending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: dirty ? "var(--aurora)" : "rgba(255,255,255,0.06)",
            color: dirty ? "#0a0a0f" : "var(--text-3)",
            fontSize: 12,
            fontWeight: 600,
            cursor: dirty && !save.isPending ? "pointer" : "not-allowed",
          }}
        >
          {save.isPending ? (
            <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
          ) : (
            <Check size={12} />
          )}
          Guardar cambios
        </button>
      }
    >
      {tenantQuery.isLoading ? (
        <div style={{ padding: 24, color: "var(--text-2)", fontSize: 13 }}>
          <Loader2 size={14} style={{ animation: "spin 900ms linear infinite", verticalAlign: "middle" }} />{" "}
          Cargando…
        </div>
      ) : (
        <form onSubmit={submit} className="glass" style={{ ...cardStyle, padding: 18 }}>
          {/* Header con ícono */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 18,
              paddingBottom: 14,
              borderBottom: "1px solid var(--hair)",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: "var(--aurora-soft, rgba(109,59,255,0.18))",
                color: "var(--z-cyan)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Building2 size={15} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                Información del negocio
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                Esta información va al system prompt del bot y se actualiza al instante.
              </div>
            </div>
          </div>

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
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}
          {saved && (
            <div
              role="status"
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid oklch(0.78 0.15 155 / 0.4)",
                background: "oklch(0.78 0.15 155 / 0.10)",
                color: "var(--z-green)",
                fontSize: 12,
                marginBottom: 14,
              }}
            >
              Cambios guardados ✓
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field
              label="Nombre del negocio"
              value={name}
              onChange={setName}
              placeholder="Aurora Bazar"
              required
              hint="Cómo se presenta el bot al cliente."
            />

            <Field
              label="Descripción"
              value={description}
              onChange={setDescription}
              placeholder="Breve descripción de qué hace el negocio, su tono, qué vende, qué no atiende. Esta información alimenta el contexto del agente."
              multiline
              hint="Tip: 2-3 oraciones concretas mejoran muchísimo las respuestas del bot."
            />

            <div className="business-grid-2">
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
              hint="Útil cuando el bot tiene que escalar al humano."
            />
          </div>

          {/* Botón Guardar duplicado al final del form — en mobile el del
              header queda lejos cuando el form se hace largo, y un cliente
              que terminó de tipear no debería volver al top para guardar. */}
          <div className="business-save-foot">
            <button
              type="submit"
              disabled={!dirty || save.isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "11px 18px",
                borderRadius: 6,
                border: "none",
                background: dirty ? "var(--aurora)" : "rgba(255,255,255,0.06)",
                color: dirty ? "#0a0a0f" : "var(--text-3)",
                fontSize: 13,
                fontWeight: 600,
                cursor: dirty && !save.isPending ? "pointer" : "not-allowed",
                width: "100%",
                justifyContent: "center",
              }}
            >
              {save.isPending ? (
                <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
              ) : (
                <Check size={13} />
              )}
              Guardar cambios
            </button>
          </div>
        </form>
      )}

      <style jsx global>{`
        .business-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .business-save-foot {
          display: none;
        }
        /* Mobile: input a 16px (evita zoom de iOS al focusear), grid a una
           columna, botón Guardar duplicado abajo full-width. */
        @media (max-width: 640px) {
          .business-grid-2 { grid-template-columns: 1fr; }
          .business-save-foot {
            display: block;
            margin-top: 18px;
            padding-top: 14px;
            border-top: 1px solid var(--hair);
          }
          .business-input { font-size: 16px !important; }
        }
      `}</style>
    </PageShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  multiline,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  hint?: string;
}) {
  const inputStyle: React.CSSProperties = {
    padding: "10px 12px",
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
          fontSize: 10.5,
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
          className="business-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          style={inputStyle}
        />
      ) : (
        <input
          className="business-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={inputStyle}
        />
      )}
      {hint && (
        <span style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.4 }}>
          {hint}
        </span>
      )}
    </label>
  );
}
