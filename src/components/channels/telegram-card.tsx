"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import {
  connectTelegram,
  getTelegramOnboarding,
  regenerateTelegramConnectCode,
  setTelegramChat,
} from "@/lib/api/telegram";
import { ApiError } from "@/lib/api/client";
import type { TelegramOnboardingState } from "@/lib/api/contract";

const TELEGRAM_TOKEN_PATTERN = /^\d{6,20}:[A-Za-z0-9_-]{30,}$/;
const TELEGRAM_CHAT_PATTERN = /^-?\d{5,30}$/;

type WizardStep = "create" | "token" | "connect" | "done";
const STEPS: { key: WizardStep; label: string }[] = [
  { key: "create", label: "Crear bot" },
  { key: "token", label: "Token" },
  { key: "connect", label: "Conectar" },
  { key: "done", label: "Listo" },
];

function compactDateTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("es-AR", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function deriveStep(state: TelegramOnboardingState | undefined): WizardStep {
  if (!state) return "create";
  if (state.status === "connected") return "done";
  if (state.has_bot_token) return "connect";
  return "create";
}

export function TelegramCard({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();

  const [botToken, setBotToken] = useState("");
  const [tokenChatId, setTokenChatId] = useState("");
  const [manualChatId, setManualChatId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [stepOverride, setStepOverride] = useState<WizardStep | null>(null);
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ["telegram-onboarding", tenantId],
    queryFn: () => getTelegramOnboarding(tenantId),
    refetchInterval: (q) => {
      const data = q.state.data as TelegramOnboardingState | undefined;
      if (data?.status === "waiting_for_chat") return 5_000;
      return 20_000;
    },
  });

  const state = query.data;
  const derivedStep = deriveStep(state);
  const step = stepOverride ?? derivedStep;

  // Si el backend cambia al mismo paso al que apunta el override, lo limpiamos
  // para devolverle el control a la UI reactiva.
  useEffect(() => {
    if (stepOverride && stepOverride === derivedStep) setStepOverride(null);
  }, [stepOverride, derivedStep]);

  // Sincronizamos los inputs con lo que el backend ya conoce.
  useEffect(() => {
    if (state?.admin_chat_id) {
      setTokenChatId((prev) => prev || state.admin_chat_id);
      setManualChatId((prev) => prev || state.admin_chat_id);
    }
  }, [state?.admin_chat_id]);

  const connect = useMutation({
    mutationFn: (body: { bot_token: string; admin_chat_id?: string }) =>
      connectTelegram(tenantId, body),
    onSuccess: (fresh) => {
      qc.setQueryData(["telegram-onboarding", tenantId], fresh);
      setBotToken("");
      setError(null);
      setInfo(
        fresh?.status === "connected"
          ? "Telegram conectado."
          : "Token guardado. Completá el paso siguiente."
      );
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos guardar el token."
      );
    },
  });

  const saveChat = useMutation({
    mutationFn: (admin_chat_id: string) => setTelegramChat(tenantId, admin_chat_id),
    onSuccess: (fresh) => {
      qc.setQueryData(["telegram-onboarding", tenantId], fresh);
      setError(null);
      setInfo("Chat de Telegram conectado.");
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos guardar el chat."
      );
    },
  });

  const regen = useMutation({
    mutationFn: () => regenerateTelegramConnectCode(tenantId),
    onSuccess: (fresh) => {
      qc.setQueryData(["telegram-onboarding", tenantId], fresh);
      setError(null);
      setInfo("Código de conexión regenerado.");
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos regenerar el código."
      );
    },
  });

  const submitToken = useCallback(() => {
    const tokenValue = botToken.trim();
    const chatValue = tokenChatId.trim();

    if (!TELEGRAM_TOKEN_PATTERN.test(tokenValue)) {
      setError("El token de Telegram no tiene el formato esperado.");
      return;
    }
    if (chatValue && !TELEGRAM_CHAT_PATTERN.test(chatValue)) {
      setError("El chat_id debe ser numérico, de 5 a 30 dígitos (puede ser negativo).");
      return;
    }
    setError(null);
    connect.mutate({
      bot_token: tokenValue,
      admin_chat_id: chatValue || undefined,
    });
  }, [botToken, tokenChatId, connect]);

  const submitManualChat = useCallback(() => {
    const chatValue = manualChatId.trim();
    if (!TELEGRAM_CHAT_PATTERN.test(chatValue)) {
      setError("El chat_id debe ser numérico, de 5 a 30 dígitos (puede ser negativo).");
      return;
    }
    setError(null);
    saveChat.mutate(chatValue);
  }, [manualChatId, saveChat]);

  const copyCommand = useCallback(async () => {
    const command = state?.connect_command;
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("No se pudo copiar el comando.");
    }
  }, [state?.connect_command]);

  const verifyConnection = useCallback(async () => {
    setError(null);
    const fresh = await query.refetch();
    if (fresh.data?.status === "connected") {
      setInfo("Telegram conectado.");
    } else {
      setError("Todavía no conectado. Asegurate de enviar el comando al bot.");
    }
  }, [query]);

  const busy = connect.isPending || saveChat.isPending || regen.isPending;
  const currentIdx = STEPS.findIndex((s) => s.key === step);

  return (
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
        <TelegramLogo />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Telegram</div>
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
            {state?.suggested_bot_username
              ? `@${state.suggested_bot_username}`
              : "sin bot"}
          </div>
        </div>
        <StatusPill status={state?.status ?? "missing_token"} />
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
                    color: done
                      ? "#0a0a0f"
                      : active
                        ? "var(--text-0)"
                        : "var(--text-3)",
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
      {!error && info && <div style={infoBoxStyle}>{info}</div>}

      {!state && query.isLoading && (
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>
          Cargando estado…
        </div>
      )}

      {/* Step: create */}
      {state && step === "create" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={descStyle}>
            Creá un bot en Telegram con BotFather. Cuando BotFather te devuelva el
            token, copialo para el próximo paso.
          </p>
          <div style={suggestBoxStyle}>
            <div style={suggestRow}>
              <span style={suggestLabel}>Nombre sugerido</span>
              <strong style={suggestValue}>
                {state.suggested_bot_name || "—"}
              </strong>
            </div>
            <div style={suggestRow}>
              <span style={suggestLabel}>Username sugerido</span>
              <strong style={suggestValue}>
                {state.suggested_bot_username
                  ? `@${state.suggested_bot_username}`
                  : "—"}
              </strong>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              href={state.botfather_url || "https://t.me/BotFather"}
              target="_blank"
              rel="noreferrer"
              style={{ ...primaryBtn, textDecoration: "none" }}
            >
              <ExternalLink size={12} />
              Abrir BotFather
            </a>
            <button
              type="button"
              style={secondaryBtn}
              onClick={() => setStepOverride("token")}
            >
              Ya tengo el token
            </button>
          </div>
        </div>
      )}

      {/* Step: token */}
      {state && step === "token" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitToken();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <p style={descStyle}>
            Pegá el token que te dio BotFather. Formato{" "}
            <code style={inlineCode}>1234567890:AAxxxxx…</code>.
          </p>
          {state.masked_bot_token ? (
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              Token actual:{" "}
              <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                {state.masked_bot_token}
              </span>
            </div>
          ) : null}
          <label style={labelStyle}>
            {state.token_help?.label || "Bot token"}
          </label>
          <input
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={state.token_help?.placeholder || "1234567890:AA..."}
            style={inputStyle}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            required
          />
          <label style={labelStyle}>Chat ID del admin (opcional)</label>
          <input
            value={tokenChatId}
            onChange={(e) => setTokenChatId(e.target.value)}
            placeholder="-1001234567890"
            style={inputStyle}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={busy || !botToken.trim()}
              style={primaryBtn}
            >
              {connect.isPending ? (
                <Loader2
                  size={12}
                  style={{ animation: "spin 900ms linear infinite" }}
                />
              ) : null}
              {connect.isPending ? "Guardando…" : "Guardar token"}
            </button>
            <button
              type="button"
              style={backBtn}
              onClick={() => setStepOverride("create")}
              disabled={busy}
            >
              Volver
            </button>
          </div>
        </form>
      )}

      {/* Step: connect */}
      {state && step === "connect" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={descStyle}>
            Abrí tu bot en Telegram y enviá este comando para vincular el chat
            donde recibirás las notificaciones:
          </p>
          <div style={codeBlockStyle}>
            {state.connect_command || "/connect 0000000000"}
          </div>
          {state.connect_code_expires_at && (
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              Expira {compactDateTime(state.connect_code_expires_at)}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={secondaryBtn}
              onClick={copyCommand}
              disabled={!state.connect_command}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copiado" : "Copiar comando"}
            </button>
            <button
              type="button"
              style={primaryBtn}
              onClick={() => void verifyConnection()}
              disabled={busy || query.isFetching}
            >
              {query.isFetching ? (
                <Loader2
                  size={12}
                  style={{ animation: "spin 900ms linear infinite" }}
                />
              ) : (
                <RefreshCw size={12} />
              )}
              {query.isFetching ? "Verificando…" : "Verificar conexión"}
            </button>
            <button
              type="button"
              style={secondaryBtn}
              onClick={() => regen.mutate()}
              disabled={busy || !state.has_bot_token}
            >
              {regen.isPending ? (
                <Loader2
                  size={12}
                  style={{ animation: "spin 900ms linear infinite" }}
                />
              ) : null}
              Regenerar código
            </button>
          </div>

          <div style={dividerStyle}>o</div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitManualChat();
            }}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <label style={labelStyle}>Pegar chat_id manualmente</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={manualChatId}
                onChange={(e) => setManualChatId(e.target.value)}
                placeholder="-1001234567890"
                style={{ ...inputStyle, flex: 1 }}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                style={secondaryBtn}
                disabled={busy || !manualChatId.trim()}
              >
                {saveChat.isPending ? (
                  <Loader2
                    size={12}
                    style={{ animation: "spin 900ms linear infinite" }}
                  />
                ) : null}
                Guardar
              </button>
            </div>
          </form>

          <div>
            <button
              type="button"
              style={backBtn}
              onClick={() => setStepOverride("token")}
              disabled={busy}
            >
              Volver
            </button>
          </div>
        </div>
      )}

      {/* Step: done */}
      {state && step === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={descStyle}>
            {state.status === "connected"
              ? "Telegram está conectado. El bot ya puede responder en este canal."
              : "Credenciales guardadas. Falta confirmar la conexión."}
          </p>
          <div style={dataGridStyle}>
            <DataCell label="Token">{state.masked_bot_token || "—"}</DataCell>
            <DataCell label="Admin chat">
              {state.admin_chat_id || "Pendiente"}
            </DataCell>
            <DataCell label="Estado">
              {state.status === "connected"
                ? "Activo"
                : state.status === "waiting_for_chat"
                  ? "Esperando /connect"
                  : "Sin token"}
            </DataCell>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={secondaryBtn}
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              {query.isFetching ? (
                <Loader2
                  size={12}
                  style={{ animation: "spin 900ms linear infinite" }}
                />
              ) : (
                <RefreshCw size={12} />
              )}
              Actualizar
            </button>
            <button
              type="button"
              style={backBtn}
              onClick={() => setStepOverride("token")}
              disabled={busy}
            >
              Cambiar token
            </button>
          </div>
          {state.setup_steps?.length ? (
            <div style={helpBoxStyle}>
              <div style={helpTitleStyle}>Pasos de referencia</div>
              <ol style={{ margin: 0, paddingLeft: 16 }}>
                {state.setup_steps.map((s) => (
                  <li
                    key={s}
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-2)",
                      lineHeight: 1.5,
                    }}
                  >
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function DataCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={dataCellStyle}>
      <span style={dataLabelStyle}>{label}</span>
      <strong style={dataValueStyle}>{children}</strong>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    connected: { label: "conectado", color: "var(--z-green)" },
    waiting_for_chat: { label: "esperando /connect", color: "var(--z-cyan)" },
    missing_token: { label: "sin bot", color: "var(--text-3)" },
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
      }}
    >
      {m.label}
    </span>
  );
}

function TelegramLogo() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        background: "rgba(58,165,234,0.1)",
        border: "1px solid rgba(58,165,234,0.4)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg viewBox="0 0 40 40" width={18} height={18} role="img">
        <circle cx="20" cy="20" r="20" fill="#3AA5EA" />
        <path
          d="M30.8 11.3 8.7 19.8c-1.5.6-1.5 1.5-.3 1.9l5.7 1.8 2.2 7c.3.8.2 1.1 1 1.1.6 0 .9-.3 1.3-.7l3.1-3 6.4 4.7c1.2.7 2 .3 2.3-1.1l4.2-19.6c.4-1.7-.7-2.5-1.8-2zM15 23.1l13.2-8.3c.7-.4 1.2-.2.7.3L18.2 24.8l-.4 4.4-2.8-6.1z"
          fill="#fff"
        />
      </svg>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const descStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: "var(--text-1)",
  lineHeight: 1.5,
  margin: 0,
};
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
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid var(--hair-strong)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-1)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};
const backBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 6,
  border: "none",
  background: "transparent",
  color: "var(--text-3)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};
const errorBoxStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.08)",
  color: "var(--z-red)",
  fontSize: 12,
};
const infoBoxStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid oklch(0.70 0.18 160 / 0.35)",
  background: "oklch(0.70 0.18 160 / 0.08)",
  color: "var(--z-green)",
  fontSize: 12,
};
const suggestBoxStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid var(--hair)",
  background: "rgba(255,255,255,0.02)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};
const suggestRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
};
const suggestLabel: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-3)",
};
const suggestValue: React.CSSProperties = {
  fontSize: 12.5,
  color: "var(--text-0)",
  fontFamily: "var(--font-jetbrains-mono)",
  fontWeight: 500,
};
const codeBlockStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 6,
  background: "rgba(0,0,0,0.3)",
  border: "1px solid var(--hair)",
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 13,
  color: "var(--text-0)",
  overflowX: "auto",
  whiteSpace: "nowrap",
};
const inlineCode: React.CSSProperties = {
  padding: "1px 6px",
  borderRadius: 4,
  background: "rgba(0,0,0,0.3)",
  border: "1px solid var(--hair)",
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 11.5,
};
const dividerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10,
  letterSpacing: "0.3em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  margin: "4px 0",
};
const dataGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 8,
};
const dataCellStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid var(--hair)",
  background: "rgba(255,255,255,0.02)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};
const dataLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--text-3)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};
const dataValueStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: "var(--text-0)",
  fontFamily: "var(--font-jetbrains-mono)",
  fontWeight: 500,
  wordBreak: "break-all",
};
const helpBoxStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px dashed var(--hair-strong)",
  background: "rgba(255,255,255,0.015)",
};
const helpTitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-3)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  fontWeight: 600,
  marginBottom: 6,
};
