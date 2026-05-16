"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clock,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  createAdmin,
  listAdmins,
  regenerateAdminCode,
  revokeAdmin,
} from "@/lib/api/admins";
import { ApiError } from "@/lib/api/client";
import { cardStyle } from "@/components/panel/page-shell";
import type {
  AdminUser,
  CreateAdminResponse,
  IssueAdminCodeResponse,
} from "@/lib/api/contract";

interface CodeModal {
  phoneE164: string;
  label: string | null;
  code: string;
  expiresAt: string;
}

export function AdminsTableView({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ phone: string; label: string } | null>(
    null
  );
  const [codeModal, setCodeModal] = useState<CodeModal | null>(null);

  const query = useQuery({
    queryKey: ["admins", tenantId],
    queryFn: () => listAdmins(tenantId),
  });

  const createMut = useMutation({
    mutationFn: (body: { phone: string; label?: string }) =>
      createAdmin(tenantId, body),
    onSuccess: (res: CreateAdminResponse) => {
      qc.setQueryData<AdminUser[] | undefined>(
        ["admins", tenantId],
        (prev) => {
          const without = (prev ?? []).filter((a) => a.id !== res.admin.id);
          return [res.admin, ...without];
        }
      );
      setDraft(null);
      setError(null);
      setCodeModal({
        phoneE164: res.admin.phone_e164,
        label: res.admin.label,
        code: res.verification_code,
        expiresAt: res.verification_expires_at,
      });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos agregar el admin."
      );
    },
  });

  const regenerateMut = useMutation({
    mutationFn: (admin: AdminUser) => regenerateAdminCode(tenantId, admin.id),
    onSuccess: (res: IssueAdminCodeResponse, admin) => {
      setCodeModal({
        phoneE164: admin.phone_e164,
        label: admin.label,
        code: res.verification_code,
        expiresAt: res.verification_expires_at,
      });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos regenerar el código."
      );
    },
  });

  const revokeMut = useMutation({
    mutationFn: (adminId: string) => revokeAdmin(tenantId, adminId),
    onSuccess: (_, adminId) => {
      qc.setQueryData<AdminUser[] | undefined>(
        ["admins", tenantId],
        (prev) =>
          (prev ?? []).map((a) =>
            a.id === adminId
              ? { ...a, revoked_at: new Date().toISOString() }
              : a
          )
      );
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos revocar el admin."
      );
    },
  });

  function submitDraft() {
    if (!draft) {
      setDraft({ phone: "", label: "" });
      return;
    }
    const phone = draft.phone.trim();
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 6) {
      setError("El número debe tener al menos 6 dígitos.");
      return;
    }
    const label = draft.label.trim();
    setError(null);
    createMut.mutate({
      phone,
      label: label ? label : undefined,
    });
  }

  const admins = query.data ?? [];
  const activeAdmins = admins.filter((a) => !a.revoked_at);
  const revokedAdmins = admins.filter((a) => a.revoked_at);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
          Números marcados como admin pueden hablarle al bot por WhatsApp y
          pedirle stats, citas y contactos. Al agregar uno, te damos un código
          de 6 dígitos: el admin lo escribe en su primer mensaje al bot para
          verificarse.
        </div>
        <button
          type="button"
          onClick={submitDraft}
          disabled={createMut.isPending}
          style={primaryButtonStyle}
        >
          {createMut.isPending ? (
            <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
          ) : (
            <Plus size={13} />
          )}
          {draft ? "Crear admin" : "Agregar admin"}
        </button>
      </div>

      {error && <ErrorBanner text={error} onClose={() => setError(null)} />}

      {draft && (
        <div
          className="glass"
          style={{
            ...cardStyle,
            border: "1px dashed var(--hair-strong)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={sectionLabelStyle}>Nuevo admin</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Número WhatsApp (con código país)">
              <input
                autoFocus
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="+54 9 11 5555-1234"
                style={inputStyle}
              />
            </Field>
            <Field label="Etiqueta (opcional)">
              <input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder='Ej: "Mi celular" o "María recepción"'
                style={inputStyle}
              />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={submitDraft}
              disabled={createMut.isPending}
              style={primaryButtonStyle}
            >
              {createMut.isPending ? (
                <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
              ) : (
                <Check size={13} />
              )}
              Crear y generar código
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
              style={secondaryButtonStyle}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {query.isLoading && (
        <div style={{ padding: 24, color: "var(--text-2)", fontSize: 12.5 }}>
          Cargando admins…
        </div>
      )}

      {!query.isLoading && admins.length === 0 && (
        <div
          className="glass"
          style={{ ...cardStyle, color: "var(--text-2)", fontSize: 12.5 }}
        >
          No hay admins todavía. Agregá el primero con el botón de arriba.
        </div>
      )}

      {activeAdmins.length > 0 && (
        <AdminTable
          rows={activeAdmins}
          onRegenerate={(a) => regenerateMut.mutate(a)}
          onRevoke={(a) => {
            if (
              confirm(
                `¿Revocar acceso de ${a.label || a.phone_e164}? El número no podrá hablarle más al bot como admin.`
              )
            ) {
              revokeMut.mutate(a.id);
            }
          }}
          regeneratingId={
            regenerateMut.isPending ? regenerateMut.variables?.id : null
          }
          revokingId={revokeMut.isPending ? revokeMut.variables : null}
        />
      )}

      {revokedAdmins.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary
            style={{
              fontSize: 11.5,
              color: "var(--text-3)",
              cursor: "pointer",
              padding: "6px 0",
            }}
          >
            Revocados ({revokedAdmins.length})
          </summary>
          <div style={{ marginTop: 8 }}>
            <AdminTable rows={revokedAdmins} revoked />
          </div>
        </details>
      )}

      {codeModal && (
        <CodeModalView
          modal={codeModal}
          onClose={() => setCodeModal(null)}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Table
// ────────────────────────────────────────────────────────────────────────────
function AdminTable({
  rows,
  onRegenerate,
  onRevoke,
  regeneratingId,
  revokingId,
  revoked = false,
}: {
  rows: AdminUser[];
  onRegenerate?: (admin: AdminUser) => void;
  onRevoke?: (admin: AdminUser) => void;
  regeneratingId?: string | null;
  revokingId?: string | null;
  revoked?: boolean;
}) {
  return (
    <div
      className="glass"
      style={{ ...cardStyle, padding: 0, overflow: "hidden" }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: "var(--hair)" }}>
            <Th>Etiqueta</Th>
            <Th>Número</Th>
            <Th>Estado</Th>
            <Th>Agregado</Th>
            {!revoked && <Th align="right">Acciones</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr
              key={a.id}
              style={{ borderTop: "1px solid var(--hair)" }}
            >
              <Td>{a.label || <span style={mutedStyle}>—</span>}</Td>
              <Td>
                <code style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5 }}>
                  +{a.phone_e164}
                </code>
              </Td>
              <Td>
                {a.revoked_at ? (
                  <StatusPill color="var(--text-3)" icon={<X size={11} />}>
                    Revocado
                  </StatusPill>
                ) : a.verified_at ? (
                  <StatusPill color="var(--z-green)" icon={<Check size={11} />}>
                    Verificado
                  </StatusPill>
                ) : (
                  <StatusPill color="var(--z-amber)" icon={<Clock size={11} />}>
                    Pendiente
                  </StatusPill>
                )}
              </Td>
              <Td>
                <span style={mutedStyle}>
                  {new Date(a.created_at).toLocaleDateString()}
                </span>
              </Td>
              {!revoked && (
                <Td align="right">
                  <div
                    style={{
                      display: "inline-flex",
                      gap: 6,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onRegenerate?.(a)}
                      disabled={regeneratingId === a.id}
                      title="Generar código nuevo"
                      style={iconButtonStyle}
                    >
                      {regeneratingId === a.id ? (
                        <Loader2
                          size={13}
                          style={{ animation: "spin 900ms linear infinite" }}
                        />
                      ) : (
                        <RefreshCw size={13} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRevoke?.(a)}
                      disabled={revokingId === a.id}
                      title="Revocar acceso"
                      style={{ ...iconButtonStyle, color: "var(--z-red)" }}
                    >
                      {revokingId === a.id ? (
                        <Loader2
                          size={13}
                          style={{ animation: "spin 900ms linear infinite" }}
                        />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Modal de código one-shot
// ────────────────────────────────────────────────────────────────────────────
function CodeModalView({
  modal,
  onClose,
}: {
  modal: CodeModal;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const expiresInMin = Math.max(
    0,
    Math.round((new Date(modal.expiresAt).getTime() - Date.now()) / 60000)
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(modal.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="glass"
        onClick={(e) => e.stopPropagation()}
        style={{
          ...cardStyle,
          maxWidth: 460,
          width: "100%",
          background: "var(--bg-1)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            Código de verificación
          </div>
          <button
            type="button"
            onClick={onClose}
            style={iconButtonStyle}
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
          Pasale este código a{" "}
          <strong>{modal.label || `+${modal.phoneE164}`}</strong>. Tiene que
          escribirlo en su primer mensaje al bot por WhatsApp para verificar el
          número. Expira en ~{expiresInMin} min.
        </div>

        <div
          style={{
            padding: "20px 16px",
            borderRadius: 8,
            background: "var(--bg-2)",
            border: "1px dashed var(--hair-strong)",
            textAlign: "center",
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "0.3em",
            color: "var(--aurora)",
          }}
        >
          {modal.code}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={copy}
            style={{
              ...primaryButtonStyle,
              flex: 1,
              justifyContent: "center",
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copiado" : "Copiar código"}
          </button>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Cerrar
          </button>
        </div>

        <div
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            borderTop: "1px solid var(--hair)",
            paddingTop: 10,
            lineHeight: 1.5,
          }}
        >
          Este código solo se muestra una vez. Si lo perdés, regeneralo desde la
          tabla.
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={sectionLabelStyle}>{label}</span>
      {children}
    </label>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "9px 14px",
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--text-3)",
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "10px 14px",
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

function StatusPill({
  color,
  icon,
  children,
}: {
  color: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 600,
        color,
        background: `${color} / 0.12`,
        border: `1px solid ${color}`,
        opacity: 0.95,
      }}
    >
      {icon}
      {children}
    </span>
  );
}

function ErrorBanner({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div
      role="alert"
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid oklch(0.68 0.21 25 / 0.4)",
        background: "oklch(0.68 0.21 25 / 0.08)",
        color: "var(--z-red)",
        fontSize: 12.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <span>{text}</span>
      <button type="button" onClick={onClose} style={iconButtonStyle}>
        <X size={13} />
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 5,
  border: "1px solid var(--hair-strong)",
  background: "var(--bg-2)",
  color: "var(--text-0)",
  fontSize: 12.5,
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
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

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  borderRadius: 5,
  border: "1px solid var(--hair-strong)",
  background: "transparent",
  color: "var(--text-1)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};

const iconButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 5,
  borderRadius: 4,
  border: "1px solid var(--hair)",
  background: "transparent",
  color: "var(--text-1)",
  cursor: "pointer",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--text-3)",
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  fontWeight: 600,
};

const mutedStyle: React.CSSProperties = {
  color: "var(--text-3)",
  fontSize: 12,
};
