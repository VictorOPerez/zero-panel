"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Phone,
  Plus,
  X,
  Trash2,
  Layers,
  CheckCircle2,
} from "lucide-react";
import {
  listNumberPool,
  addNumberToPool,
  retirePoolNumber,
  type PoolNumber,
} from "@/lib/api/platform";
import { ApiError } from "@/lib/api/client";

// IDs públicos del Embedded Signup (el App Secret nunca toca el frontend).
const FB_APP_ID = process.env.NEXT_PUBLIC_META_FB_APP_ID ?? "";
const FB_GRAPH_VERSION = process.env.NEXT_PUBLIC_META_FB_GRAPH_VERSION ?? "v22.0";
const ES_CONFIG_ID = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID ?? "";
const FB_SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";

interface SignupPayload {
  code: string;
  phone_number_id: string;
  waba_id: string;
  business_id: string;
}

interface SessionInfoData {
  phone_number_id?: string;
  waba_id?: string;
  business_id?: string;
}

export function NumberPoolSection() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const poolQuery = useQuery({
    queryKey: ["number-pool"],
    queryFn: listNumberPool,
  });

  const numbers = poolQuery.data ?? [];
  const available = numbers.filter((n) => n.status === "available").length;

  return (
    <div
      className="glass"
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid var(--hair)",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Layers size={16} style={{ color: "var(--z-cyan)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>
            Pool de números
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
            Números pre-habilitados en WhatsApp listos para alquilar. El bot de
            onboarding los asigna al cliente nuevo.
          </div>
        </div>
        <span
          style={{
            fontSize: 11.5,
            color: available > 0 ? "var(--z-green)" : "var(--text-3)",
            fontWeight: 600,
            fontFamily: "var(--font-jetbrains-mono)",
          }}
          title="Números disponibles para asignar"
        >
          {available} disponible{available === 1 ? "" : "s"}
        </span>
        <button type="button" onClick={() => setAddOpen(true)} style={primaryBtn}>
          <Plus size={13} /> Agregar al pool
        </button>
      </div>

      {poolQuery.isLoading && (
        <div style={{ fontSize: 12.5, color: "var(--text-3)", padding: "6px 0" }}>
          Cargando pool…
        </div>
      )}

      {poolQuery.isError && (
        <div style={errorStyle}>No pudimos cargar el pool. Reintentá.</div>
      )}

      {poolQuery.data && numbers.length === 0 && (
        <div style={{ fontSize: 12.5, color: "var(--text-3)", padding: "6px 0", lineHeight: 1.5 }}>
          El pool está vacío. Conectá un número que ya hayas habilitado en
          WhatsApp (Embedded Signup) bajo tu infraestructura para dejarlo listo
          para alquilar.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {numbers.map((n) => (
          <PoolNumberLine key={n.id} number={n} />
        ))}
      </div>

      {addOpen && (
        <AddToPoolModal
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            qc.invalidateQueries({ queryKey: ["number-pool"] });
          }}
        />
      )}
    </div>
  );
}

function PoolNumberLine({ number }: { number: PoolNumber }) {
  const qc = useQueryClient();
  const retireMut = useMutation({
    mutationFn: () => retirePoolNumber(number.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["number-pool"] }),
  });

  const tone: ChipTone =
    number.status === "available"
      ? "green"
      : number.status === "assigned"
        ? "cyan"
        : number.status === "reserved"
          ? "amber"
          : "muted";

  const display = number.whatsapp_number
    ? `+${number.whatsapp_number.replace(/^\+/, "")}`
    : `id ${number.phone_number_id}`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        borderRadius: 8,
        border: "1px solid var(--hair)",
        background: "rgba(255,255,255,0.02)",
        flexWrap: "wrap",
      }}
    >
      <Phone size={13} style={{ color: "var(--z-cyan)", flexShrink: 0 }} />
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "var(--font-jetbrains-mono)",
        }}
      >
        {display}
      </span>
      {number.label && (
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{number.label}</span>
      )}
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <Chip label={number.status} tone={tone} />
        {number.status === "available" && (
          <button
            type="button"
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                window.confirm("¿Retirar este número del pool? No se ofrecerá más.")
              ) {
                retireMut.mutate();
              }
            }}
            disabled={retireMut.isPending}
            style={miniGhostBtn}
            title="Retirar del pool"
          >
            {retireMut.isPending ? (
              <Loader2 size={11} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <Trash2 size={11} />
            )}
            Retirar
          </button>
        )}
      </span>
    </div>
  );
}

function AddToPoolModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [label, setLabel] = useState("");
  const [phase, setPhase] = useState<
    "idle" | "loading_sdk" | "popup_open" | "exchanging" | "done"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  // Captura del session_info por postMessage (mismo mecanismo que el card de
  // WhatsApp): usamos refs porque el handler corre fuera del ciclo de render.
  const sessionInfoRef = useRef<SessionInfoData | null>(null);
  const sessionInfoResolverRef = useRef<((d: SessionInfoData | null) => void) | null>(
    null
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }
      if (typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data) as {
          type?: string;
          event?: string;
          data?: SessionInfoData;
        };
        if (parsed.type !== "WA_EMBEDDED_SIGNUP") return;
        if (parsed.event === "FINISH" && parsed.data) {
          sessionInfoRef.current = parsed.data;
          sessionInfoResolverRef.current?.(parsed.data);
          sessionInfoResolverRef.current = null;
        } else if (parsed.event === "CANCEL" || parsed.event === "ERROR") {
          sessionInfoResolverRef.current?.(null);
          sessionInfoResolverRef.current = null;
        }
      } catch {
        /* ignorar no-JSON */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function loadSdk(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).FB) return;
    setPhase("loading_sdk");
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
  }

  const addMut = useMutation({
    mutationFn: (payload: SignupPayload) =>
      addNumberToPool({
        code: payload.code,
        phone_number_id: payload.phone_number_id,
        waba_id: payload.waba_id || undefined,
        business_id: payload.business_id || undefined,
        label: label.trim() || undefined,
      }),
    onSuccess: () => {
      setPhase("done");
      onAdded();
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? typeof err.payload.error === "string"
            ? err.payload.error
            : "No pudimos agregar el número al pool."
          : "No pudimos agregar el número al pool."
      );
      setPhase("idle");
    },
  });

  async function onConnect() {
    setError(null);
    try {
      await loadSdk();
      setPhase("popup_open");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fb = (window as any).FB;
      if (!fb) throw new Error("FB SDK no está cargado");

      const response = await new Promise<{ authResponse?: { code?: string } | null }>(
        (resolve) => {
          fb.login((res: { authResponse?: { code?: string } | null }) => resolve(res), {
            config_id: ES_CONFIG_ID,
            response_type: "code",
            override_default_response_type: true,
          });
        }
      );
      const code = response.authResponse?.code;
      if (!code) {
        setPhase("idle");
        return; // canceló
      }

      let info = sessionInfoRef.current;
      if (!info) {
        info = await new Promise<SessionInfoData | null>((resolve) => {
          sessionInfoResolverRef.current = resolve;
          window.setTimeout(() => {
            if (sessionInfoResolverRef.current === resolve) {
              sessionInfoResolverRef.current = null;
              resolve(sessionInfoRef.current);
            }
          }, 10_000);
        });
      }

      if (!info?.phone_number_id) {
        setError(
          "Meta no devolvió el phone_number_id. Probablemente cancelaste el flujo o no completaste todos los pasos."
        );
        setPhase("idle");
        return;
      }

      setPhase("exchanging");
      addMut.mutate({
        code,
        phone_number_id: info.phone_number_id,
        waba_id: info.waba_id ?? "",
        business_id: info.business_id ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  }

  const busy = phase === "loading_sdk" || phase === "popup_open" || phase === "exchanging";
  const configMissing = !FB_APP_ID || !ES_CONFIG_ID;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      style={overlayStyle}
    >
      <div
        className="glass"
        style={{
          width: "min(520px, 100%)",
          borderRadius: 12,
          border: "1px solid var(--hair-strong)",
          background: "var(--surface-1, rgba(15,15,20,0.96))",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: "1px solid var(--hair)",
          }}
        >
          <Layers size={15} style={{ color: "var(--z-cyan)" }} />
          <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Agregar número al pool</div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" style={iconBtn}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: 18 }}>
          {phase === "done" ? (
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                border: "1px solid oklch(0.78 0.15 155 / 0.35)",
                background: "oklch(0.78 0.15 155 / 0.07)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <CheckCircle2 size={17} style={{ color: "var(--z-green)" }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>
                  Número agregado al pool
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
                Quedó disponible para que el bot de onboarding se lo asigne al
                próximo cliente.
              </div>
              <button type="button" onClick={onClose} style={{ ...primaryBtn, alignSelf: "flex-start" }}>
                Listo
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, margin: "0 0 14px" }}>
                Conectá un número que vayas a alquilar usando el flujo oficial de
                Meta (Embedded Signup) bajo tu infraestructura. Guardamos sus
                credenciales en el pool <strong>sin asignarlo</strong> a ningún
                negocio todavía.
              </p>

              <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontWeight: 600,
                  }}
                >
                  Etiqueta (opcional · solo para vos)
                </span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Número Miami · lote 1"
                  style={inputStyle}
                  disabled={busy}
                />
              </label>

              {configMissing && (
                <div style={{ ...errorStyle }}>
                  Falta NEXT_PUBLIC_META_FB_APP_ID o
                  NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID en el frontend.
                </div>
              )}
              {error && <div style={errorStyle}>{error}</div>}

              <button
                type="button"
                onClick={onConnect}
                disabled={busy || configMissing}
                style={{
                  ...fbBtn,
                  opacity: busy || configMissing ? 0.6 : 1,
                  cursor: busy || configMissing ? "not-allowed" : "pointer",
                }}
              >
                {busy && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                {phase === "loading_sdk"
                  ? "Cargando SDK…"
                  : phase === "popup_open"
                    ? "Esperando autorización…"
                    : phase === "exchanging"
                      ? "Guardando en el pool…"
                      : "Conectar con Facebook"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── estilos ──────────────────────────────────

type ChipTone = "cyan" | "green" | "amber" | "muted";

function Chip({ label, tone }: { label: string; tone: ChipTone }) {
  const map: Record<ChipTone, { color: string; bg: string; border: string }> = {
    cyan: {
      color: "oklch(0.80 0.13 200)",
      bg: "oklch(0.80 0.13 200 / 0.10)",
      border: "oklch(0.80 0.13 200 / 0.4)",
    },
    green: {
      color: "oklch(0.78 0.18 145)",
      bg: "oklch(0.78 0.18 145 / 0.12)",
      border: "oklch(0.78 0.18 145 / 0.4)",
    },
    amber: {
      color: "oklch(0.85 0.18 90)",
      bg: "oklch(0.85 0.18 90 / 0.10)",
      border: "oklch(0.85 0.18 90 / 0.4)",
    },
    muted: {
      color: "var(--text-3)",
      bg: "rgba(255,255,255,0.04)",
      border: "var(--hair)",
    },
  };
  const cfg = map[tone];
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "var(--font-jetbrains-mono)",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {label}
    </span>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(6px)",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

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

const fbBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  background: "#1877F2",
  color: "white",
  fontSize: 13,
  fontWeight: 600,
};

const miniGhostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 9px",
  borderRadius: 5,
  border: "1px solid var(--hair)",
  background: "transparent",
  color: "var(--text-1)",
  fontSize: 11,
  fontWeight: 500,
  cursor: "pointer",
};

const iconBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  borderRadius: 6,
  border: "1px solid var(--hair)",
  background: "transparent",
  color: "var(--text-3)",
  cursor: "pointer",
  flexShrink: 0,
};

const errorStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.08)",
  color: "var(--z-red)",
  fontSize: 12.5,
  marginBottom: 12,
};
