"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Loader2, Send } from "lucide-react";
import { sandboxChat } from "@/lib/api/sandbox";
import { ApiError } from "@/lib/api/client";
import { PageShell } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import type { MessageSource, SandboxRoute } from "@/lib/api/contract";

type SandboxMessage =
  | { id: string; from: "user"; text: string }
  | {
      id: string;
      from: "bot";
      text: string;
      route: SandboxRoute;
      trace_id: string;
      typing_ms: number;
      llm_elapsed_ms: number;
      pending?: boolean;
    };

const CHANNELS: { id: MessageSource; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "telegram", label: "Telegram" },
  { id: "websocket", label: "WebSocket" },
];

export function SandboxView() {
  return (
    <RequireTenant>{(tenantId) => <SandboxContent tenantId={tenantId} />}</RequireTenant>
  );
}

function SandboxContent({ tenantId }: { tenantId: string }) {
  const [channel, setChannel] = useState<MessageSource>("whatsapp");
  const [senderName, setSenderName] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [messages, setMessages] = useState<SandboxMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || submitting) return;
    setSubmitting(true);
    setError(null);

    const userMsg: SandboxMessage = {
      id: `u-${Date.now()}`,
      from: "user",
      text: message,
    };
    setMessages((m) => [...m, userMsg]);
    setText("");

    try {
      const res = await sandboxChat(tenantId, {
        source: channel,
        message,
        sender_name: senderName || undefined,
      });
      const pendingId = `b-pending-${Date.now()}`;
      const pending: SandboxMessage = {
        id: pendingId,
        from: "bot",
        text: "",
        route: res.route,
        trace_id: res.trace_id,
        typing_ms: res.typing_ms,
        llm_elapsed_ms: res.llm_elapsed_ms,
        pending: true,
      };
      setMessages((m) => [...m, pending]);
      // Simular typing antes de revelar respuesta.
      await new Promise((r) => setTimeout(r, Math.min(res.typing_ms, 5000)));
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingId
            ? { ...msg, pending: false, text: res.reply }
            : msg
        )
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.payload.error || "No pudimos enviar el mensaje."
          : "Error de red."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title="Sandbox"
      subtitle="Probá el bot en vivo con la persona actual. Ideal para iterar prompts sin redeploy."
      actions={
        <button
          type="button"
          onClick={() => setMessages([])}
          style={{
            padding: "6px 12px",
            borderRadius: 5,
            border: "1px solid var(--hair-strong)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--text-1)",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Limpiar
        </button>
      }
    >
      <div
        className="glass"
        style={{
          borderRadius: 12,
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          height: "calc(100dvh - 200px)",
          minHeight: 420,
        }}
      >
        {/* Channel selector */}
        <div
          style={{
            padding: 10,
            borderBottom: "1px solid var(--hair)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 2,
              padding: 3,
              background: "rgba(0,0,0,0.25)",
              borderRadius: 8,
              border: "1px solid var(--hair)",
            }}
          >
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChannel(c.id)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "none",
                  background:
                    channel === c.id
                      ? "linear-gradient(90deg, oklch(0.62 0.22 295 / 0.25), oklch(0.80 0.13 200 / 0.18))"
                      : "transparent",
                  color: channel === c.id ? "var(--text-0)" : "var(--text-2)",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <input
            placeholder="Nombre del contacto (opcional)"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            style={{
              flex: 1,
              minWidth: 180,
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid var(--hair)",
              background: "rgba(0,0,0,0.2)",
              color: "var(--text-0)",
              fontSize: 12,
            }}
          />
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            overflowY: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "var(--text-3)",
                fontSize: 12,
                padding: 40,
              }}
            >
              Escribí un mensaje para probar el bot.
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {error && (
            <div
              role="alert"
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid oklch(0.68 0.21 25 / 0.4)",
                background: "oklch(0.68 0.21 25 / 0.1)",
                color: "var(--z-red)",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={onSubmit}
          style={{
            padding: 10,
            borderTop: "1px solid var(--hair)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <textarea
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
            placeholder="Escribí tu mensaje…"
            style={{
              flex: 1,
              resize: "none",
              padding: "9px 10px",
              borderRadius: 8,
              border: "1px solid var(--hair-strong)",
              background: "rgba(0,0,0,0.2)",
              color: "var(--text-0)",
              fontSize: 13,
              fontFamily: "inherit",
              maxHeight: 120,
            }}
          />
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              borderRadius: 8,
              border: "none",
              background:
                submitting || !text.trim() ? "rgba(255,255,255,0.06)" : "var(--aurora)",
              color: submitting || !text.trim() ? "var(--text-3)" : "#0a0a0f",
              fontSize: 12,
              fontWeight: 600,
              cursor: submitting || !text.trim() ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? (
              <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <Send size={13} />
            )}
            Enviar
          </button>
        </form>
      </div>
    </PageShell>
  );
}

function MessageBubble({ message }: { message: SandboxMessage }) {
  if (message.from === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            maxWidth: "80%",
            padding: "8px 12px",
            borderRadius: 10,
            background: "var(--aurora)",
            color: "#0a0a0f",
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: "pre-wrap",
          }}
        >
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, maxWidth: "85%" }}>
      <div
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--hair)",
          color: "var(--text-0)",
          fontSize: 13,
          whiteSpace: "pre-wrap",
          minWidth: 60,
        }}
      >
        {message.pending ? (
          <span style={{ display: "inline-flex", gap: 4 }}>
            <Dot /> <Dot delay={150} /> <Dot delay={300} />
          </span>
        ) : (
          message.text
        )}
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10,
          color: "var(--text-3)",
          fontFamily: "var(--font-jetbrains-mono)",
        }}
      >
        <span
          style={{
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--hair)",
          }}
        >
          {message.route}
        </span>
        <span>typing {message.typing_ms}ms</span>
        <span>· llm {message.llm_elapsed_ms}ms</span>
        <button
          type="button"
          title="Copiar trace_id"
          onClick={() => navigator.clipboard.writeText(message.trace_id)}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--text-3)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: 0,
            fontFamily: "inherit",
            fontSize: 10,
          }}
        >
          <Copy size={10} />
          {message.trace_id.slice(0, 10)}
        </button>
      </div>
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: "var(--text-2)",
        animation: `pulse-dot 1s ${delay}ms ease-in-out infinite`,
      }}
    />
  );
}
