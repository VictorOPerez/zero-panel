"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  listContacts,
  updateStage,
  importCsv,
  type Contact,
  type ContactStage,
} from "@/lib/api/crm";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import { ContactDetailModal } from "./contact-detail-modal";

const STAGES: Array<{ key: ContactStage; label: string; color: string }> = [
  { key: "lead", label: "Leads", color: "oklch(0.78 0.10 240)" },
  { key: "opportunity", label: "Oportunidades", color: "oklch(0.80 0.14 75)" },
  { key: "customer", label: "Clientes", color: "oklch(0.78 0.15 155)" },
  { key: "inactive", label: "Inactivos", color: "oklch(0.65 0.04 270)" },
  { key: "lost", label: "Perdidos", color: "oklch(0.68 0.21 25)" },
];

export function CrmView() {
  return (
    <RequireTenant>
      {(tenantId) => <CrmInner tenantId={tenantId} />}
    </RequireTenant>
  );
}

function CrmInner({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const query = useQuery({
    queryKey: ["crm-contacts", tenantId, search],
    queryFn: () =>
      listContacts(tenantId, {
        search: search.trim() || undefined,
        limit: 200,
      }),
    refetchInterval: 30_000,
  });

  const moveStage = useMutation({
    mutationFn: ({ contactId, stage }: { contactId: string; stage: ContactStage }) =>
      updateStage(tenantId, contactId, { stage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-contacts", tenantId] });
    },
  });

  const grouped = useMemo(() => {
    const map: Record<ContactStage, Contact[]> = {
      lead: [],
      opportunity: [],
      customer: [],
      inactive: [],
      lost: [],
    };
    for (const c of query.data?.contacts ?? []) {
      map[c.stage].push(c);
    }
    return map;
  }, [query.data]);

  return (
    <PageShell
      title="Contactos"
      subtitle="El bot conoce a tus clientes en cada conversación. Arrastrá tarjetas entre columnas para moverlos en el pipeline."
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowImport(true)}
            style={ghostButton}
          >
            <Upload size={13} /> Importar CSV
          </button>
        </div>
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
          placeholder="Buscar por nombre, teléfono o email…"
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
            {query.data.total} contactos
          </span>
        )}
      </div>

      {query.isLoading && (
        <div style={{ ...cardStyle, textAlign: "center", color: "var(--text-2)" }}>
          <Loader2 size={14} style={{ animation: "spin 900ms linear infinite", marginRight: 6 }} />
          Cargando contactos…
        </div>
      )}

      {query.data && query.data.total === 0 && (
        <div className="glass" style={{ ...cardStyle, textAlign: "center", padding: 32 }}>
          <Users size={28} style={{ color: "var(--text-3)", marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
            Sin contactos todavía
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 14 }}>
            El bot va a crear contactos automáticamente cuando charle con clientes.
            <br />También podés importar tu lista actual desde un CSV.
          </div>
          <button
            type="button"
            onClick={() => setShowImport(true)}
            style={primaryButton}
          >
            <Upload size={12} /> Importar CSV
          </button>
        </div>
      )}

      {query.data && query.data.total > 0 && (
        <div className="crm-board">
          {STAGES.map((stage) => (
            <StageColumn
              key={stage.key}
              label={stage.label}
              color={stage.color}
              contacts={grouped[stage.key]}
              onDrop={(contactId) => moveStage.mutate({ contactId, stage: stage.key })}
              onOpen={(c) => setOpenContactId(c.id)}
            />
          ))}
        </div>
      )}

      {openContactId && (
        <ContactDetailModal
          tenantId={tenantId}
          contactId={openContactId}
          onClose={() => setOpenContactId(null)}
        />
      )}

      {showImport && (
        <ImportCsvModal tenantId={tenantId} onClose={() => setShowImport(false)} />
      )}

      <style jsx>{`
        .crm-board {
          display: grid;
          grid-template-columns: repeat(5, minmax(220px, 1fr));
          gap: 12px;
          overflow-x: auto;
        }
        @media (max-width: 1100px) {
          .crm-board {
            grid-template-columns: repeat(3, minmax(220px, 1fr));
          }
        }
        @media (max-width: 700px) {
          .crm-board {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

function StageColumn({
  label,
  color,
  contacts,
  onDrop,
  onOpen,
}: {
  label: string;
  color: string;
  contacts: Contact[];
  onDrop: (contactId: string) => void;
  onOpen: (c: Contact) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDrop(id);
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 8,
        borderRadius: 10,
        background: dragOver
          ? "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.015)",
        border: dragOver ? "1px dashed var(--hair-strong)" : "1px solid var(--hair)",
        minHeight: 280,
        transition: "background 120ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 6px 8px",
          borderBottom: "1px solid var(--hair)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: color,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-3)" }}>
          {contacts.length}
        </span>
      </div>
      {contacts.map((c) => (
        <ContactCard key={c.id} contact={c} onOpen={onOpen} />
      ))}
    </div>
  );
}

function ContactCard({
  contact,
  onOpen,
}: {
  contact: Contact;
  onOpen: (c: Contact) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", contact.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(contact)}
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--hair)",
        cursor: "grab",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {contact.name?.trim() || "Sin nombre"}
        </span>
        <ChevronRight size={12} style={{ color: "var(--text-3)" }} />
      </div>
      <span
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          fontFamily: "var(--font-jetbrains-mono)",
        }}
      >
        {contact.phone}
      </span>
      {contact.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
          {contact.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 10,
                background: "rgba(255,255,255,0.06)",
                color: "var(--text-2)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {(contact.total_bookings > 0 || contact.total_paid_cents > 0) && (
        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
          {contact.total_bookings > 0 && `${contact.total_bookings} reservas`}
          {contact.total_bookings > 0 && contact.total_paid_cents > 0 && " · "}
          {contact.total_paid_cents > 0 &&
            `$${(contact.total_paid_cents / 100).toLocaleString()}`}
        </div>
      )}
    </div>
  );
}

function ImportCsvModal({
  tenantId,
  onClose,
}: {
  tenantId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const mutation = useMutation({
    mutationFn: () => importCsv(tenantId, csv),
    onSuccess: (res) => {
      setResult({ imported: res.imported, skipped: res.skipped });
      qc.invalidateQueries({ queryKey: ["crm-contacts", tenantId] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos procesar el CSV."
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
          maxWidth: 560,
          width: "100%",
          padding: 24,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Importar contactos</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-2)",
            }}
          >
            <X size={16} />
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
          Pegá tu CSV. Columnas reconocidas (la primera fila es el header):{" "}
          <code style={{ fontSize: 11 }}>phone</code>,{" "}
          <code style={{ fontSize: 11 }}>name</code>,{" "}
          <code style={{ fontSize: 11 }}>email</code>,{" "}
          <code style={{ fontSize: 11 }}>stage</code>,{" "}
          <code style={{ fontSize: 11 }}>tags</code> (separados por |),{" "}
          <code style={{ fontSize: 11 }}>notes</code>.
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={`phone,name,email,stage,tags\n+5491111111111,Juan Perez,juan@test.com,customer,vip|tarde\n5492222222222,Maria,,lead,`}
          rows={10}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid var(--hair-strong)",
            background: "rgba(0,0,0,0.3)",
            color: "var(--text-1)",
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 11.5,
            resize: "vertical",
          }}
        />
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
        {result && (
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid oklch(0.78 0.15 155 / 0.4)",
              background: "oklch(0.78 0.15 155 / 0.08)",
              color: "var(--z-green)",
              fontSize: 12,
            }}
          >
            ✓ Importados: {result.imported} · Omitidos: {result.skipped}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={ghostButton}>
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setResult(null);
              mutation.mutate();
            }}
            disabled={!csv.trim() || mutation.isPending}
            style={primaryButton}
          >
            {mutation.isPending ? (
              <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <Plus size={12} />
            )}
            Importar
          </button>
        </div>
      </div>
    </div>
  );
}

const ghostButton: React.CSSProperties = {
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
