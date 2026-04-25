"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, RotateCcw, Phone, Video, MoreVertical, Smile, Paperclip, Mic } from "lucide-react";
import { sandboxChat, sandboxReset } from "@/lib/api/sandbox";
import { getTenant } from "@/lib/api/tenants";
import { ApiError } from "@/lib/api/client";
import { getSocket, connectSocket } from "@/lib/socket/client";
import { PageShell } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";

type Bubble =
  | {
      id: string;
      from: "user";
      text: string;
      sentAt: number;
      status: "sent" | "delivered" | "read";
    }
  | {
      id: string;
      from: "bot";
      text: string;
      sentAt: number;
      route?: string;
      pending: boolean;
    };

const FAKE_NUMBER = "+1 555 010 1212";

function newSessionId(): string {
  // crypto.randomUUID si existe; fallback simple
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SandboxView() {
  return (
    <RequireTenant>{(tenantId) => <SandboxContent tenantId={tenantId} />}</RequireTenant>
  );
}

function SandboxContent({ tenantId }: { tenantId: string }) {
  const [sessionId, setSessionId] = useState<string>(() => newSessionId());
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [botTyping, setBotTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const tenantQuery = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => getTenant(tenantId).then((r) => r.tenant),
    staleTime: 60_000,
  });
  const businessName = tenantQuery.data?.business?.name ?? "Tu negocio";
  const initials = useMemo(() => {
    return businessName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "Z";
  }, [businessName]);

  // Auto-scroll al final
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, botTyping]);

  // Suscripción a socket sandbox para typing del bot
  useEffect(() => {
    if (!tenantId || !sessionId) return;
    const socket = connectSocket(tenantId);
    const join = () => socket.emit("join:sandbox", { tenantId, sessionId });
    if (socket.connected) join();
    else socket.once("connect", join);

    const onTyping = (payload: { sessionId: string; typing: boolean }) => {
      if (payload.sessionId !== sessionId) return;
      setBotTyping(payload.typing);
    };
    socket.on("sandbox:typing", onTyping);

    return () => {
      socket.off("sandbox:typing", onTyping);
      socket.emit("leave:sandbox", { tenantId, sessionId });
    };
  }, [tenantId, sessionId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || submitting) return;

    const userId = `u-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: userId, from: "user", text: message, sentAt: Date.now(), status: "sent" },
    ]);
    setText("");
    setSubmitting(true);
    setError(null);

    try {
      const res = await sandboxChat(tenantId, {
        session_id: sessionId,
        message,
      });
      // Marcar el último user como "read" (azul) tras la respuesta del bot.
      setMessages((m) =>
        m.map((msg) =>
          msg.id === userId && msg.from === "user"
            ? { ...msg, status: "read" }
            : msg
        )
      );
      // Insertar la respuesta como bubble bot. El delay simulado lo da el typing
      // del socket — al llegar el reply, ocultamos el typing.
      setMessages((m) => [
        ...m,
        {
          id: `b-${Date.now()}`,
          from: "bot",
          text: res.reply,
          sentAt: Date.now(),
          route: res.route,
          pending: false,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.payload.error || "No pudimos enviar el mensaje."
          : "Error de red."
      );
    } finally {
      setSubmitting(false);
      // Mantener el foco en el input para escribir el siguiente mensaje sin
      // tener que cliquear de nuevo. requestAnimationFrame se asegura de que
      // el textarea esté habilitado (disabled removido) antes de enfocar.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  async function onReset() {
    try {
      await sandboxReset(tenantId, sessionId);
    } catch {
      // best-effort
    }
    setMessages([]);
    setBotTyping(false);
    setError(null);
    // Nueva sesión tras reset, así el bot no recuerda al "cliente" anterior.
    setSessionId(newSessionId());
  }

  return (
    <PageShell
      title="Simulador"
      subtitle="Probá tu agente como lo vería un cliente real. Es tu canal de prueba — no consume tokens del plan ni aparece en el inbox."
      actions={
        <button
          type="button"
          onClick={onReset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid var(--hair-strong)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--text-1)",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <RotateCcw size={11} />
          Reiniciar chat
        </button>
      }
    >
      <div className="sandbox-stage">
        <div className="sandbox-phone">
          {/* WhatsApp header */}
          <div className="sb-header">
            <div className="sb-avatar" aria-hidden>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sb-name" title={businessName}>{businessName}</div>
              <div className="sb-status">
                {botTyping ? "escribiendo…" : "en línea"}
              </div>
            </div>
            <button className="sb-icon-btn" type="button" aria-label="Videollamada">
              <Video size={18} />
            </button>
            <button className="sb-icon-btn" type="button" aria-label="Llamar">
              <Phone size={18} />
            </button>
            <button className="sb-icon-btn" type="button" aria-label="Más">
              <MoreVertical size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="sb-messages">
            <div className="sb-day-divider">
              <span>HOY</span>
            </div>
            <div className="sb-system-bubble">
              {FAKE_NUMBER} · Mensajes y llamadas cifrados de extremo a extremo.
            </div>

            {messages.length === 0 && !botTyping && (
              <div className="sb-empty">
                Escribí un mensaje para probar a tu agente.
                <br />
                <span style={{ opacity: 0.7 }}>
                  Esta conversación es privada — no se le envía a ningún cliente real.
                </span>
              </div>
            )}

            {messages.map((m) => <MessageBubble key={m.id} bubble={m} />)}

            {botTyping && <TypingBubble />}

            {error && (
              <div className="sb-error" role="alert">
                {error}
              </div>
            )}
          </div>

          {/* Composer */}
          <form onSubmit={onSubmit} className="sb-composer">
            <button
              type="button"
              className="sb-icon-btn sb-comp-icon"
              aria-label="Emoji"
            >
              <Smile size={20} />
            </button>
            <button
              type="button"
              className="sb-icon-btn sb-comp-icon"
              aria-label="Adjuntar"
            >
              <Paperclip size={20} />
            </button>
            <textarea
              ref={inputRef}
              className="sb-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e as unknown as React.FormEvent);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Mensaje"
              autoFocus
              enterKeyHint="send"
              autoComplete="off"
              autoCapitalize="sentences"
            />
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="sb-send-btn"
              aria-label={text.trim() ? "Enviar" : "Audio"}
            >
              {text.trim() ? <Send size={18} /> : <Mic size={18} />}
            </button>
          </form>
        </div>
      </div>

      <SandboxStyles />
    </PageShell>
  );
}

function MessageBubble({ bubble }: { bubble: Bubble }) {
  const isUser = bubble.from === "user";
  return (
    <div className={`sb-row ${isUser ? "sb-row-user" : "sb-row-bot"}`}>
      <div className={`sb-bubble ${isUser ? "sb-bubble-user" : "sb-bubble-bot"}`}>
        <div className="sb-bubble-text">{bubble.text}</div>
        <div className="sb-bubble-meta">
          <span>{formatTime(bubble.sentAt)}</span>
          {isUser && bubble.from === "user" && (
            <Ticks status={bubble.status} />
          )}
        </div>
      </div>
    </div>
  );
}

function Ticks({ status }: { status: "sent" | "delivered" | "read" }) {
  // Doble tilde estilo WhatsApp; "read" en azul.
  const blue = status === "read";
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        marginLeft: 4,
        color: blue ? "#53bdeb" : "rgba(255,255,255,0.55)",
        fontSize: 11,
        lineHeight: 1,
      }}
    >
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
        <path
          d="M11.071.653a.5.5 0 0 1 .076.704L5.51 8.07a.5.5 0 0 1-.755.04L1.343 4.694a.5.5 0 0 1 .707-.707l3.034 3.034L10.367.729a.5.5 0 0 1 .704-.076Z"
          fill="currentColor"
        />
        <path
          d="M15.071.653a.5.5 0 0 1 .076.704L9.51 8.07a.5.5 0 0 1-.755.04l-.7-.7a.5.5 0 0 1 .707-.707l.314.314L14.367.729a.5.5 0 0 1 .704-.076Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function TypingBubble() {
  return (
    <div className="sb-row sb-row-bot">
      <div className="sb-bubble sb-bubble-bot sb-typing-bubble">
        <span className="sb-typing-dot" />
        <span className="sb-typing-dot" style={{ animationDelay: "150ms" }} />
        <span className="sb-typing-dot" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

function SandboxStyles() {
  return (
    <style jsx global>{`
      .sandbox-stage {
        display: grid;
        grid-template-columns: minmax(0, 460px);
        justify-content: center;
        padding: 8px 0;
      }
      .sandbox-phone {
        display: grid;
        grid-template-rows: auto 1fr auto;
        height: calc(100dvh - 200px);
        min-height: 520px;
        max-height: 820px;
        background: #0b141a;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.06);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      }
      @media (max-width: 720px) {
        .sandbox-stage {
          grid-template-columns: 1fr;
          padding: 0;
          margin: -12px -12px 0;
        }
        .sandbox-phone {
          height: calc(100dvh - 140px);
          min-height: 0;
          max-height: none;
          border-radius: 0;
          border-left: none;
          border-right: none;
          box-shadow: none;
        }
      }

      .sb-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: #202c33;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      }
      .sb-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: linear-gradient(135deg, #00a884, #008069);
        display: grid;
        place-items: center;
        color: #fff;
        font-weight: 600;
        font-size: 14px;
        flex-shrink: 0;
      }
      .sb-name {
        font-size: 14px;
        font-weight: 500;
        color: #e9edef;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sb-status {
        font-size: 12px;
        color: #8696a0;
        line-height: 1.2;
      }
      .sb-icon-btn {
        background: transparent;
        border: none;
        color: #aebac1;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        cursor: pointer;
        flex-shrink: 0;
      }
      .sb-icon-btn:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .sb-messages {
        position: relative;
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        padding: 14px 6%;
        display: flex;
        flex-direction: column;
        gap: 4px;
        background-color: #0b141a;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><g fill='none' stroke='%231a2329' stroke-width='1' opacity='0.7'><circle cx='5' cy='5' r='1.4'/><circle cx='25' cy='15' r='1.4'/><circle cx='10' cy='30' r='1.4'/><circle cx='35' cy='35' r='1.4'/></g></svg>");
      }
      @media (max-width: 720px) {
        .sb-messages { padding: 12px 10px; }
        .sb-bubble { max-width: 85%; }
        .sb-input { font-size: 16px; } /* evita zoom en iOS al focus */
      }

      .sb-day-divider {
        align-self: center;
        margin: 8px 0 14px;
      }
      .sb-day-divider span {
        background: #182229;
        color: #8696a0;
        padding: 5px 12px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.4px;
      }
      .sb-system-bubble {
        align-self: center;
        background: #182229;
        color: #ffd279;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 11.5px;
        text-align: center;
        margin-bottom: 14px;
        max-width: 90%;
      }
      .sb-empty {
        margin: auto;
        text-align: center;
        color: #8696a0;
        font-size: 13px;
        padding: 32px 16px;
        line-height: 1.5;
      }
      .sb-error {
        align-self: center;
        background: rgba(229, 79, 79, 0.15);
        color: #ff8b8b;
        border: 1px solid rgba(229, 79, 79, 0.4);
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 12px;
        margin-top: 8px;
      }

      .sb-row {
        display: flex;
        margin-top: 4px;
      }
      .sb-row-user {
        justify-content: flex-end;
      }
      .sb-row-bot {
        justify-content: flex-start;
      }
      .sb-bubble {
        max-width: 78%;
        padding: 6px 9px 6px 11px;
        border-radius: 8px;
        font-size: 14px;
        line-height: 1.36;
        position: relative;
        box-shadow: 0 1px 0.5px rgba(0, 0, 0, 0.13);
      }
      .sb-bubble-user {
        background: #005c4b;
        color: #e9edef;
        border-top-right-radius: 0;
      }
      .sb-bubble-bot {
        background: #202c33;
        color: #e9edef;
        border-top-left-radius: 0;
      }
      .sb-bubble-text {
        white-space: pre-wrap;
        word-wrap: break-word;
        padding-right: 56px; /* deja espacio para meta */
      }
      .sb-bubble-meta {
        position: absolute;
        right: 8px;
        bottom: 4px;
        font-size: 10.5px;
        color: rgba(255, 255, 255, 0.55);
        display: inline-flex;
        align-items: center;
      }

      .sb-typing-bubble {
        display: inline-flex;
        gap: 4px;
        padding: 12px 14px;
      }
      .sb-typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #8696a0;
        display: inline-block;
        animation: sb-pulse 1.2s ease-in-out infinite;
      }
      @keyframes sb-pulse {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
        30% { transform: translateY(-4px); opacity: 1; }
      }

      .sb-composer {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        padding: 8px 10px;
        background: #202c33;
        border-top: 1px solid rgba(255, 255, 255, 0.04);
      }
      .sb-comp-icon {
        margin-bottom: 4px;
      }
      .sb-input {
        flex: 1;
        resize: none;
        padding: 9px 12px;
        border-radius: 8px;
        border: none;
        background: #2a3942;
        color: #e9edef;
        font-size: 14px;
        font-family: inherit;
        line-height: 1.4;
        max-height: 120px;
        outline: none;
      }
      .sb-input::placeholder {
        color: #8696a0;
      }
      .sb-send-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        background: #00a884;
        color: #fff;
        display: grid;
        place-items: center;
        cursor: pointer;
        flex-shrink: 0;
      }
      .sb-send-btn:disabled {
        background: #2a3942;
        color: #8696a0;
        cursor: not-allowed;
      }
    `}</style>
  );
}
