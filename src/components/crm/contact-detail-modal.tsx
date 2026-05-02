"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import {
  addNote,
  addTag,
  deleteContact,
  deleteNote,
  getContact,
  removeTag,
  type ContactStage,
} from "@/lib/api/crm";
import { ApiError } from "@/lib/api/client";

const STAGES: ContactStage[] = [
  "lead",
  "opportunity",
  "customer",
  "inactive",
  "lost",
];

export function ContactDetailModal({
  tenantId,
  contactId,
  onClose,
}: {
  tenantId: string;
  contactId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["crm-contact", tenantId, contactId],
    queryFn: () => getContact(tenantId, contactId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crm-contact", tenantId, contactId] });
    qc.invalidateQueries({ queryKey: ["crm-contacts", tenantId] });
  };

  const noteMutation = useMutation({
    mutationFn: () => addNote(tenantId, contactId, newNote.trim()),
    onSuccess: () => {
      setNewNote("");
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.payload.error : "No pudimos guardar la nota."),
  });

  const noteDelete = useMutation({
    mutationFn: (noteId: string) => deleteNote(tenantId, contactId, noteId),
    onSuccess: invalidate,
  });

  const tagMutation = useMutation({
    mutationFn: () => addTag(tenantId, contactId, newTag.trim()),
    onSuccess: () => {
      setNewTag("");
      invalidate();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "Tag inválido (lowercase, máx 30 chars)."
      ),
  });

  const tagDelete = useMutation({
    mutationFn: (tag: string) => removeTag(tenantId, contactId, tag),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => deleteContact(tenantId, contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-contacts", tenantId] });
      onClose();
    },
  });

  const c = detail.data?.contact;

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
          maxWidth: 600,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: 24,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            {c?.name?.trim() || "Sin nombre"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-2)" }}
          >
            <X size={16} />
          </button>
        </div>

        {detail.isLoading && (
          <div style={{ textAlign: "center", padding: 24, color: "var(--text-2)" }}>
            <Loader2 size={14} style={{ animation: "spin 900ms linear infinite" }} />
          </div>
        )}

        {c && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
              <KV label="Teléfono" value={c.phone} mono />
              <KV label="Email" value={c.email ?? "—"} />
              <KV label="Reservas" value={String(c.total_bookings)} />
              <KV label="Pagado" value={`$${(c.total_paid_cents / 100).toLocaleString()}`} />
              <KV
                label="Primer contacto"
                value={new Date(c.first_seen_at).toLocaleDateString()}
              />
              <KV
                label="Último contacto"
                value={
                  c.last_contacted_at
                    ? new Date(c.last_contacted_at).toLocaleDateString()
                    : "—"
                }
              />
            </div>

            <div>
              <Label>Etapa</Label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {STAGES.map((stage) => (
                  <StageButton
                    key={stage}
                    stage={stage}
                    active={c.stage === stage}
                    onClick={() => {
                      // Reusamos updateStage del listing. El detail refresca al invalidar.
                      qc.fetchQuery({
                        queryKey: ["dummy"],
                        queryFn: async () => {
                          const { updateStage } = await import("@/lib/api/crm");
                          await updateStage(tenantId, contactId, { stage });
                          invalidate();
                          return null;
                        },
                      });
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Tags</Label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                {c.tags.length === 0 && (
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>Sin tags</span>
                )}
                {c.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      background: "rgba(255,255,255,0.06)",
                      color: "var(--text-1)",
                    }}
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => tagDelete.mutate(t)}
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-3)" }}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="vip, vegetariano…"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => tagMutation.mutate()}
                  disabled={!newTag.trim() || tagMutation.isPending}
                  style={primaryButton}
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            <div>
              <Label>Notas ({detail.data?.notes.length ?? 0})</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                {detail.data?.notes.length === 0 && (
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>Sin notas</span>
                )}
                {detail.data?.notes.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--hair)",
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        background: n.author === "bot" ? "oklch(0.78 0.10 240 / 0.20)" : "oklch(0.80 0.14 75 / 0.20)",
                        color: n.author === "bot" ? "oklch(0.78 0.10 240)" : "oklch(0.80 0.14 75)",
                        flexShrink: 0,
                      }}
                    >
                      {n.author}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--text-1)", lineHeight: 1.4 }}>
                        {n.text}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => noteDelete.mutate(n.id)}
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-3)" }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Hecho útil para futuras conversaciones…"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => noteMutation.mutate()}
                  disabled={!newNote.trim() || noteMutation.isPending}
                  style={primaryButton}
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

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

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <button
                type="button"
                onClick={() => {
                  if (confirm("¿Eliminar este contacto? Solo se borra del CRM, las conversaciones quedan.")) {
                    remove.mutate();
                  }
                }}
                style={dangerButton}
              >
                <Trash2 size={12} /> Eliminar contacto
              </button>
              <button type="button" onClick={onClose} style={ghostButton}>
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 2 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-1)",
          fontFamily: mono ? "var(--font-jetbrains-mono)" : undefined,
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        fontWeight: 600,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function StageButton({
  stage,
  active,
  onClick,
}: {
  stage: ContactStage;
  active: boolean;
  onClick: () => void;
}) {
  const labels: Record<ContactStage, string> = {
    lead: "Lead",
    opportunity: "Oportunidad",
    customer: "Cliente",
    inactive: "Inactivo",
    lost: "Perdido",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 10px",
        borderRadius: 5,
        border: active ? "1px solid var(--text-1)" : "1px solid var(--hair-strong)",
        background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
        color: active ? "var(--text-0)" : "var(--text-1)",
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
      }}
    >
      {labels[stage]}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 10px",
  borderRadius: 5,
  border: "1px solid var(--hair-strong)",
  background: "rgba(0,0,0,0.3)",
  color: "var(--text-1)",
  fontSize: 12,
  outline: "none",
};

const primaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 12px",
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
  padding: "6px 12px",
  borderRadius: 5,
  border: "1px solid var(--hair-strong)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-1)",
  fontSize: 12,
  cursor: "pointer",
};

const dangerButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 12px",
  borderRadius: 5,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.08)",
  color: "var(--z-red)",
  fontSize: 12,
  cursor: "pointer",
};
