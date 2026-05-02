"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  FileText,
  Globe,
  Loader2,
  Plus,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  fileToBase64,
  ingestKnowledgePdf,
  ingestKnowledgeUrl,
  listKnowledgeDocuments,
} from "@/lib/api/knowledge";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import type {
  CreateKnowledgeDocumentResponse,
  KnowledgeDocument,
  KnowledgeDocumentType,
} from "@/lib/api/contract";

const MAX_TEXT_CONTENT = 1_000_000;
const MAX_PDF_BYTES = 20_000_000;

export function KnowledgeView() {
  return (
    <RequireTenant>
      {(tenantId) => <Knowledge tenantId={tenantId} />}
    </RequireTenant>
  );
}

type DraftMode = "text" | "url" | "pdf";

interface Draft {
  mode: DraftMode;
  title: string;
  // text mode
  content: string;
  // url mode
  url: string;
  // pdf mode
  pdfFile: File | null;
}

function emptyDraft(): Draft {
  return { mode: "text", title: "", content: "", url: "", pdfFile: null };
}

function Knowledge({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const query = useQuery({
    queryKey: ["knowledge-documents", tenantId],
    queryFn: () => listKnowledgeDocuments(tenantId),
  });

  function pushDocument(res: CreateKnowledgeDocumentResponse) {
    qc.setQueryData<KnowledgeDocument[] | undefined>(
      ["knowledge-documents", tenantId],
      (prev) => [res.document, ...(prev ?? [])]
    );
    setDraft(null);
    setError(null);
  }

  function showApiError(err: unknown, fallback: string) {
    setError(err instanceof ApiError ? err.payload.error : fallback);
  }

  const createTextMut = useMutation({
    mutationFn: (body: { title: string; content: string }) =>
      createKnowledgeDocument(tenantId, {
        type: "text",
        title: body.title,
        content: body.content,
      }),
    onSuccess: pushDocument,
    onError: (err) => showApiError(err, "No pudimos cargar el texto."),
  });

  const ingestUrlMut = useMutation({
    mutationFn: (body: { url: string; title?: string }) =>
      ingestKnowledgeUrl(tenantId, body),
    onSuccess: pushDocument,
    onError: (err) =>
      showApiError(err, "No pudimos extraer el contenido de la URL."),
  });

  const ingestPdfMut = useMutation({
    mutationFn: async (body: { title: string; file: File }) => {
      const content_base64 = await fileToBase64(body.file);
      return ingestKnowledgePdf(tenantId, {
        title: body.title,
        source: body.file.name,
        content_base64,
      });
    },
    onSuccess: pushDocument,
    onError: (err) =>
      showApiError(err, "No pudimos extraer el texto del PDF."),
  });

  const isPending =
    createTextMut.isPending ||
    ingestUrlMut.isPending ||
    ingestPdfMut.isPending;

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteKnowledgeDocument(tenantId, id),
    onSuccess: (_void, id) => {
      qc.setQueryData<KnowledgeDocument[] | undefined>(
        ["knowledge-documents", tenantId],
        (prev) => prev?.filter((d) => d.id !== id)
      );
      setError(null);
    },
    onError: (err) => showApiError(err, "No pudimos eliminar el documento."),
  });

  function submitDraft() {
    if (!draft) return;
    const title = draft.title.trim();

    if (draft.mode === "text") {
      const content = draft.content.trim();
      if (!title) return setError("Poné un título.");
      if (!content) return setError("Pegá el contenido.");
      if (content.length > MAX_TEXT_CONTENT)
        return setError("Texto demasiado grande (máx 1MB).");
      setError(null);
      createTextMut.mutate({ title, content });
      return;
    }

    if (draft.mode === "url") {
      const url = draft.url.trim();
      if (!url) return setError("Poné una URL.");
      try {
        const u = new URL(url);
        if (!/^https?:$/.test(u.protocol)) {
          return setError("La URL debe empezar con http o https.");
        }
      } catch {
        return setError("URL inválida.");
      }
      setError(null);
      ingestUrlMut.mutate({ url, title: title || undefined });
      return;
    }

    if (draft.mode === "pdf") {
      if (!title) return setError("Poné un título.");
      if (!draft.pdfFile) return setError("Subí un archivo PDF.");
      if (draft.pdfFile.size > MAX_PDF_BYTES)
        return setError(`PDF demasiado grande (máx ${MAX_PDF_BYTES / 1_000_000}MB).`);
      setError(null);
      ingestPdfMut.mutate({ title, file: draft.pdfFile });
      return;
    }
  }

  return (
    <PageShell
      title="Conocimiento"
      subtitle="Documentos del negocio que el bot puede consultar para responder preguntas precisas."
      actions={
        <button
          type="button"
          onClick={() => {
            if (draft) submitDraft();
            else setDraft(emptyDraft());
          }}
          disabled={isPending}
          style={primaryBtn}
        >
          {isPending ? (
            <Loader2
              size={13}
              style={{ animation: "spin 900ms linear infinite" }}
            />
          ) : (
            <Plus size={13} />
          )}
          {draft
            ? draft.mode === "url"
              ? "Extraer e indexar"
              : draft.mode === "pdf"
                ? "Subir e indexar"
                : "Guardar texto"
            : "Agregar documento"}
        </button>
      }
    >
      <Notice />

      {error && (
        <div role="alert" style={errorBox}>
          {error}
        </div>
      )}

      {draft && (
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
          <div style={sectionLabel}>Nuevo documento</div>

          {/* Tabs de modo */}
          <div
            style={{
              display: "flex",
              gap: 2,
              padding: 3,
              background: "rgba(0,0,0,0.25)",
              borderRadius: 8,
              border: "1px solid var(--hair)",
            }}
          >
            <ModeTab
              active={draft.mode === "text"}
              onClick={() => setDraft({ ...draft, mode: "text" })}
              icon={BookOpen}
              label="Texto"
            />
            <ModeTab
              active={draft.mode === "url"}
              onClick={() => setDraft({ ...draft, mode: "url" })}
              icon={Globe}
              label="URL"
            />
            <ModeTab
              active={draft.mode === "pdf"}
              onClick={() => setDraft({ ...draft, mode: "pdf" })}
              icon={FileText}
              label="PDF"
            />
          </div>

          {draft.mode === "text" && (
            <>
              <DraftField label="Título">
                <input
                  autoFocus
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="Ej: FAQ atención al cliente"
                  maxLength={200}
                  style={inputStyle}
                />
              </DraftField>
              <DraftField label="Contenido">
                <textarea
                  value={draft.content}
                  onChange={(e) =>
                    setDraft({ ...draft, content: e.target.value })
                  }
                  placeholder="Pegá acá la información que querés que el bot pueda consultar."
                  rows={10}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    lineHeight: 1.5,
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 12,
                  }}
                />
                <span style={hintStyle}>
                  {draft.content.length.toLocaleString()} caracteres
                  {draft.content.length > MAX_TEXT_CONTENT && " — excede el máximo"}
                </span>
              </DraftField>
            </>
          )}

          {draft.mode === "url" && (
            <>
              <DraftField label="URL">
                <input
                  autoFocus
                  type="url"
                  value={draft.url}
                  onChange={(e) =>
                    setDraft({ ...draft, url: e.target.value })
                  }
                  placeholder="https://misitio.com/faq"
                  style={inputStyle}
                />
              </DraftField>
              <DraftField label="Título (opcional, si no usamos el de la página)">
                <input
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="Ej: FAQ del sitio"
                  maxLength={200}
                  style={inputStyle}
                />
              </DraftField>
              <span style={hintStyle}>
                Vamos a hacer fetch de la URL y extraer el texto. Funciona mejor
                con páginas estáticas (FAQ, política, landing). Sitios SPA con
                contenido renderizado en JS pueden no traer texto.
              </span>
            </>
          )}

          {draft.mode === "pdf" && (
            <>
              <DraftField label="Título">
                <input
                  autoFocus
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="Ej: Manual de servicios 2026"
                  maxLength={200}
                  style={inputStyle}
                />
              </DraftField>
              <DraftField label="Archivo PDF">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      pdfFile: e.target.files?.[0] ?? null,
                    })
                  }
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    ...inputStyle,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <Upload size={14} />
                  {draft.pdfFile
                    ? `${draft.pdfFile.name} (${(draft.pdfFile.size / 1024).toFixed(1)} KB)`
                    : "Seleccionar PDF…"}
                </button>
              </DraftField>
              <span style={hintStyle}>
                Hasta 20MB. PDFs escaneados sin OCR no van a tener texto extraible.
              </span>
            </>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
              style={backBtn}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {query.isLoading && <Loading />}

      {!query.isLoading && (query.data?.length ?? 0) === 0 && !draft && (
        <EmptyState onAdd={() => setDraft(emptyDraft())} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {query.data?.map((doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            onDelete={() => {
              if (
                confirm(
                  `¿Eliminar "${doc.title}"? Los chunks indexados se borran también.`
                )
              ) {
                deleteMut.mutate(doc.id);
              }
            }}
            deleting={deleteMut.isPending && deleteMut.variables === doc.id}
          />
        ))}
      </div>
    </PageShell>
  );
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Globe;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "7px 8px",
        borderRadius: 6,
        border: "none",
        background: active
          ? "linear-gradient(90deg, oklch(0.62 0.22 295 / 0.18), transparent)"
          : "transparent",
        color: active ? "var(--text-0)" : "var(--text-2)",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
      }}
    >
      <Icon
        size={13}
        style={{ color: active ? "var(--z-cyan)" : "var(--text-3)" }}
      />
      {label}
    </button>
  );
}

function DocumentRow({
  doc,
  onDelete,
  deleting,
}: {
  doc: KnowledgeDocument;
  onDelete: () => void;
  deleting: boolean;
}) {
  const Icon =
    doc.type === "pdf" ? FileText : doc.type === "url" ? Globe : BookOpen;

  return (
    <div
      className="glass"
      style={{
        ...cardStyle,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        opacity: doc.status === "ready" ? 1 : 0.7,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "rgba(255,255,255,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={15} style={{ color: "var(--text-1)" }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 3,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-0)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {doc.title}
          </span>
          <StatusBadge status={doc.status} />
        </div>

        {doc.source && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              fontFamily: "var(--font-jetbrains-mono)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: 3,
            }}
          >
            {doc.source}
          </div>
        )}

        {doc.content_preview && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-2)",
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {doc.content_preview}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 6,
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--font-jetbrains-mono)",
          }}
        >
          <span>{doc.chunk_count} chunks</span>
          <span>{doc.type}</span>
          {doc.created_at && (
            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
          )}
        </div>

        {doc.status === "error" && doc.error && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "var(--z-red)",
              fontFamily: "var(--font-jetbrains-mono)",
            }}
          >
            {doc.error}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label={`Eliminar ${doc.title}`}
        style={iconBtn}
      >
        {deleting ? (
          <Loader2
            size={13}
            style={{ animation: "spin 900ms linear infinite" }}
          />
        ) : (
          <Trash2 size={13} />
        )}
      </button>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: KnowledgeDocument["status"];
}) {
  if (status === "ready") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10,
          color: "var(--z-green, #4ade80)",
          fontWeight: 600,
        }}
      >
        <CheckCircle2 size={11} />
        Listo
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10,
          color: "var(--z-red)",
          fontWeight: 600,
        }}
      >
        <XCircle size={11} />
        Error
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        color: "var(--text-3)",
        fontWeight: 600,
      }}
    >
      <Loader2 size={11} style={{ animation: "spin 900ms linear infinite" }} />
      Procesando
    </span>
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
        Sin documentos cargados
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-2)",
          maxWidth: 460,
          lineHeight: 1.5,
        }}
      >
        Cargá la información del negocio (FAQ, política de cancelación,
        descuentos, requisitos…) para que el bot pueda responder preguntas
        específicas sin inventar.
      </div>
      <button type="button" onClick={onAdd} style={primaryBtn}>
        <Plus size={13} />
        Agregar primer documento
      </button>
    </div>
  );
}

function Notice() {
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
      <BookOpen
        size={16}
        style={{ color: "var(--z-cyan)", flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--text-0)" }}>RAG por tenant.</strong>
        <div style={{ marginTop: 3, color: "var(--text-2)" }}>
          Los documentos se chunkean y se indexan con embeddings. Cuando un
          cliente pregunta algo, el bot busca los chunks relevantes y arma la
          respuesta con esos hechos. Podés cargar texto directo, una URL del
          sitio del negocio, o un PDF — Zero extrae el contenido y lo indexa.
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div
      style={{
        padding: 24,
        textAlign: "center",
        color: "var(--text-3)",
        fontSize: 13,
      }}
    >
      Cargando documentos…
    </div>
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
      <span style={fieldLabel}>{label}</span>
      {children}
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

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  color: "var(--text-3)",
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  fontWeight: 600,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 10,
  color: "var(--text-3)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  fontWeight: 600,
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-3)",
  marginTop: 3,
  lineHeight: 1.4,
};

const errorBox: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.08)",
  color: "var(--z-red)",
  fontSize: 12.5,
  marginBottom: 14,
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

const iconBtn: React.CSSProperties = {
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
};
