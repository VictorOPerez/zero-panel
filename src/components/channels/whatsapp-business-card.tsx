"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MessageCircle, Power, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { getTenant } from "@/lib/api/tenants";
import { setWhatsappBotEnabled } from "@/lib/api/whatsapp";

// Tipos minimos del SDK de Facebook (no hay @types oficial completo)
declare global {
  interface Window {
    FB?: {
      init(opts: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }): void;
      login(
        callback: (response: FbLoginResponse) => void,
        opts: {
          config_id: string;
          response_type: "code";
          override_default_response_type: true;
          extras?: { setup?: Record<string, unknown>; featureType?: string; sessionInfoVersion?: string };
        }
      ): void;
    };
    fbAsyncInit?: () => void;
  }
}

interface FbLoginResponse {
  authResponse?: {
    code?: string;
  } | null;
  status?: string;
}

interface EmbeddedSignupSessionData {
  type: "WA_EMBEDDED_SIGNUP";
  event: "FINISH" | "CANCEL" | "ERROR";
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    business_id?: string;
  };
  version?: string;
}

const FB_SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";

// IDs publicos: viven en NEXT_PUBLIC_* porque el SDK los expone igualmente
// en el browser. El App Secret nunca toca el frontend (intercambio en backend).
const FB_APP_ID = process.env.NEXT_PUBLIC_META_FB_APP_ID ?? "";
const FB_GRAPH_VERSION = process.env.NEXT_PUBLIC_META_FB_GRAPH_VERSION ?? "v22.0";
const ES_CONFIG_ID = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID ?? "";

interface Props {
  tenantId: string;
  onConnected?: () => void;
}

type State =
  | { kind: "idle" }
  | { kind: "loading_sdk" }
  | { kind: "ready" }
  | { kind: "popup_open" }
  | { kind: "exchanging" }
  | { kind: "connected"; phoneNumberId: string; wabaId?: string }
  | { kind: "error"; message: string };

export function WhatsappBusinessCard({ tenantId, onConnected }: Props) {
  const qc = useQueryClient();

  // Hidratamos el estado desde la DB al montar — asi un refresh de pagina
  // no pierde el "conectado" entre sesiones. La query es la misma key que usa
  // BusinessQuickEdit en IntegrationsView, asi que React Query la dedupe.
  const tenantQuery = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => getTenant(tenantId).then((r) => r.tenant),
  });
  const waConfig = tenantQuery.data?.channels?.whatsapp;
  const persistedPhoneId = waConfig?.wa_cloud_phone_number_id ?? "";
  const persistedWabaId = waConfig?.wa_cloud_waba_id ?? "";
  const persistedBotEnabled = waConfig?.bot_enabled ?? true;

  const [state, setState] = useState<State>(
    FB_APP_ID && ES_CONFIG_ID
      ? { kind: "idle" }
      : {
          kind: "error",
          message:
            "Falta NEXT_PUBLIC_META_FB_APP_ID o NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID en el frontend.",
        }
  );

  // Cuando llegan datos de la DB y todavia no estamos en un flujo activo
  // (popup_open / exchanging), reflejamos el estado real.
  useEffect(() => {
    if (!tenantQuery.isSuccess) return;
    if (
      state.kind === "popup_open" ||
      state.kind === "exchanging" ||
      state.kind === "loading_sdk"
    ) {
      return;
    }
    if (persistedPhoneId) {
      setState({
        kind: "connected",
        phoneNumberId: persistedPhoneId,
        wabaId: persistedWabaId || undefined,
      });
    } else if (state.kind === "connected") {
      // DB dice que no esta conectado pero el state local si — desconexion
      // ocurrida en otra pestaña. Volvemos a idle.
      setState({ kind: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantQuery.isSuccess, persistedPhoneId, persistedWabaId]);

  const botToggle = useMutation({
    mutationFn: (next: boolean) => setWhatsappBotEnabled(tenantId, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
    },
  });

  // Captura del payload session_info del Embedded Signup. Llega via window.postMessage
  // desde el iframe de Meta y trae phone_number_id + waba_id + business_id.
  // Usamos ref (no state) porque el handler corre fuera del ciclo de render —
  // el while loop dentro de onConnect leeria un valor stale de la closure si
  // usaramos useState. Con ref podemos leer el valor mas reciente sincronamente.
  const sessionInfoRef = useRef<EmbeddedSignupSessionData["data"] | null>(null);
  // Se setea por onConnect cuando empieza a esperar el FINISH; el listener lo
  // resuelve apenas llega el postMessage para no perder ms.
  const sessionInfoResolverRef = useRef<
    ((data: EmbeddedSignupSessionData["data"] | null) => void) | null
  >(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Origen oficial del Embedded Signup
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
        return;
      }
      if (typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data) as EmbeddedSignupSessionData;
        if (parsed.type !== "WA_EMBEDDED_SIGNUP") return;
        if (parsed.event === "FINISH" && parsed.data) {
          sessionInfoRef.current = parsed.data;
          sessionInfoResolverRef.current?.(parsed.data);
          sessionInfoResolverRef.current = null;
        } else if (parsed.event === "CANCEL") {
          sessionInfoResolverRef.current?.(null);
          sessionInfoResolverRef.current = null;
          setState({ kind: "ready" });
        } else if (parsed.event === "ERROR") {
          sessionInfoResolverRef.current?.(null);
          sessionInfoResolverRef.current = null;
          setState({ kind: "error", message: "Meta reporto un error en el flujo." });
        }
      } catch {
        // ignorar mensajes no-JSON
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function loadSdk(): Promise<void> {
    if (window.FB) return;
    setState({ kind: "loading_sdk" });
    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById("fb-sdk") as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("FB SDK falló al cargar")), {
          once: true,
        });
        return;
      }
      const script = document.createElement("script");
      script.id = "fb-sdk";
      script.src = FB_SDK_SRC;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("FB SDK falló al cargar"));
      document.body.appendChild(script);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fb = (window as any).FB;
    if (!fb) throw new Error("FB SDK no expuso window.FB");
    fb.init({
      appId: FB_APP_ID,
      autoLogAppEvents: true,
      xfbml: false,
      version: FB_GRAPH_VERSION,
    });
    setState({ kind: "ready" });
  }

  async function onConnect() {
    try {
      await loadSdk();
      setState({ kind: "popup_open" });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fb = (window as any).FB;
      if (!fb) throw new Error("FB SDK no esta cargado");
      const response = await new Promise<FbLoginResponse>((resolve) => {
        fb.login((res: FbLoginResponse) => resolve(res), {
          config_id: ES_CONFIG_ID,
          response_type: "code",
          override_default_response_type: true,
        });
      });

      const code = response.authResponse?.code;
      if (!code) {
        // Usuario canceló o error en el popup.
        setState({ kind: "ready" });
        return;
      }

      // Esperamos al session_info por postMessage. Resolvemos via ref+promise
      // para no leer state stale de la closure. El postMessage suele llegar
      // antes de que FB.login retorne — chequeamos primero el ref por si ya
      // esta seteado, sino esperamos hasta 10s.
      let info = sessionInfoRef.current;
      if (!info) {
        info = await new Promise<EmbeddedSignupSessionData["data"] | null>(
          (resolve) => {
            sessionInfoResolverRef.current = resolve;
            window.setTimeout(() => {
              if (sessionInfoResolverRef.current === resolve) {
                sessionInfoResolverRef.current = null;
                resolve(sessionInfoRef.current);
              }
            }, 10_000);
          }
        );
      }

      if (!info?.phone_number_id) {
        setState({
          kind: "error",
          message:
            "Meta no devolvio el phone_number_id. Probablemente cancelaste el flujo o no completaste todos los pasos.",
        });
        return;
      }

      setState({ kind: "exchanging" });

      const result = await api.post<{
        ok: true;
        whatsapp: { connected: boolean; phone_number_id: string; waba_id?: string };
      }>(`/api/admin/tenants/${encodeURIComponent(tenantId)}/whatsapp-cloud/onboard`, {
        code,
        phone_number_id: info.phone_number_id,
        waba_id: info.waba_id ?? "",
        business_id: info.business_id ?? "",
      });

      setState({
        kind: "connected",
        phoneNumberId: result.whatsapp.phone_number_id,
        wabaId: result.whatsapp.waba_id,
      });
      // Refrescar el tenant cache asi el card persiste "conectado" entre refreshes.
      qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
      onConnected?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ kind: "error", message });
    }
  }

  async function onDisconnect() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "¿Desconectar WhatsApp? Vas a perder la conexión con Meta y el bot dejará de recibir mensajes hasta que vuelvas a conectar."
      )
    ) {
      return;
    }
    try {
      await api.post(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/whatsapp-cloud/disconnect`,
        {}
      );
      sessionInfoRef.current = null;
      setState({ kind: "idle" });
      qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ kind: "error", message });
    }
  }

  return (
    <div
      className="glass"
      style={{ padding: 18, borderRadius: 10, display: "flex", flexDirection: "column", gap: 14 }}
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
            API oficial de Meta
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
            Numero conectado: <strong style={{ color: "var(--text-0)" }}>{state.phoneNumberId}</strong>
            {state.wabaId && (
              <>
                <br />WABA ID: <code style={{ fontSize: 11 }}>{state.wabaId}</code>
              </>
            )}
          </div>

          {/* Toggle Bot ON/OFF */}
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
                    ? "Responde automáticamente a los clientes"
                    : "No responde — los mensajes igual llegan al inbox"}
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
            <X size={12} /> Desconectar de Meta
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, margin: 0 }}>
            Conectá tu número en segundos con el flujo oficial de Meta. Sin escanear QR ni códigos
            de emparejamiento — abrís Facebook, autorizás y listo.
          </p>

          <button
            type="button"
            onClick={onConnect}
            disabled={
              state.kind === "loading_sdk" ||
              state.kind === "popup_open" ||
              state.kind === "exchanging" ||
              !FB_APP_ID ||
              !ES_CONFIG_ID
            }
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "#1877F2",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor:
                state.kind === "loading_sdk" ||
                state.kind === "popup_open" ||
                state.kind === "exchanging" ||
                !FB_APP_ID ||
                !ES_CONFIG_ID
                  ? "not-allowed"
                  : "pointer",
              opacity:
                !FB_APP_ID || !ES_CONFIG_ID || state.kind === "loading_sdk"
                  ? 0.6
                  : 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {state.kind === "loading_sdk" && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {state.kind === "popup_open" && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {state.kind === "exchanging" && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {state.kind === "loading_sdk"
              ? "Cargando SDK..."
              : state.kind === "popup_open"
                ? "Esperando autorizacion..."
                : state.kind === "exchanging"
                  ? "Conectando..."
                  : "Conectar con Facebook"}
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
