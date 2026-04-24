"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Plus, RefreshCw, ShieldOff, Trash2, Unplug, X } from "lucide-react";
import {
  getWhatsappOnboarding,
  reconnectWhatsapp,
  requestPairingCode,
  resetWhatsapp,
  setWhatsappBlockedContacts,
  setWhatsappBotEnabled,
} from "@/lib/api/whatsapp";
import { ApiError } from "@/lib/api/client";
import type { WhatsappOnboardingState } from "@/lib/api/contract";

const WA_NUMBER_PATTERN = /^\d{7,15}$/;
const POLL_INTERVAL_MS = 5_000;
const RECONNECT_TIMEOUT_MS = 30_000;

type WizardStep = "number" | "code" | "done";
const STEPS: { key: WizardStep; label: string }[] = [
  { key: "number", label: "Número" },
  { key: "code", label: "Código" },
  { key: "done", label: "Listo" },
];

function normalizeNumber(value: string): string {
  return value.replace(/\D/g, "");
}

function isReconnecting(state: WhatsappOnboardingState | undefined): boolean {
  return !!(state?.auth_state_registered && state.status === "reconnecting");
}

function deriveStep(state: WhatsappOnboardingState | undefined): WizardStep {
  if (!state) return "number";
  if (state.connected) return "done";
  if (state.status === "error") return "done";
  if (isReconnecting(state)) return "done";
  if (state.pairing_code || state.number) return "code";
  return "number";
}

export function WhatsappCard({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();

  const [numberInput, setNumberInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [newBlocked, setNewBlocked] = useState("");
  const [stepOverride, setStepOverride] = useState<WizardStep | null>(null);
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ["whatsapp-onboarding", tenantId],
    queryFn: () => getWhatsappOnboarding(tenantId),
    refetchInterval: (q) => {
      const data = q.state.data as WhatsappOnboardingState | undefined;
      if (data?.status === "waiting_for_pairing") return 4_000;
      if (data?.status === "reconnecting") return POLL_INTERVAL_MS;
      return 20_000;
    },
  });

  const state = query.data;
  const derivedStep = deriveStep(state);
  const step = stepOverride ?? derivedStep;

  // Mantenemos sincronizado el input con el número real del backend.
  useEffect(() => {
    if (state?.number && !numberInput) setNumberInput(state.number);
  }, [state?.number, numberInput]);

  // Si el backend cambió de status, limpiamos el override del step para que
  // la UI vuelva a ser reactiva.
  useEffect(() => {
    if (stepOverride && stepOverride === derivedStep) setStepOverride(null);
  }, [stepOverride, derivedStep]);

  const pair = useMutation({
    mutationFn: (body: { number: string; force?: boolean }) => requestPairingCode(tenantId, body),
    onSuccess: (fresh) => {
      qc.setQueryData(["whatsapp-onboarding", tenantId], fresh);
      setError(null);
      setInfo(fresh.connected ? "WhatsApp conectado" : "Código listo — pegalo en WhatsApp");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.payload.error : "No pudimos iniciar el pairing.");
    },
  });

  const reconnect = useMutation({
    mutationFn: () => reconnectWhatsapp(tenantId),
    onSuccess: (fresh) => {
      qc.setQueryData(["whatsapp-onboarding", tenantId], fresh);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.payload.error : "No pudimos reconectar.");
    },
  });

  const reset = useMutation({
    mutationFn: () => resetWhatsapp(tenantId),
    onSuccess: (fresh) => {
      qc.setQueryData(["whatsapp-onboarding", tenantId], fresh);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.payload.error : "No pudimos desvincular.");
    },
  });

  const toggleBot = useMutation({
    mutationFn: (enabled: boolean) => setWhatsappBotEnabled(tenantId, enabled),
    onSuccess: (fresh) => {
      qc.setQueryData(["whatsapp-onboarding", tenantId], fresh);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.payload.error : "No pudimos cambiar el estado del bot.");
    },
  });

  const updateBlocked = useMutation({
    mutationFn: (numbers: string[]) => setWhatsappBlockedContacts(tenantId, numbers),
    onSuccess: (fresh) => {
      qc.setQueryData(["whatsapp-onboarding", tenantId], fresh);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.payload.error : "No pudimos actualizar los contactos bloqueados."
      );
    },
  });

  // ── Auto-reconnect después de 30s en status=reconnecting ──
  const reconnectingStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (!state || !isReconnecting(state)) {
      reconnectingStartRef.current = null;
      return;
    }
    if (!reconnectingStartRef.current) {
      reconnectingStartRef.current = Date.now();
    }
    const interval = setInterval(async () => {
      const elapsed = Date.now() - (reconnectingStartRef.current ?? Date.now());
      if (elapsed >= RECONNECT_TIMEOUT_MS && !reconnect.isPending) {
        reconnectingStartRef.current = null;
        try {
          await reconnect.mutateAsync();
        } catch (err) {
          if (err instanceof ApiError && err.is("not_paired")) {
            setStepOverride("number");
            setError("No hay credenciales guardadas. Vinculá el número de nuevo.");
          }
        }
        await query.refetch();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [state, reconnect, query]);

  // ── Acciones del wizard ──
  const submitNumber = useCallback(async () => {
    const n = normalizeNumber(numberInput);
    if (!WA_NUMBER_PATTERN.test(n)) {
      setError("El número debe tener entre 7 y 15 dígitos. Ej: 5491123456789.");
      return;
    }
    setError(null);
    await pair.mutateAsync({ number: n });
  }, [numberInput, pair]);

  const requestNewCode = useCallback(async () => {
    const n = normalizeNumber(numberInput || state?.number || "");
    if (!WA_NUMBER_PATTERN.test(n)) {
      setError("No hay número guardado. Volvé al paso anterior.");
      return;
    }
    setError(null);
    await pair.mutateAsync({ number: n, force: true });
  }, [numberInput, state?.number, pair]);

  const copyPairing = useCallback(async () => {
    const code = state?.pairing_code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("No se pudo copiar el código.");
    }
  }, [state?.pairing_code]);

  const executeUnlink = useCallback(async () => {
    setShowUnlinkModal(false);
    setError(null);
    try {
      await reset.mutateAsync();
      // Pequeño respiro para que el adapter cierre antes de pedir código nuevo.
      await new Promise((r) => setTimeout(r, 1_200));
      const n = normalizeNumber(numberInput || state?.number || "");
      if (WA_NUMBER_PATTERN.test(n)) {
        await pair.mutateAsync({ number: n });
        setInfo("Sesión reseteada. Pegá el nuevo código en WhatsApp.");
      } else {
        setStepOverride("number");
      }
    } catch {
      // el onError de cada mutation ya setea el error
    }
  }, [numberInput, state?.number, reset, pair]);

  const sessionClosed = useMemo(() => {
    if (!state) return false;
    return state.runtime_status === "logged_out" || state.status === "error";
  }, [state]);

  const busy =
    pair.isPending || reconnect.isPending || reset.isPending || toggleBot.isPending;
  const blockedBusy = updateBlocked.isPending;

  // ── Blocked contacts handlers ──
  const blockedList = state?.bot_blocked_contacts ?? [];

  const addBlocked = useCallback(() => {
    const n = normalizeNumber(newBlocked);
    if (!WA_NUMBER_PATTERN.test(n)) {
      setError("El número debe tener entre 7 y 15 dígitos.");
      return;
    }
    if (blockedList.includes(n)) {
      setError("Ese número ya está bloqueado.");
      return;
    }
    setError(null);
    setNewBlocked("");
    updateBlocked.mutate([...blockedList, n]);
  }, [newBlocked, blockedList, updateBlocked]);

  const removeBlocked = useCallback(
    (n: string) => {
      updateBlocked.mutate(blockedList.filter((x) => x !== n));
    },
    [blockedList, updateBlocked]
  );

  const currentIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <>
      <div
        className="glass"
        style={{
          padding: 16,
          borderRadius: 10,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minWidth: 0,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <WhatsappLogo />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>WhatsApp Business</div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-3)",
                fontFamily: "var(--font-jetbrains-mono)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {state?.number || "Sin número configurado"} · {state?.provider ?? "baileys"}
            </div>
          </div>
          {state && <StatusPill status={state.status} />}
        </div>

        {/* Pager */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 2px",
          }}
          aria-label="Pasos de conexión"
        >
          {STEPS.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <Fragment key={s.key}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    flex: "0 0 auto",
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: active
                        ? "1px solid oklch(0.62 0.22 295 / 0.6)"
                        : "1px solid var(--hair)",
                      background: done
                        ? "var(--aurora)"
                        : active
                          ? "oklch(0.62 0.22 295 / 0.14)"
                          : "rgba(255,255,255,0.02)",
                      color: done ? "#0a0a0f" : active ? "var(--text-0)" : "var(--text-3)",
                      fontSize: 11,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-jetbrains-mono)",
                    }}
                  >
                    {done ? <Check size={12} /> : i + 1}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: active ? "var(--text-0)" : "var(--text-3)",
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: done ? "var(--aurora)" : "var(--hair)",
                      opacity: done ? 0.5 : 1,
                    }}
                  />
                )}
              </Fragment>
            );
          })}
        </div>

        {/* Banners */}
        {error && (
          <div role="alert" style={errorBoxStyle}>
            {error}
          </div>
        )}
        {!error && info && (
          <div style={infoBoxStyle}>
            {info}
          </div>
        )}
        {sessionClosed && step === "done" && (
          <div style={warningBoxStyle}>
            <strong style={{ color: "var(--text-0)", display: "block", marginBottom: 4 }}>
              La sesión fue cerrada desde el teléfono
            </strong>
            <span style={{ color: "var(--text-2)", fontSize: 11.5 }}>
              Las credenciales guardadas ya no son válidas. Desvinculá y re-vinculá para generar un
              código nuevo.
            </span>
          </div>
        )}
        {state?.last_error && !sessionClosed && (
          <div style={{ fontSize: 11.5, color: "var(--z-amber)" }}>⚠ {state.last_error}</div>
        )}

        {/* Loading inicial */}
        {!state && query.isLoading && (
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>Cargando estado…</div>
        )}

        {/* ── Step: NUMBER ── */}
        {step === "number" && state && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitNumber();
            }}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <label style={labelStyle}>
              {state.number_help?.label || "Número con código de país"}
            </label>
            <input
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
              placeholder={state.number_help?.placeholder || "5491123456789"}
              inputMode="numeric"
              autoComplete="off"
              style={inputStyle}
              disabled={busy}
            />
            {state.number_help?.instructions && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-3)",
                  lineHeight: 1.5,
                }}
              >
                {state.number_help.instructions}
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !numberInput.trim()}
              style={primaryBtn}
            >
              {pair.isPending ? (
                <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
              ) : null}
              Generar código
            </button>
          </form>
        )}

        {/* ── Step: CODE ── */}
        {step === "code" && state && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={pairingCodeBoxStyle}>
              {state.pairing_code || "•••• ••••"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.5 }}>
              Abrí WhatsApp → Dispositivos vinculados → Vincular con número de teléfono e ingresá
              este código. El panel se actualiza solo.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={copyPairing}
                disabled={!state.pairing_code}
                style={secondaryBtn}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                type="button"
                onClick={() => void requestNewCode()}
                disabled={busy}
                style={secondaryBtn}
              >
                <RefreshCw size={12} /> Nuevo código
              </button>
              <button
                type="button"
                onClick={() => setStepOverride("number")}
                disabled={busy}
                style={secondaryBtn}
              >
                Cambiar número
              </button>
            </div>
          </div>
        )}

        {/* ── Step: DONE (reconectando) ── */}
        {step === "done" && state && isReconnecting(state) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", padding: "8px 0" }}>
            <Loader2
              size={24}
              style={{ animation: "spin 900ms linear infinite", color: "var(--text-2)" }}
            />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--text-0)", fontWeight: 500 }}>
                Reconectando sesión…
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
                Tu número <strong>{state.number || "—"}</strong> ya está vinculado. El adaptador
                está retomando la sesión.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowUnlinkModal(true)}
              disabled={busy}
              style={{ ...secondaryBtn, color: "var(--z-red)", borderColor: "oklch(0.68 0.21 25 / 0.4)" }}
            >
              <Unplug size={12} /> Desvincular y re-vincular
            </button>
          </div>
        )}

        {/* ── Step: DONE (conectado / error estable) ── */}
        {step === "done" && state && !isReconnecting(state) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={botToggleRowStyle}>
              <span>Bot habilitado</span>
              <button
                type="button"
                aria-pressed={state.bot_enabled}
                onClick={() => toggleBot.mutate(!state.bot_enabled)}
                disabled={busy}
                style={{
                  width: 34,
                  height: 20,
                  borderRadius: 10,
                  border: "1px solid var(--hair-strong)",
                  background: state.bot_enabled ? "var(--aurora)" : "rgba(255,255,255,0.05)",
                  position: "relative",
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 1,
                    left: state.bot_enabled ? 15 : 1,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "white",
                    transition: "left 120ms",
                  }}
                />
              </button>
            </label>
            <button
              type="button"
              onClick={() => setShowBlockedModal(true)}
              disabled={busy}
              style={secondaryBtn}
            >
              <ShieldOff size={12} /> Contactos bloqueados
              {blockedList.length > 0 && (
                <span
                  style={{
                    marginLeft: 4,
                    padding: "1px 6px",
                    borderRadius: 10,
                    background: "var(--aurora)",
                    color: "#0a0a0f",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {blockedList.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowUnlinkModal(true)}
              disabled={busy}
              style={{ ...secondaryBtn, color: "var(--z-red)", borderColor: "oklch(0.68 0.21 25 / 0.4)" }}
            >
              <Unplug size={12} /> Desvincular número
            </button>
          </div>
        )}
      </div>

      {/* ── Modal de confirmación desvincular ── */}
      {showUnlinkModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUnlinkModal(false);
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
            style={{ width: 440, maxWidth: "100%", borderRadius: 12, overflow: "hidden" }}
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
              <Unplug size={16} style={{ color: "var(--z-red)" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Desvincular WhatsApp</div>
              <button
                onClick={() => setShowUnlinkModal(false)}
                aria-label="Cerrar"
                style={closeBtn}
              >
                <X size={14} />
              </button>
            </header>
            <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.55 }}>
                Esto cierra la sesión actual de WhatsApp y pide un nuevo código de vinculación. El
                bot <strong>deja de responder</strong> hasta que pegues el nuevo código.
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                Número vinculado:{" "}
                <strong style={{ color: "var(--text-1)", fontFamily: "var(--font-jetbrains-mono)" }}>
                  {state?.number || "—"}
                </strong>
              </div>
            </div>
            <div
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
                onClick={() => setShowUnlinkModal(false)}
                disabled={busy}
                style={secondaryBtn}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void executeUnlink()}
                disabled={busy}
                style={{
                  ...primaryBtn,
                  background: "var(--z-red)",
                  color: "#fff",
                }}
              >
                {busy ? (
                  <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
                ) : (
                  <Unplug size={12} />
                )}
                Desvincular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Contactos bloqueados ── */}
      {showBlockedModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="blocked-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBlockedModal(false);
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
            style={{ width: 460, maxWidth: "100%", borderRadius: 12, overflow: "hidden" }}
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
              <ShieldOff size={16} style={{ color: "var(--text-2)" }} />
              <div id="blocked-title" style={{ fontSize: 14, fontWeight: 600 }}>
                Contactos bloqueados
              </div>
              <button
                onClick={() => setShowBlockedModal(false)}
                aria-label="Cerrar"
                style={closeBtn}
              >
                <X size={14} />
              </button>
            </header>

            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}>
                El bot <strong style={{ color: "var(--text-0)" }}>no responderá</strong> a los
                números de esta lista. Ingresá cada número con código de país, sin "+" ni espacios
                (ej. <code style={monoInline}>5491123456789</code>).
              </div>

              {/* Input para agregar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addBlocked();
                }}
                style={{ display: "flex", gap: 8 }}
              >
                <input
                  value={newBlocked}
                  onChange={(e) => setNewBlocked(e.target.value)}
                  placeholder="5491123456789"
                  inputMode="numeric"
                  autoComplete="off"
                  style={{ ...inputStyle, flex: 1 }}
                  disabled={blockedBusy}
                />
                <button
                  type="submit"
                  disabled={blockedBusy || !newBlocked.trim()}
                  style={primaryBtn}
                >
                  {blockedBusy ? (
                    <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
                  ) : (
                    <Plus size={12} />
                  )}
                  Agregar
                </button>
              </form>

              {/* Lista */}
              <div
                style={{
                  border: "1px solid var(--hair)",
                  borderRadius: 8,
                  maxHeight: 260,
                  overflowY: "auto",
                }}
              >
                {blockedList.length === 0 ? (
                  <div
                    style={{
                      padding: "20px 12px",
                      textAlign: "center",
                      color: "var(--text-3)",
                      fontSize: 12,
                    }}
                  >
                    No hay contactos bloqueados.
                  </div>
                ) : (
                  blockedList.map((number, i) => (
                    <div
                      key={number}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderBottom:
                          i < blockedList.length - 1 ? "1px solid var(--hair)" : undefined,
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          fontFamily: "var(--font-jetbrains-mono)",
                          color: "var(--text-0)",
                        }}
                      >
                        {number}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBlocked(number)}
                        disabled={blockedBusy}
                        aria-label={`Quitar ${number}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 28,
                          height: 28,
                          borderRadius: 5,
                          border: "1px solid var(--hair)",
                          background: "transparent",
                          color: "var(--z-red)",
                          cursor: blockedBusy ? "not-allowed" : "pointer",
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              style={{
                padding: "12px 18px",
                borderTop: "1px solid var(--hair)",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setShowBlockedModal(false)}
                style={secondaryBtn}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const monoInline: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 11,
  padding: "1px 5px",
  borderRadius: 3,
  background: "rgba(255,255,255,0.05)",
  color: "var(--text-1)",
};

function StatusPill({ status }: { status: WhatsappOnboardingState["status"] }) {
  const map: Record<string, { label: string; color: string }> = {
    connected: { label: "conectado", color: "var(--z-green)" },
    waiting_for_pairing: { label: "esperando código", color: "var(--z-cyan)" },
    reconnecting: { label: "reconectando", color: "var(--z-amber)" },
    disconnected: { label: "desconectado", color: "var(--text-3)" },
    error: { label: "error", color: "var(--z-red)" },
    not_configured: { label: "sin configurar", color: "var(--text-3)" },
  };
  const m = map[status] ?? { label: status, color: "var(--text-2)" };
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 4,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${m.color}55`,
        color: m.color,
        fontFamily: "var(--font-jetbrains-mono)",
        whiteSpace: "nowrap",
      }}
    >
      {m.label}
    </span>
  );
}

function WhatsappLogo() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        background: "rgba(37,211,102,0.1)",
        border: "1px solid rgba(37,211,102,0.4)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 40 40" width="18" height="18" role="img" aria-label="WhatsApp">
        <path
          d="M20.1 8.1c-6.4 0-11.6 5.1-11.6 11.5 0 2.1.6 4.1 1.6 5.8L8.4 31.7l6.5-1.7c1.6.9 3.4 1.3 5.2 1.3 6.4 0 11.6-5.1 11.6-11.5S26.5 8.1 20.1 8.1zm5.3 14c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.7-1.4-1.6-1.6-1.9-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.1-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.8.6.8.2 1.4.2 2 0 .6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.3-.6-.4z"
          fill="#25D366"
        />
      </svg>
    </div>
  );
}

// ── Estilos compartidos ──
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-3)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--hair-strong)",
  background: "rgba(0,0,0,0.2)",
  color: "var(--text-0)",
  fontSize: 13,
  fontFamily: "var(--font-jetbrains-mono)",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 12px",
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

const closeBtn: React.CSSProperties = {
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
};

const errorBoxStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.08)",
  color: "var(--z-red)",
  fontSize: 12,
  lineHeight: 1.5,
};

const infoBoxStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid oklch(0.78 0.15 155 / 0.35)",
  background: "oklch(0.78 0.15 155 / 0.1)",
  color: "var(--z-green)",
  fontSize: 12,
  lineHeight: 1.5,
};

const warningBoxStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid oklch(0.82 0.17 85 / 0.35)",
  background: "oklch(0.82 0.17 85 / 0.08)",
  color: "var(--text-1)",
  fontSize: 12,
  lineHeight: 1.5,
};

const pairingCodeBoxStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 8,
  border: "1px solid var(--hair-strong)",
  background: "rgba(0,0,0,0.25)",
  textAlign: "center",
  letterSpacing: 3,
  fontSize: 22,
  fontFamily: "var(--font-jetbrains-mono)",
  color: "var(--text-0)",
  fontWeight: 600,
};

const botToggleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--hair)",
  background: "rgba(255,255,255,0.02)",
  fontSize: 12.5,
};
