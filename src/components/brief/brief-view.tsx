"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenText,
  MessageSquareText,
  Pencil,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import {
  BRIEF_MAX_LENGTH,
  getTenantBrief,
  updateTenantBrief,
} from "@/lib/api/brief";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";

export function BriefView() {
  return (
    <RequireTenant>{(tenantId) => <Brief tenantId={tenantId} />}</RequireTenant>
  );
}

function Brief({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["tenant-brief", tenantId],
    queryFn: () => getTenantBrief(tenantId),
    // No refrescar mientras se edita: pisaría lo que el usuario está escribiendo.
    refetchInterval: editing ? false : 15_000,
  });

  const mutation = useMutation({
    mutationFn: (content: string) => updateTenantBrief(tenantId, content),
    onSuccess: (saved) => {
      queryClient.setQueryData(["tenant-brief", tenantId], saved);
      queryClient.invalidateQueries({ queryKey: ["tenant-brief", tenantId] });
      setEditing(false);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    },
  });

  const brief = query.data;
  const hasContent = !!brief?.content.trim();

  function startEditing() {
    setDraft(brief?.content ?? "");
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError(null);
    setDraft("");
  }

  const tooLong = draft.length > BRIEF_MAX_LENGTH;

  return (
    <PageShell
      title="Personalidad del bot"
      subtitle="La identidad, el tono y el contexto que usa tu bot para responder. Es la fuente única de verdad: editala acá o por WhatsApp."
    >
      <EditViaWaNotice />

      {query.isLoading && <div style={loadingStyle}>Cargando…</div>}

      {!query.isLoading && editing && (
        <div
          className="glass"
          style={{ ...cardStyle, border: "1px solid var(--hair)" }}
        >
          <div style={metaRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Pencil size={14} style={{ color: "var(--z-cyan)" }} />
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--text-0)",
                }}
              >
                Editando personalidad
              </span>
            </div>
            <span style={{ ...mutedSmall, color: tooLong ? "#ff6b6b" : undefined }}>
              {draft.length}/{BRIEF_MAX_LENGTH}
            </span>
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Quién es el bot, qué hace el negocio, su tono, horarios, qué decir y qué no, FAQs, políticas…"
            spellCheck={false}
            style={textareaStyle}
            autoFocus
          />

          {error && <div style={errorStyle}>{error}</div>}

          <div style={actionRow}>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={mutation.isPending}
              style={secondaryBtn}
            >
              <X size={13} /> Cancelar
            </button>
            <button
              type="button"
              onClick={() => mutation.mutate(draft.trim())}
              disabled={mutation.isPending || tooLong}
              style={{
                ...primaryBtn,
                opacity: mutation.isPending || tooLong ? 0.6 : 1,
                cursor:
                  mutation.isPending || tooLong ? "not-allowed" : "pointer",
              }}
            >
              <Save size={13} />
              {mutation.isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {!query.isLoading && !editing && !hasContent && (
        <EmptyState onCreate={startEditing} />
      )}

      {!query.isLoading && !editing && hasContent && brief && (
        <div
          className="glass"
          style={{ ...cardStyle, border: "1px solid var(--hair)" }}
        >
          <div style={metaRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpenText size={14} style={{ color: "var(--z-cyan)" }} />
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--text-0)",
                }}
              >
                Personalidad vigente
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={chipStyle}>v{brief.version}</span>
              <span style={mutedSmall}>{brief.content.length} chars</span>
              {brief.updated_at && (
                <span style={mutedSmall}>
                  · {formatRelative(brief.updated_at)}
                </span>
              )}
              <button type="button" onClick={startEditing} style={editBtn}>
                <Pencil size={12} /> Editar
              </button>
            </div>
          </div>

          <pre style={contentStyle}>{brief.content}</pre>
        </div>
      )}
    </PageShell>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
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
        gap: 12,
        textAlign: "center",
      }}
    >
      <Sparkles size={20} style={{ color: "var(--z-cyan)" }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>
        Todavía no definiste la personalidad del bot
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-2)",
          maxWidth: 460,
          lineHeight: 1.55,
        }}
      >
        Es <strong>quién es tu bot y cómo responde</strong>: identidad, tono,
        descripción del negocio, horarios, FAQs, políticas, qué decir y qué no.
        Escribila acá, o hablale al bot por WhatsApp desde tu número admin y
        decile <em>&quot;configurá mi negocio&quot;</em> — te va guiando.
      </div>
      <button type="button" onClick={onCreate} style={primaryBtn}>
        <Pencil size={13} /> Escribir personalidad
      </button>
    </div>
  );
}

function EditViaWaNotice() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid oklch(0.80 0.13 200 / 0.25)",
        background: "oklch(0.80 0.13 200 / 0.06)",
        marginBottom: 14,
      }}
    >
      <MessageSquareText
        size={16}
        style={{ color: "var(--z-cyan)", flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.55 }}>
        <strong style={{ color: "var(--text-0)" }}>
          Una sola personalidad, dos formas de editarla.
        </strong>
        <div style={{ marginTop: 3, color: "var(--text-2)" }}>
          Editá el texto acá, o hablale al bot por WhatsApp desde tu número admin
          (<em>&quot;cambiá los horarios&quot;</em>,{" "}
          <em>&quot;agregá esta FAQ&quot;</em>). Los dos lados modifican lo mismo
          y el cambio aplica al instante, sin reiniciar nada.
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60_000);
    if (mins < 1) return "recién";
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.round(hours / 24);
    if (days < 30) return `hace ${days} d`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

const metaRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingBottom: 12,
  marginBottom: 14,
  borderBottom: "1px solid var(--hair)",
  flexWrap: "wrap",
  gap: 8,
};

const chipStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "var(--font-jetbrains-mono)",
  fontWeight: 700,
  letterSpacing: "0.08em",
  padding: "3px 8px",
  borderRadius: 4,
  background: "oklch(0.80 0.13 200 / 0.10)",
  color: "var(--z-cyan)",
  border: "1px solid oklch(0.80 0.13 200 / 0.4)",
  textTransform: "uppercase",
};

const mutedSmall: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-3)",
};

const contentStyle: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 12.5,
  color: "var(--text-1)",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  margin: 0,
  padding: 0,
  background: "transparent",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 320,
  resize: "vertical",
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "var(--text-0)",
  background: "rgba(255,255,255,0.02)",
  border: "1px solid var(--hair)",
  borderRadius: 8,
  padding: "12px 14px",
  outline: "none",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 14,
};

const baseBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12.5,
  fontWeight: 600,
  padding: "8px 14px",
  borderRadius: 7,
  cursor: "pointer",
  border: "1px solid var(--hair)",
};

const primaryBtn: React.CSSProperties = {
  ...baseBtn,
  background: "var(--z-cyan)",
  color: "#04141a",
  border: "1px solid var(--z-cyan)",
};

const secondaryBtn: React.CSSProperties = {
  ...baseBtn,
  background: "transparent",
  color: "var(--text-1)",
};

const editBtn: React.CSSProperties = {
  ...baseBtn,
  padding: "5px 10px",
  fontSize: 11.5,
  background: "transparent",
  color: "var(--z-cyan)",
  borderColor: "oklch(0.80 0.13 200 / 0.4)",
};

const errorStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  color: "#ff6b6b",
};

const loadingStyle: React.CSSProperties = {
  padding: 24,
  textAlign: "center",
  color: "var(--text-3)",
  fontSize: 13,
};
