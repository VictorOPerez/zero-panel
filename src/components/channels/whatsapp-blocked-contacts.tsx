"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, UserMinus, X } from "lucide-react";
import { setWhatsappBlockedContacts } from "@/lib/api/whatsapp";
import { listConversations } from "@/lib/api/conversations";

interface Props {
  tenantId: string;
  current: string[];
}

// Normalizar a "solo digitos" — el backend espera el numero E.164 sin +.
function normalizePhone(input: string): string {
  return input.replace(/\D+/g, "");
}

function formatPhone(p: string): string {
  // Mostrar tal cual; si es US-like (11 chars con 1 al inicio) embellecer.
  if (p.length === 11 && p.startsWith("1")) {
    return `+1 (${p.slice(1, 4)}) ${p.slice(4, 7)}-${p.slice(7)}`;
  }
  return `+${p}`;
}

export function WhatsappBlockedContacts({ tenantId, current }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draftPhone, setDraftPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const blockedSet = new Set(current);

  const save = useMutation({
    mutationFn: (next: string[]) => setWhatsappBlockedContacts(tenantId, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "No pudimos guardar.");
    },
  });

  const recentContactsQuery = useQuery({
    queryKey: ["tenant", tenantId, "recent-contacts"],
    queryFn: async () => {
      const res = await listConversations({ tenantId, limit: 50 });
      // Dedupe por phone, conservar el primer name visto.
      const seen = new Map<string, { name: string; phone: string }>();
      for (const c of res.conversations) {
        const phone = normalizePhone(c.contactPhone ?? "");
        if (!phone) continue;
        if (!seen.has(phone)) {
          seen.set(phone, {
            name: c.contactName ?? formatPhone(phone),
            phone,
          });
        }
      }
      return [...seen.values()];
    },
    enabled: open, // Solo carga cuando el bloque esta abierto.
  });

  const recentNotBlocked = (recentContactsQuery.data ?? []).filter(
    (c) => !blockedSet.has(c.phone)
  );

  function addPhone(phone: string) {
    setError(null);
    const normalized = normalizePhone(phone);
    if (normalized.length < 7 || normalized.length > 15) {
      setError("Número inválido. Incluí código de país (ej. +1 305 555 0123).");
      return;
    }
    if (blockedSet.has(normalized)) {
      setError("Ese número ya está bloqueado.");
      return;
    }
    save.mutate([...current, normalized]);
    setDraftPhone("");
  }

  function removePhone(phone: string) {
    save.mutate(current.filter((p) => p !== phone));
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--hair)",
        marginTop: 4,
        paddingTop: 14,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--text-1)",
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Contactos sin bot
        {current.length > 0 && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              color: "var(--text-3)",
              background: "rgba(255,255,255,0.06)",
              padding: "1px 6px",
              borderRadius: 999,
            }}
          >
            {current.length}
          </span>
        )}
      </button>

      <p
        style={{
          fontSize: 11.5,
          color: "var(--text-3)",
          margin: "6px 0 0",
          paddingLeft: 20,
          lineHeight: 1.5,
        }}
      >
        El bot ignora a estos números — siguen apareciendo en el inbox para que
        respondas vos manual.
      </p>

      {open && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Input para agregar manual */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addPhone(draftPhone);
            }}
            style={{ display: "flex", gap: 6 }}
          >
            <input
              type="tel"
              inputMode="tel"
              value={draftPhone}
              onChange={(e) => setDraftPhone(e.target.value)}
              placeholder="+1 305 555 0123"
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--hair-strong)",
                background: "rgba(0,0,0,0.2)",
                color: "var(--text-0)",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={!draftPhone.trim() || save.isPending}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "none",
                background: "var(--aurora)",
                color: "#0a0a0f",
                fontSize: 12,
                fontWeight: 600,
                cursor: save.isPending ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Plus size={12} /> Agregar
            </button>
          </form>

          {error && (
            <div
              role="alert"
              style={{
                fontSize: 11.5,
                color: "var(--z-red, #ef4444)",
                padding: "6px 8px",
                borderRadius: 6,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
              }}
            >
              {error}
            </div>
          )}

          {/* Chips de actuales */}
          {current.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {current.map((phone) => (
                <span
                  key={phone}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: "1px solid var(--hair-strong)",
                    background: "rgba(0,0,0,0.25)",
                    fontSize: 12,
                    color: "var(--text-1)",
                    fontFamily: "var(--font-jetbrains-mono, monospace)",
                  }}
                >
                  {formatPhone(phone)}
                  <button
                    type="button"
                    onClick={() => removePhone(phone)}
                    aria-label={`Desbloquear ${phone}`}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-3)",
                      cursor: "pointer",
                      padding: 0,
                      display: "inline-flex",
                    }}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Selector desde el inbox */}
          <div>
            <div
              style={{
                fontSize: 10.5,
                color: "var(--text-3)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              O bloqueá desde tus conversaciones
            </div>
            {recentContactsQuery.isLoading ? (
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Cargando…</div>
            ) : recentNotBlocked.length === 0 ? (
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                {(recentContactsQuery.data?.length ?? 0) === 0
                  ? "Todavía no tenés conversaciones — los contactos aparecerán acá cuando alguien escriba."
                  : "Todos tus contactos recientes ya están bloqueados."}
              </div>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {recentNotBlocked.map((c) => (
                  <li
                    key={c.phone}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 12.5,
                          color: "var(--text-1)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: "var(--text-3)",
                          fontFamily: "var(--font-jetbrains-mono, monospace)",
                        }}
                      >
                        {formatPhone(c.phone)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addPhone(c.phone)}
                      disabled={save.isPending}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--hair)",
                        background: "transparent",
                        color: "var(--text-2)",
                        fontSize: 11,
                        cursor: save.isPending ? "wait" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <UserMinus size={11} /> Bloquear
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
