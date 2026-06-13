import { Fragment } from "react";
import { IconSparkle } from "@/components/icons";
import type { Message } from "@/lib/api/types";

// El texto del mensaje lo escribe el CLIENTE de WhatsApp: jamás pasa por
// innerHTML. La negrita de **…** se arma con nodos React sobre texto plano.
function renderText(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ color: "var(--z-cyan)" }}>
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

export function MessageBubble({ message: m }: { message: Message }) {
  const isUser = m.from === "user";
  const isZero = m.from === "zero";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 10,
      }}
    >
      <div style={{ maxWidth: "70%" }}>
        {isZero && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              marginBottom: 3,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <IconSparkle size={9} style={{ color: "var(--z-cyan)" }} />
            <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Zero</span>
          </div>
        )}
        {m.from === "human" && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              marginBottom: 3,
              fontFamily: "var(--font-jetbrains-mono)",
            }}
          >
            {m.source === "direct_whatsapp"
              ? "Tú · desde WhatsApp"
              : `${m.agentName ?? "Agente"} · desde panel`}
          </div>
        )}
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            fontSize: 12.5,
            lineHeight: 1.45,
            background: isUser
              ? "rgba(255,255,255,0.05)"
              : isZero
              ? "linear-gradient(135deg, oklch(0.62 0.22 295 / 0.18), oklch(0.80 0.13 200 / 0.10))"
              : "oklch(0.80 0.14 75 / 0.12)",
            border: isUser
              ? "1px solid var(--hair)"
              : isZero
              ? "1px solid oklch(0.62 0.22 295 / 0.35)"
              : "1px solid oklch(0.80 0.14 75 / 0.3)",
            color: "var(--text-0)",
            borderBottomRightRadius: isUser ? 2 : 10,
            borderBottomLeftRadius: isUser ? 10 : 2,
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
          }}
        >
          {renderText(m.text)}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: isUser ? "flex-end" : "flex-start",
            gap: 6,
            marginTop: 3,
            fontSize: 10,
            color: "var(--text-3)",
            fontFamily: "var(--font-jetbrains-mono)",
          }}
        >
          <span suppressHydrationWarning>
            {new Date(m.sentAt).toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {m.toolCall && (
            <span>
              · {m.toolCall.name} · {m.toolCall.durationMs}ms
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
