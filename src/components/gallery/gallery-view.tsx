"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  deleteGalleryItem,
  listGalleryItems,
  updateGalleryItem,
  uploadGalleryItem,
  type GalleryItem,
} from "@/lib/api/gallery";
import { compressImageToBase64 } from "@/lib/api/conversations";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";

const MAX_FILE_BYTES = 12 * 1024 * 1024;

export function GalleryView() {
  return (
    <RequireTenant>
      {(tenantId) => <GalleryInner tenantId={tenantId} />}
    </RequireTenant>
  );
}

function GalleryInner({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["gallery", tenantId],
    queryFn: () => listGalleryItems(tenantId),
    refetchInterval: 60_000,
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => deleteGalleryItem(tenantId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gallery", tenantId] }),
  });

  const onPickFile = () => {
    setPickError(null);
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permitir re-elegir el mismo archivo
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPickError("Tiene que ser una imagen (JPEG, PNG o WebP).");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setPickError("La imagen supera los 12MB.");
      return;
    }
    setPendingFile(file);
  };

  const items = query.data?.items ?? [];
  const cloudinaryReady = query.data?.cloudinary_ready ?? true;

  return (
    <PageShell
      title="Galería"
      subtitle="Fotos de trabajos que el bot le muestra al cliente cuando pide ejemplos o referencias."
      actions={
        <button type="button" onClick={onPickFile} style={primaryButton}>
          <Plus size={13} /> Subir foto
        </button>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileSelected}
        style={{ display: "none" }}
      />

      {!cloudinaryReady && (
        <div
          className="glass"
          style={{
            ...cardStyle,
            marginBottom: 14,
            border: "1px solid oklch(0.80 0.14 75 / 0.3)",
            color: "var(--z-amber)",
            fontSize: 12.5,
          }}
        >
          El almacenamiento de imágenes todavía no está configurado en el
          servidor. Las fotos no se podrán subir hasta que se cargue Cloudinary.
        </div>
      )}

      {pickError && (
        <div style={{ color: "var(--z-red)", fontSize: 12, marginBottom: 12 }}>
          {pickError}
        </div>
      )}

      {query.isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 className="spin" size={20} style={{ color: "var(--text-2)" }} />
        </div>
      )}

      {query.isError && (
        <div style={{ color: "var(--z-red)", fontSize: 12.5 }}>
          No pudimos cargar la galería. Probá recargar.
        </div>
      )}

      {!query.isLoading && items.length === 0 && (
        <div
          className="glass"
          style={{
            ...cardStyle,
            textAlign: "center",
            padding: 40,
            color: "var(--text-2)",
          }}
        >
          <ImageIcon size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div style={{ fontSize: 13 }}>Todavía no hay fotos en la galería.</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
            Subí trabajos del negocio para que el bot los muestre como referencia.
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 12,
          }}
        >
          {items.map((item) => (
            <GalleryCard
              key={item.id}
              item={item}
              onEdit={() => setEditing(item)}
              onDelete={() => {
                if (confirm("¿Eliminar esta foto de la galería?")) {
                  remove.mutate(item.id);
                }
              }}
              deleting={remove.isPending && remove.variables === item.id}
            />
          ))}
        </div>
      )}

      {pendingFile && (
        <UploadModal
          tenantId={tenantId}
          file={pendingFile}
          onClose={() => setPendingFile(null)}
        />
      )}
      {editing && (
        <EditModal
          tenantId={tenantId}
          item={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </PageShell>
  );
}

function GalleryCard({
  item,
  onEdit,
  onDelete,
  deleting,
}: {
  item: GalleryItem;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const caption = item.note || item.service_name || item.description || "";
  return (
    <div
      className="glass"
      style={{ borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <a href={item.url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={caption || "Trabajo"}
          loading="lazy"
          style={{
            width: "100%",
            height: 150,
            objectFit: "cover",
            display: "block",
            background: "rgba(0,0,0,0.3)",
          }}
        />
      </a>
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div style={{ fontSize: 11.5, color: "var(--text-1)", lineHeight: 1.35, minHeight: 30 }}>
          {caption
            ? caption.length > 90
              ? `${caption.slice(0, 90)}…`
              : caption
            : <span style={{ color: "var(--text-3)" }}>Sin nota</span>}
        </div>
        {item.service_name && (
          <span
            style={{
              alignSelf: "flex-start",
              fontSize: 10,
              padding: "2px 7px",
              borderRadius: 99,
              background: "oklch(0.62 0.22 295 / 0.15)",
              color: "var(--z-purple)",
            }}
          >
            {item.service_name}
          </span>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
          <button type="button" onClick={onEdit} style={{ ...iconButton, flex: 1, justifyContent: "center" }}>
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            style={{ ...dangerButton, flex: 1, justifyContent: "center" }}
          >
            {deleting ? <Loader2 className="spin" size={12} /> : <Trash2 size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadModal({
  tenantId,
  file,
  onClose,
}: {
  tenantId: string;
  file: File;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [service, setService] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Object URL para la vista previa local; lo revocamos al desmontar.
  const [previewUrl] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const mutation = useMutation({
    mutationFn: async () => {
      // Comprimimos en el browser (las fotos del cel pesan mucho) y mandamos
      // base64 — mismo patrón que el envío de media en el inbox.
      const { base64, mime } = await compressImageToBase64(file).catch(() => ({
        base64: "",
        mime: file.type,
      }));
      if (!base64) throw new Error("No pudimos procesar la imagen.");
      return uploadGalleryItem(tenantId, {
        content_base64: base64,
        mime,
        note: note.trim() || null,
        service: service.trim() || null,
        tags: tags.trim() || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gallery", tenantId] });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.payload.error
          : err instanceof Error
            ? err.message
            : "No pudimos subir la foto."
      ),
  });

  return (
    <ModalShell title="Subir foto a la galería" onClose={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt="Vista previa"
        style={{
          width: "100%",
          maxHeight: 240,
          objectFit: "contain",
          borderRadius: 8,
          background: "rgba(0,0,0,0.3)",
          marginBottom: 12,
        }}
      />
      <Field label="Nota (lo que verá el cliente como descripción, opcional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej: Corte degradé con diseño"
          style={inputStyle}
        />
      </Field>
      <Field label="Servicio / categoría (opcional)">
        <input
          value={service}
          onChange={(e) => setService(e.target.value)}
          placeholder="Ej: Cortes"
          style={inputStyle}
        />
      </Field>
      <Field label="Tags para búsqueda, separados por coma (opcional)">
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Ej: degradé, fade, hombre"
          style={inputStyle}
        />
      </Field>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
        La descripción para que el bot entienda la foto se genera automáticamente
        con IA al subirla.
      </div>
      {error && (
        <div style={{ color: "var(--z-red)", fontSize: 12, marginTop: 10 }}>{error}</div>
      )}
      <ModalActions
        onClose={onClose}
        onConfirm={() => mutation.mutate()}
        confirmLabel="Subir"
        pending={mutation.isPending}
      />
    </ModalShell>
  );
}

function EditModal({
  tenantId,
  item,
  onClose,
}: {
  tenantId: string;
  item: GalleryItem;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState(item.note ?? "");
  const [service, setService] = useState(item.service_name ?? "");
  const [tags, setTags] = useState(item.tags ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      updateGalleryItem(tenantId, item.id, {
        note: note.trim() || null,
        service: service.trim() || null,
        tags: tags.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gallery", tenantId] });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.payload.error : "No pudimos guardar los cambios."
      ),
  });

  return (
    <ModalShell title="Editar foto" onClose={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt={item.note || "Trabajo"}
        style={{
          width: "100%",
          maxHeight: 200,
          objectFit: "contain",
          borderRadius: 8,
          background: "rgba(0,0,0,0.3)",
          marginBottom: 12,
        }}
      />
      <Field label="Nota">
        <input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Servicio / categoría">
        <input value={service} onChange={(e) => setService(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Tags (separados por coma)">
        <input value={tags} onChange={(e) => setTags(e.target.value)} style={inputStyle} />
      </Field>
      {error && (
        <div style={{ color: "var(--z-red)", fontSize: 12, marginTop: 10 }}>{error}</div>
      )}
      <ModalActions
        onClose={onClose}
        onConfirm={() => mutation.mutate()}
        confirmLabel="Guardar"
        pending={mutation.isPending}
      />
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
        className="glass"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 12,
          padding: 18,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-0)" }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ ...iconButton, padding: 6 }}
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ModalActions({
  onClose,
  onConfirm,
  confirmLabel,
  pending,
}: {
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  pending: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
      <button type="button" onClick={onClose} style={ghostButton} disabled={pending}>
        Cancelar
      </button>
      <button type="button" onClick={onConfirm} style={primaryButton} disabled={pending}>
        {pending ? <Loader2 className="spin" size={13} /> : null} {confirmLabel}
      </button>
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
