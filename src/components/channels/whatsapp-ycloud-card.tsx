"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MessageCircle, Power, X } from "lucide-react";
import { getTenant } from "@/lib/api/tenants";
import { setWhatsappBotEnabled } from "@/lib/api/whatsapp";
import { onboardYCloud, disconnectYCloud } from "@/lib/api/ycloud";
import { WhatsappBlockedContacts } from "./whatsapp-blocked-contacts";

// Vars de YCloud expuestas al frontend. La API key NUNCA se expone — solo el
// app id y el "signup widget" id que YCloud da para abrir su modal de signup.
const YCLOUD_APP_ID = process.env.NEXT_PUBLIC_YCLOUD_APP_ID ?? "";
const YCLOUD_SIGNUP_URL =
  process.env.NEXT_PUBLIC_YCLOUD_SIGNUP_URL ?? "https://app.ycloud.com/signup-widget";

interface YCloudSignupMessage {
  type: "YCLOUD_SIGNUP_DONE" | "YCLOUD_SIGNUP_CANCEL" | "YCLOUD_SIGNUP_ERROR";
  data?: {
    channel_id?: string;
    phone_number?: string;
    waba_id?: string;
    error?: string;
  };
}

interface Props {
  tenantId: string;
  onConnected?: () => void;
}

type State =
  | { kind: "idle" }
  | { kind: "popup_open" }
  | { kind: "exchanging" }
  | {
      kind: "connected";
      channelId: string;
      phoneNumber: string;
      wabaId?: string;
    }
  | { kind: "error"; message: string };

export function WhatsappYCloudCard({ tenantId, onConnected }: Props) {
  const qc = useQueryClient();

  // Hidratamos desde DB al montar — un refresh no pierde el "conectado".
  const tenantQuery = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => getTenant(tenantId).then((r) => r.tenant),
  });
  const waConfig = tenantQuery.data?.channels?.whatsapp;
  const persistedChannelId = waConfig?.ycloud_channel_id ?? "";
  const persistedPhone = waConfig?.ycloud_phone_number ?? "";
  const persistedWabaId = waConfig?.ycloud_waba_id ?? "";
  const persistedBotEnabled = waConfig?.bot_enabled ?? true;
  const persistedBlockedContacts = waConfig?.bot_blocked_contacts ?? [];

  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (!tenantQuery.isSuccess) return;
    if (state.kind === "popup_open" || state.kind === "exchanging") return;
    if (persistedChannelId) {
      setState({
        kind: "connected",
        channelId: persistedChannelId,
        phoneNumber: persistedPhone,
        wabaId: persistedWabaId || undefined,
      });
    } else if (state.kind === "connected") {
      setState({ kind: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantQuery.isSuccess, persistedChannelId, persistedPhone, persistedWabaId]);

  // El popup de YCloud nos manda postMessage al volver. Usamos ref+promise
  // para evitar el bug de closure stale (mismo patrón que el card Meta).
  const popupRef = useRef<Window | null>(null);
  const signupResolverRef = useRef<
    ((data: YCloudSignupMessage["data"] | null) => void) | null
  >(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Origen oficial de YCloud — ajustar si su dominio es distinto al ver
      // el primer mensaje real durante testing.
      const allowedOrigins = ["https://app.ycloud.com", "https://www.ycloud.com"];
      if (!allowedOrigins.some((o) => event.origin === o)) return;

      const parsed: YCloudSignupMessage =
        typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (!parsed?.type?.startsWith("YCLOUD_SIGNUP_")) return;

      if (parsed.type === "YCLOUD_SIGNUP_DONE") {
        signupResolverRef.current?.(parsed.data ?? null);
        signupResolverRef.current = null;
      } else if (parsed.type === "YCLOUD_SIGNUP_CANCEL") {
        signupResolverRef.current?.(null);
        signupResolverRef.current = null;
        setState({ kind: "idle" });
      } else if (parsed.type === "YCLOUD_SIGNUP_ERROR") {
        signupResolverRef.current?.(null);
        signupResolverRef.current = null;
        setState({
          kind: "error",
          message: parsed.data?.error ?? "YCloud reportó un error en el flujo.",
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const botToggle = useMutation({
    mutationFn: (next: boolean) => setWhatsappBotEnabled(tenantId, next),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", tenantId] }),
  });

  async function onConnect() {
    if (!YCLOUD_APP_ID) {
      setState({
        kind: "error",
        message: "Falta NEXT_PUBLIC_YCLOUD_APP_ID en el frontend.",
      });
      return;
    }
    setState({ kind: "popup_open" });

    // Abre el signup widget de YCloud en una pestaña nueva.
    // YCloud va a redirigir al final del flujo y mandar postMessage a la
    // ventana padre con channel_id + phone_number + waba_id.
    const url =
      `${YCLOUD_SIGNUP_URL}?app_id=${encodeURIComponent(YCLOUD_APP_ID)}` +
      `&tenant_ref=${encodeURIComponent(tenantId)}`;
    popupRef.current = window.open(url, "ycloud-signup", "width=600,height=720");

    if (!popupRef.current) {
      setState({
        kind: "error",
        message: "El navegador bloqueó el popup. Permitilo y reintentá.",
      });
      return;
    }

    // Esperamos el postMessage del callback (max 5min — el wizard de YCloud
    // puede tardar si el cliente se distrae verificando el número).
    const data = await new Promise<YCloudSignupMessage["data"] | null>(
      (resolve) => {
        signupResolverRef.current = resolve;
        // Vigilamos cierre del popup sin completar
        const watchInterval = setInterval(() => {
          if (popupRef.current?.closed) {
            clearInterval(watchInterval);
            if (signupResolverRef.current === resolve) {
              signupResolverRef.current = null;
              resolve(null);
            }
          }
        }, 1000);
        // Timeout absoluto 5min
        setTimeout(() => {
          clearInterval(watchInterval);
          if (signupResolverRef.current === resolve) {
            signupResolverRef.current = null;
            resolve(null);
          }
        }, 5 * 60 * 1000);
      }
    );

    if (!data?.channel_id || !data?.phone_number) {
      setState({ kind: "idle" });
      return;
    }

    setState({ kind: "exchanging" });

    try {
      const result = await onboardYCloud(tenantId, {
        channel_id: data.channel_id,
        phone_number: data.phone_number,
        waba_id: data.waba_id,
      });
      setState({
        kind: "connected",
        channelId: result.whatsapp.channel_id,
        phoneNumber: result.whatsapp.phone_number,
        wabaId: result.whatsapp.waba_id,
      });
      qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
      onConnected?.();
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function onDisconnect() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "¿Desconectar WhatsApp? El bot deja de recibir mensajes hasta que vuelvas a conectar. Tu WhatsApp Business app del celular sigue funcionando normal."
      )
    ) {
      return;
    }
    try {
      await disconnectYCloud(tenantId);
      setState({ kind: "idle" });
      qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div
      className="glass"
      style={{
        padding: 18,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
      role="listitem"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: "rgba(37, 211, 102, 0.12)",
            border: "1px solid rgba(37, 211, 102, 0.4)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#25D366",
          }}
        >
          <MessageCircle size={18} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>
            WhatsApp Business
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Coexistence — mantenés tu app del cel
          </div>
        </div>
        {state.kind === "connected" && (
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "var(--z-green, #25D366)",
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={12} /> conectado
          </span>
        )}
      </div>

      {state.kind === "connected" ? (
        <>
          <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
            Número conectado: <strong style={{ color: "var(--text-0)" }}>{state.phoneNumber}</strong>
            {state.wabaId && (
              <>
                <br />WABA ID: <code style={{ fontSize: 11 }}>{state.wabaId}</code>
              </>
            )}
            <br />
            <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
              Tu WhatsApp Business app sigue funcionando — el bot opera en paralelo.
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--hair)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Power
                size={14}
                style={{
                  color: persistedBotEnabled
                    ? "var(--z-green, #25D366)"
                    : "var(--text-3)",
                }}
              />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {persistedBotEnabled ? "Bot activo" : "Bot pausado"}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {persistedBotEnabled
                    ? "Responde automáticamente"
                    : "No responde — los mensajes llegan al inbox"}
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={persistedBotEnabled}
              disabled={botToggle.isPending}
              onClick={() => botToggle.mutate(!persistedBotEnabled)}
              style={{
                position: "relative",
                width: 38,
                height: 22,
                borderRadius: 999,
                border: "none",
                background: persistedBotEnabled
                  ? "var(--z-green, #25D366)"
                  : "rgba(255,255,255,0.12)",
                cursor: botToggle.isPending ? "wait" : "pointer",
                transition: "background 0.15s",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: persistedBotEnabled ? 18 : 2,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.15s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }}
              />
            </button>
          </div>

          <WhatsappBlockedContacts
            tenantId={tenantId}
            current={persistedBlockedContacts}
          />

          <button
            type="button"
            onClick={onDisconnect}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--hair)",
              background: "transparent",
              color: "var(--text-2)",
              fontSize: 12,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <X size={12} /> Desconectar
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, margin: 0 }}>
            Conectá tu número de WhatsApp Business <strong>sin perder tu app</strong>. El bot
            responde por encima — vos seguís viendo todo en tu cel y podés intervenir
            cuando quieras.
          </p>

          <button
            type="button"
            onClick={onConnect}
            disabled={state.kind === "popup_open" || state.kind === "exchanging"}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "#25D366",
              color: "#0a0a0f",
              fontSize: 13,
              fontWeight: 600,
              cursor:
                state.kind === "popup_open" || state.kind === "exchanging"
                  ? "wait"
                  : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {(state.kind === "popup_open" || state.kind === "exchanging") && (
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            )}
            {state.kind === "popup_open"
              ? "Esperando autorización..."
              : state.kind === "exchanging"
                ? "Conectando..."
                : "Conectar WhatsApp"}
          </button>

          {state.kind === "error" && (
            <div
              role="alert"
              style={{
                fontSize: 12,
                color: "var(--z-red, #ef4444)",
                padding: 8,
                borderRadius: 6,
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              {state.message}
            </div>
          )}
        </>
      )}
    </div>
  );
}
