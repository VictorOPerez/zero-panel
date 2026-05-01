"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check, Loader2 } from "lucide-react";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import { WhatsappYCloudCard } from "@/components/channels/whatsapp-ycloud-card";
import { getTenant, patchTenant } from "@/lib/api/tenants";
import type { TenantBusiness } from "@/lib/api/contract";

export function IntegrationsView() {
  return (
    <RequireTenant>
      {(tenantId) => (
        <PageShell
          title="Inicio"
          subtitle="Lo básico para que el bot empiece a operar."
        >
          <BusinessQuickEdit tenantId={tenantId} />

          <SectionLabel>Conexiones</SectionLabel>
          <div
            className="grid-integrations"
            style={{ marginBottom: 12 }}
            role="list"
            aria-label="Canales"
          >
            <WhatsappYCloudCard tenantId={tenantId} />
          </div>

          <div className="grid-integrations">
            <Link
              href="/calendar"
              className="glass"
              style={{
                padding: 16,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
                textDecoration: "none",
                color: "var(--text-0)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--hair)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-2)",
                }}
              >
                <Calendar size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Google Calendar</div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Agendamiento
                </div>
              </div>
            </Link>
          </div>
        </PageShell>
      )}
    </RequireTenant>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        fontWeight: 600,
        marginBottom: 8,
        marginTop: 18,
      }}
    >
      {children}
    </div>
  );
}

function BusinessQuickEdit({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const tenantQuery = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => getTenant(tenantId).then((r) => r.tenant),
  });
  const initial: TenantBusiness | undefined = tenantQuery.data?.business;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [savedField, setSavedField] = useState<"name" | "description" | null>(null);

  useEffect(() => {
    if (!initial) return;
    setName(initial.name ?? "");
    setDescription(initial.description ?? "");
  }, [initial]);

  const save = useMutation({
    mutationFn: (next: { name: string; description: string }) =>
      patchTenant(tenantId, {
        business: {
          name: next.name.trim(),
          description: next.description.trim(),
          owner: initial?.owner ?? "",
          type: initial?.type ?? "",
          location: initial?.location ?? "",
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
      window.setTimeout(() => setSavedField(null), 1500);
    },
  });

  const flushIfChanged = (field: "name" | "description") => {
    if (!initial) return;
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    const dirty =
      trimmedName !== (initial.name ?? "").trim() ||
      trimmedDesc !== (initial.description ?? "").trim();
    if (!dirty) return;
    if (field === "name" && !trimmedName) {
      // No permitimos borrar el nombre — el bot lo necesita para presentarse.
      setName(initial.name ?? "");
      return;
    }
    setSavedField(field);
    save.mutate({ name: trimmedName, description: trimmedDesc });
  };

  return (
    <section className="glass" style={{ ...cardStyle, padding: 16, marginBottom: 18 }}>
      <SectionLabel>Tu negocio</SectionLabel>

      {tenantQuery.isLoading ? (
        <div style={{ padding: 8, color: "var(--text-2)", fontSize: 13 }}>
          <Loader2
            size={13}
            style={{ animation: "spin 900ms linear infinite", verticalAlign: "middle" }}
          />{" "}
          Cargando…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <InlineField
            label="Nombre"
            value={name}
            onChange={setName}
            onBlur={() => flushIfChanged("name")}
            placeholder="Aurora Bazar"
            saving={save.isPending && savedField === "name"}
            saved={!save.isPending && savedField === "name"}
          />
          <InlineField
            label="Descripción"
            value={description}
            onChange={setDescription}
            onBlur={() => flushIfChanged("description")}
            placeholder="Qué hace el negocio, en 2-3 oraciones. El bot lo usa de contexto."
            multiline
            saving={save.isPending && savedField === "description"}
            saved={!save.isPending && savedField === "description"}
          />
          <Link
            href="/business"
            style={{
              fontSize: 11.5,
              color: "var(--text-3)",
              textDecoration: "none",
              alignSelf: "flex-start",
            }}
          >
            Editar más detalles →
          </Link>
        </div>
      )}
    </section>
  );
}

function InlineField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  multiline,
  saving,
  saved,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder?: string;
  multiline?: boolean;
  saving?: boolean;
  saved?: boolean;
}) {
  const inputStyle: React.CSSProperties = {
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
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10.5,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 600,
        }}
      >
        {label}
        {saving && (
          <Loader2 size={10} style={{ animation: "spin 900ms linear infinite" }} />
        )}
        {saved && !saving && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              color: "var(--z-green)",
              textTransform: "none",
              letterSpacing: 0,
              fontWeight: 500,
              fontSize: 10.5,
            }}
          >
            <Check size={10} /> Guardado
          </span>
        )}
      </span>
      {multiline ? (
        <textarea
          className="business-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={3}
          style={inputStyle}
        />
      ) : (
        <input
          className="business-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          style={inputStyle}
        />
      )}
    </label>
  );
}
