"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, X } from "lucide-react";
import { api } from "@/lib/api/client";

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
  initialPhoneNumberId?: string;
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

export function WhatsappBusinessCard({ tenantId, initialPhoneNumberId, onConnected }: Props) {
  const [state, setState] = useState<State>(
    initialPhoneNumberId
      ? { kind: "connected", phoneNumberId: initialPhoneNumberId }
      : FB_APP_ID && ES_CONFIG_ID
        ? { kind: "idle" }
        : {
            kind: "error",
            message:
              "Falta NEXT_PUBLIC_META_FB_APP_ID o NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID en el frontend.",
          }
  );

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
      onConnected?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ kind: "error", message });
    }
  }

  async function onDisconnect() {
    try {
      await api.post(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/whatsapp-cloud/disconnect`,
        {}
      );
      sessionInfoRef.current = null;
      setState({ kind: "idle" });
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
