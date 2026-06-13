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

// Cuando hay imagen real, el `content` suele traer la descripción de Gemini
// entre corchetes ("[Imagen del cliente: …]") que ya no aporta (se ve la foto).
// La quitamos y dejamos solo lo que escribió el cliente (su caption, si hubo).
function cleanImageCaption(text: string): string {
  return text.replace(/\[Imagen del cliente:[^\]]*\]/g, "").trim();
}

// ✓ enviado · ✓✓ entregado · ✓✓ (cian) leído · ⚠ falló. Solo en salientes.
function DeliveryTicks({ status }: { status: NonNullable<Message["deliveryStatus"]> }) {
  if (status === "failed") {
    return (
      <span title="No se pudo entregar" style={{ color: "var(--z-red, #ff6b6b)" }}>
        ⚠
      </span>
    );
  }
  const read = status === "read";
  const glyph = status === "sent" ? "✓" : "✓✓";
  const label =
    status === "sent" ? "Enviado" : status === "delivered" ? "Entregado" : "Leído";
  return (
    <span
      title={label}
      style={{
        color: read ? "var(--z-cyan)" : "var(--text-3)",
        letterSpacing: -1,
        fontWeight: 600,
      }}
    >
      {glyph}
    </span>
  );
}

export function MessageBubble({ message: m }: { message: Message }) {
  const isUser = m.from === "user";
  const isZero = m.from === "zero";
  const isOutbound = isZero || m.from === "human";
  const hasImage = m.mediaType === "image" && !!m.mediaUrl;
  const hasAudio = m.mediaType === "audio" && !!m.mediaUrl;
  // Texto a mostrar: en imágenes, sin el corchete de descripción; en el resto,
  // tal cual (el audio conserva su transcripción, que es útil).
  const displayText = hasImage ? cleanImageCaption(m.text) : m.text;

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
          {hasImage && (
            <a
              href={m.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", marginBottom: displayText ? 6 : 0 }}
            >
              {/* La URL viene de nuestro Cloudinary (no del cliente). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.mediaUrl}
                alt="Imagen del cliente"
                loading="lazy"
                style={{
                  maxWidth: "100%",
                  maxHeight: 280,
                  borderRadius: 8,
                  display: "block",
                  objectFit: "cover",
                }}
              />
            </a>
          )}
          {hasAudio && (
            <audio
              controls
              preload="none"
              src={m.mediaUrl}
              style={{ width: 220, marginBottom: displayText ? 6 : 0, display: "block" }}
            />
          )}
          {displayText && renderText(displayText)}
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
          {isOutbound && m.deliveryStatus && (
            <DeliveryTicks status={m.deliveryStatus} />
          )}
        </div>
      </div>
    </div>
  );
}
