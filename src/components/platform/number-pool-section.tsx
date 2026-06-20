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
  PhoneForwarded,
  MessageCircle,
  Search,
  Undo2,
} from "lucide-react";
import {
  listNumberPool,
  retirePoolNumber,
  searchPoolNumbers,
  provisionPoolNumber,
  setPoolForward,
  connectPoolWhatsapp,
  connectPoolWhatsappManual,
  reclaimPoolNumber,
  type PoolNumber,
  type AvailableToBuy,
} from "@/lib/api/platform";
import { ApiError } from "@/lib/api/client";

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

// Hook reutilizable: lanza el Embedded Signup de Meta y resuelve el payload
// (code + phone_number_id + waba_id). Lo usan "Conectar WhatsApp" y "Agregar
// existente". El App Secret nunca toca el frontend (intercambio en backend).
function useEmbeddedSignup() {
  const sessionInfoRef = useRef<SessionInfoData | null>(null);
  const resolverRef = useRef<((d: SessionInfoData | null) => void) | null>(null);
  const [busy, setBusy] = useState(false);

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
          resolverRef.current?.(parsed.data);
          resolverRef.current = null;
        } else if (parsed.event === "CANCEL" || parsed.event === "ERROR") {
          resolverRef.current?.(null);
          resolverRef.current = null;
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function loadSdk(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).FB) return;
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
    fb.init({ appId: FB_APP_ID, autoLogAppEvents: true, xfbml: false, version: FB_GRAPH_VERSION });
  }

  async function launch(): Promise<SignupPayload | null> {
    setBusy(true);
    sessionInfoRef.current = null;
    try {
      await loadSdk();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fb = (window as any).FB;
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
      if (!code) return null;
      let info: SessionInfoData | null = sessionInfoRef.current;
      if (!info) {
        info = await new Promise<SessionInfoData | null>((resolve) => {
          resolverRef.current = resolve;
          window.setTimeout(() => {
            if (resolverRef.current === resolve) {
              resolverRef.current = null;
              resolve(sessionInfoRef.current);
            }
          }, 10_000);
        });
      }
      if (!info?.phone_number_id) {
        throw new Error("Meta no devolvió el phone_number_id (¿cancelaste el flujo?).");
      }
      return {
        code,
        phone_number_id: info.phone_number_id,
        waba_id: info.waba_id ?? "",
        business_id: info.business_id ?? "",
      };
    } finally {
      setBusy(false);
    }
  }

  return { launch, busy, configMissing: !FB_APP_ID || !ES_CONFIG_ID };
}

export function NumberPoolSection() {
  const qc = useQueryClient();
  const [buyOpen, setBuyOpen] = useState(false);
  const [connectFor, setConnectFor] = useState<PoolNumber | null>(null);

  const poolQuery = useQuery({ queryKey: ["number-pool"], queryFn: listNumberPool });
  const numbers = poolQuery.data ?? [];
  const available = numbers.filter((n) => n.status === "available").length;
  const refresh = () => qc.invalidateQueries({ queryKey: ["number-pool"] });

  return (
    <div
      className="glass"
      style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--hair)", marginBottom: 14 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <Layers size={16} style={{ color: "var(--z-cyan)" }} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>Pool de números</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
            Comprá números, conectalos a WhatsApp y dejalos listos para alquilar. El
            bot los asigna solo al cliente nuevo.
          </div>
        </div>
        <span
          style={{
            fontSize: 11.5,
            color: available > 0 ? "var(--z-green)" : "var(--text-3)",
            fontWeight: 600,
            fontFamily: "var(--font-jetbrains-mono)",
          }}
        >
          {available} disponible{available === 1 ? "" : "s"}
        </span>
        <button type="button" onClick={() => setBuyOpen(true)} style={primaryBtn}>
          <Plus size={13} /> Comprar número
        </button>
      </div>

      {poolQuery.isLoading && (
        <div style={{ fontSize: 12.5, color: "var(--text-3)", padding: "6px 0" }}>Cargando pool…</div>
      )}
      {poolQuery.isError && <div style={errorStyle}>No pudimos cargar el pool. Reintentá.</div>}
      {poolQuery.data && numbers.length === 0 && (
        <div style={{ fontSize: 12.5, color: "var(--text-3)", padding: "6px 0", lineHeight: 1.5 }}>
          El pool está vacío. Comprá un número para empezar a armar tu inventario.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {numbers.map((n) => (
          <PoolNumberLine
            key={n.id}
            number={n}
            onConnect={() => setConnectFor(n)}
            onChanged={refresh}
          />
        ))}
      </div>

      {buyOpen && <BuyModal onClose={() => setBuyOpen(false)} onDone={refresh} />}
      {connectFor && (
        <ConnectModal
          number={connectFor}
          onClose={() => setConnectFor(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
}

function PoolNumberLine({
  number,
  onConnect,
  onChanged,
}: {
  number: PoolNumber;
  onConnect: () => void;
  onChanged: () => void;
}) {
  const [forward, setForward] = useState(number.forward_to_phone ?? "");
  const [lastServer, setLastServer] = useState(number.forward_to_phone);
  if (lastServer !== number.forward_to_phone) {
    setLastServer(number.forward_to_phone);
    setForward(number.forward_to_phone ?? "");
  }

  const forwardMut = useMutation({
    mutationFn: (v: string | null) => setPoolForward(number.id, v),
    onSuccess: onChanged,
  });
  const retireMut = useMutation({
    mutationFn: () => retirePoolNumber(number.id),
    onSuccess: onChanged,
  });
  const reclaimMut = useMutation({
    mutationFn: () => reclaimPoolNumber(number.id),
    onSuccess: onChanged,
  });

  const tone: ChipTone =
    number.status === "available"
      ? "green"
      : number.status === "assigned"
        ? "cyan"
        : number.status === "provisioning"
          ? "amber"
          : number.status === "reserved"
            ? "amber"
            : "muted";

  const display =
    (number.whatsapp_number && `+${number.whatsapp_number.replace(/^\+/, "")}`) ||
    (number.phone_e164 && `+${number.phone_e164.replace(/^\+/, "")}`) ||
    (number.phone_number_id ? `id ${number.phone_number_id}` : "—");

  const dirty = forward.trim() !== (number.forward_to_phone ?? "");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid var(--hair)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Phone size={13} style={{ color: "var(--z-cyan)", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-jetbrains-mono)" }}>
          {display}
        </span>
        {number.label && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{number.label}</span>}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Chip label={statusLabel(number.status)} tone={tone} />
          {number.status === "assigned" && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("¿Devolver este número al pool? Se desconecta del negocio actual y queda disponible para alquilar a otro."))
                  reclaimMut.mutate();
              }}
              disabled={reclaimMut.isPending}
              style={miniGhostBtn}
              title="Devolver al pool"
            >
              {reclaimMut.isPending ? <Spin /> : <Undo2 size={11} />} Devolver
            </button>
          )}
          {(number.status === "provisioning" || number.status === "available") && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("¿Retirar este número del pool? No se ofrecerá más."))
                  retireMut.mutate();
              }}
              disabled={retireMut.isPending}
              style={miniGhostBtn}
              title="Retirar del pool"
            >
              {retireMut.isPending ? <Spin /> : <Trash2 size={11} />} Retirar
            </button>
          )}
        </span>
      </div>

      {/* Acciones de un número comprado pero sin WhatsApp todavía */}
      {number.status === "provisioning" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={miniLabel}>
            <PhoneForwarded size={11} /> Reenvío
          </span>
          <input
            type="tel"
            value={forward}
            onChange={(e) => setForward(e.target.value)}
            placeholder="tu celular para Meta"
            style={{ ...inputStyle, width: 170, padding: "5px 8px", fontSize: 12 }}
            disabled={forwardMut.isPending}
          />
          {dirty && (
            <button
              type="button"
              onClick={() => forwardMut.mutate(forward.trim() || null)}
              disabled={forwardMut.isPending}
              style={miniPrimaryBtn}
            >
              {forwardMut.isPending ? <Spin /> : <CheckCircle2 size={11} />} Guardar
            </button>
          )}
          <button type="button" onClick={onConnect} style={{ ...fbMiniBtn }}>
            <MessageCircle size={12} /> Conectar WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}

// ── Comprar número (search + provision) ────────────────────────────────────
function BuyModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [areaCode, setAreaCode] = useState("");
  const [results, setResults] = useState<AvailableToBuy[] | null>(null);
  const [selected, setSelected] = useState<AvailableToBuy | null>(null);
  const [forward, setForward] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const searchMut = useMutation({
    mutationFn: () => searchPoolNumbers("US", areaCode.trim() || undefined),
    onSuccess: (items) => {
      setResults(items);
      setSelected(items[0] ?? null);
      setError(null);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError && err.payload.error === "provider_missing_key"
          ? "Falta TELNYX_API_KEY en el backend."
          : "Error buscando números."
      ),
  });

  const buyMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("no_selection");
      return provisionPoolNumber({
        phone_e164: selected.phone_e164,
        country: selected.country,
        forward_to_phone: forward.trim() || undefined,
      });
    },
    onSuccess: () => {
      setDone(true);
      onDone();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? typeof err.payload.detail === "string"
            ? err.payload.detail
            : err.payload.error
          : "No pudimos comprar el número."
      ),
  });

  useEffect(() => {
    searchMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModalShell title="Comprar número al pool" onClose={onClose} busy={buyMut.isPending}>
      <div style={{ padding: 18 }}>
        {done ? (
          <div style={okBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <CheckCircle2 size={17} style={{ color: "var(--z-green)" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Número comprado</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
              Quedó en el pool como <strong>comprado</strong>. Ahora poné tu celular
              en el reenvío y tocá <strong>Conectar WhatsApp</strong> para hacer el
              Embedded Signup (la verificación por voz suena en tu cel).
            </div>
            <button type="button" onClick={onClose} style={{ ...primaryBtn, marginTop: 14 }}>
              Listo
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end", marginBottom: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={miniLabel}>Area code (opcional · US)</span>
                <input
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="305"
                  inputMode="numeric"
                  style={inputStyle}
                  disabled={searchMut.isPending}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  searchMut.mutate();
                }}
                disabled={searchMut.isPending}
                style={primaryBtn}
              >
                {searchMut.isPending ? <Spin /> : <Search size={13} />} Buscar
              </button>
            </div>

            {error && <div style={errorStyle}>{error}</div>}
            {results && results.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Sin resultados. Probá otro area code.</div>
            )}

            {results && results.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                {results.map((item) => {
                  const isSel = selected?.phone_e164 === item.phone_e164;
                  return (
                    <button
                      key={item.phone_e164}
                      type="button"
                      onClick={() => setSelected(item)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 12px",
                        borderRadius: 8,
                        border: isSel ? "1px solid var(--z-cyan)" : "1px solid var(--hair)",
                        background: isSel ? "oklch(0.80 0.13 200 / 0.08)" : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        color: "var(--text-0)",
                      }}
                    >
                      <Phone size={13} style={{ color: isSel ? "var(--z-cyan)" : "var(--text-3)" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-jetbrains-mono)" }}>
                          +{item.phone_e164}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{item.region || item.country}</div>
                      </div>
                      {isSel && <CheckCircle2 size={14} style={{ color: "var(--z-cyan)" }} />}
                    </button>
                  );
                })}
              </div>
            )}

            {selected && (
              <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 14 }}>
                <span style={miniLabel}>Tu celular para la verificación de Meta (opcional)</span>
                <input
                  type="tel"
                  value={forward}
                  onChange={(e) => setForward(e.target.value)}
                  placeholder="+13526021604"
                  style={inputStyle}
                />
              </label>
            )}
          </>
        )}
      </div>
      {!done && (
        <ModalFooter>
          <button type="button" onClick={onClose} disabled={buyMut.isPending} style={ghostBtn}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => buyMut.mutate()}
            disabled={!selected || buyMut.isPending}
            style={{ ...primaryBtn, opacity: !selected ? 0.5 : 1 }}
          >
            {buyMut.isPending ? <Spin /> : <CheckCircle2 size={13} />}
            {selected ? `Comprar +${selected.phone_e164}` : "Comprar"}
          </button>
        </ModalFooter>
      )}
    </ModalShell>
  );
}

// ── Conectar WhatsApp a un número del pool (Embedded Signup) ────────────────
function ConnectModal({
  number,
  onClose,
  onDone,
}: {
  number: PoolNumber;
  onClose: () => void;
  onDone: () => void;
}) {
  const { launch, busy, configMissing } = useEmbeddedSignup();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const connectMut = useMutation({
    mutationFn: (payload: SignupPayload) =>
      connectPoolWhatsapp(number.id, {
        code: payload.code,
        phone_number_id: payload.phone_number_id,
        waba_id: payload.waba_id || undefined,
        business_id: payload.business_id || undefined,
      }),
    onSuccess: () => {
      setDone(true);
      onDone();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? typeof err.payload.error === "string"
            ? err.payload.error
            : "No pudimos conectar WhatsApp."
          : "No pudimos conectar WhatsApp."
      ),
  });

  async function onConnect() {
    setError(null);
    try {
      const payload = await launch();
      if (!payload) return; // canceló
      connectMut.mutate(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // Modo manual: el número ya se verificó en Meta a mano → pegar phone_number_id
  // + token de System User.
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [m, setM] = useState({ phone_number_id: "", waba_id: "", access_token: "" });

  const manualMut = useMutation({
    mutationFn: () =>
      connectPoolWhatsappManual(number.id, {
        phone_number_id: m.phone_number_id.trim(),
        access_token: m.access_token.trim(),
        waba_id: m.waba_id.trim() || undefined,
      }),
    onSuccess: () => {
      setDone(true);
      onDone();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? typeof err.payload.error === "string"
            ? err.payload.error
            : "No pudimos conectar."
          : "No pudimos conectar."
      ),
  });

  const working = busy || connectMut.isPending || manualMut.isPending;

  return (
    <ModalShell title="Conectar WhatsApp" onClose={onClose} busy={working}>
      <div style={{ padding: 18 }}>
        {done ? (
          <div style={okBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <CheckCircle2 size={17} style={{ color: "var(--z-green)" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>WhatsApp conectado</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, marginTop: 8 }}>
              El número quedó <strong>disponible</strong> en el pool, listo para que
              el bot se lo asigne al próximo cliente.
            </div>
            <button type="button" onClick={onClose} style={{ ...primaryBtn, marginTop: 14 }}>
              Listo
            </button>
          </div>
        ) : mode === "manual" ? (
          <>
            <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, margin: "0 0 12px" }}>
              Ya verificaste el número en Meta. Pegá estos datos del portal y lo
              conectamos (el token de System User <strong>no expira</strong>).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Labeled label="Phone number ID" hint="WhatsApp Manager → tu número → «Identificador del número de teléfono»">
                <input
                  value={m.phone_number_id}
                  onChange={(e) => setM((s) => ({ ...s, phone_number_id: e.target.value }))}
                  placeholder="123456789012345"
                  style={inputStyle}
                />
              </Labeled>
              <Labeled label="WhatsApp Business Account ID (WABA)" hint="WhatsApp Manager → la cuenta → ID. Necesario para recibir mensajes.">
                <input
                  value={m.waba_id}
                  onChange={(e) => setM((s) => ({ ...s, waba_id: e.target.value }))}
                  placeholder="109xxxxxxxxxxxx"
                  style={inputStyle}
                />
              </Labeled>
              <Labeled label="Token de System User" hint="Business Settings → Usuarios del sistema → Generar token → app «Zero by NavApex» + permisos whatsapp_business_messaging y whatsapp_business_management">
                <input
                  value={m.access_token}
                  onChange={(e) => setM((s) => ({ ...s, access_token: e.target.value }))}
                  placeholder="EAAG…"
                  style={inputStyle}
                />
              </Labeled>
            </div>
            {error && <div style={{ ...errorStyle, marginTop: 12, marginBottom: 0 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setMode("auto")} disabled={working} style={ghostBtn}>
                Volver
              </button>
              <button
                type="button"
                onClick={() => manualMut.mutate()}
                disabled={working || !m.phone_number_id.trim() || !m.access_token.trim()}
                style={{
                  ...primaryBtn,
                  opacity: !m.phone_number_id.trim() || !m.access_token.trim() ? 0.5 : 1,
                }}
              >
                {manualMut.isPending ? <Spin /> : <CheckCircle2 size={13} />} Conectar
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, margin: "0 0 14px" }}>
              Vas a conectar{" "}
              <strong>
                {number.phone_e164 ? `+${number.phone_e164}` : "este número"}
              </strong>{" "}
              a WhatsApp con el flujo oficial de Meta. Verificá por <strong>voz</strong>:
              la llamada de Meta suena en el celular que pusiste en el reenvío.
            </p>
            {configMissing && (
              <div style={errorStyle}>
                Falta NEXT_PUBLIC_META_FB_APP_ID o NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID.
              </div>
            )}
            {error && <div style={errorStyle}>{error}</div>}
            <button
              type="button"
              onClick={onConnect}
              disabled={working || configMissing}
              style={{ ...fbBtn, opacity: working || configMissing ? 0.6 : 1, cursor: working || configMissing ? "not-allowed" : "pointer" }}
            >
              {working && <Spin />}
              {connectMut.isPending ? "Conectando…" : busy ? "Esperando a Meta…" : "Conectar con Facebook"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("manual");
              }}
              style={{
                marginTop: 12,
                background: "none",
                border: "none",
                color: "var(--z-cyan)",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              ¿Ya lo verificaste en Meta a mano? Conectalo manual →
            </button>
          </>
        )}
      </div>
    </ModalShell>
  );
}

function Labeled({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-1)" }}>{label}</span>
      {children}
      <span style={{ fontSize: 10.5, color: "var(--text-3)", lineHeight: 1.4 }}>{hint}</span>
    </label>
  );
}

// ── helpers de UI ──────────────────────────────────────────────────────────
function statusLabel(s: PoolNumber["status"]): string {
  return s === "provisioning"
    ? "comprado"
    : s === "available"
      ? "disponible"
      : s === "reserved"
        ? "reservado"
        : s === "assigned"
          ? "asignado"
          : "retirado";
}

function Spin() {
  return <Loader2 size={11} style={{ animation: "spin 900ms linear infinite" }} />;
}

function ModalShell({
  title,
  onClose,
  busy,
  children,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
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
          width: "min(560px, 100%)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          border: "1px solid var(--hair-strong)",
          background: "var(--surface-1, rgba(15,15,20,0.96))",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--hair)" }}>
          <Layers size={15} style={{ color: "var(--z-cyan)" }} />
          <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{title}</div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" style={iconBtn}>
            <X size={14} />
          </button>
        </div>
        <div style={{ overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        justifyContent: "flex-end",
        padding: "12px 18px",
        borderTop: "1px solid var(--hair)",
        background: "rgba(0,0,0,0.15)",
      }}
    >
      {children}
    </div>
  );
}

type ChipTone = "cyan" | "green" | "amber" | "muted";
function Chip({ label, tone }: { label: string; tone: ChipTone }) {
  const map: Record<ChipTone, { color: string; bg: string; border: string }> = {
    cyan: { color: "oklch(0.80 0.13 200)", bg: "oklch(0.80 0.13 200 / 0.10)", border: "oklch(0.80 0.13 200 / 0.4)" },
    green: { color: "oklch(0.78 0.18 145)", bg: "oklch(0.78 0.18 145 / 0.12)", border: "oklch(0.78 0.18 145 / 0.4)" },
    amber: { color: "oklch(0.85 0.18 90)", bg: "oklch(0.85 0.18 90 / 0.10)", border: "oklch(0.85 0.18 90 / 0.4)" },
    muted: { color: "var(--text-3)", bg: "rgba(255,255,255,0.04)", border: "var(--hair)" },
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
const miniLabel: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-3)",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
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
const ghostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  borderRadius: 5,
  border: "1px solid var(--hair)",
  background: "transparent",
  color: "var(--text-1)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};
const miniPrimaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 9px",
  borderRadius: 5,
  border: "none",
  background: "var(--aurora)",
  color: "#0a0a0f",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
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
const fbMiniBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 10px",
  borderRadius: 5,
  border: "none",
  background: "#1877F2",
  color: "white",
  fontSize: 11.5,
  fontWeight: 600,
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
const okBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 10,
  border: "1px solid oklch(0.78 0.15 155 / 0.35)",
  background: "oklch(0.78 0.15 155 / 0.07)",
};
