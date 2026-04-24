"use client";

import { useState } from "react";
import { Plus, Upload, Check, MoreHorizontal, Zap, Send } from "lucide-react";
import { MessageBubble } from "@/components/inbox/message-bubble";
import { MOCK_AGENT_CONFIG } from "@/lib/mock-data";
import type { Message } from "@/lib/api/types";

const PLAYGROUND_MESSAGES: Message[] = [
  {
    id: "p1",
    conversationId: "playground",
    from: "user",
    text: "Hola! Hacen envíos a Neuquén?",
    sentAt: new Date().toISOString(),
  },
  {
    id: "p2",
    conversationId: "playground",
    from: "zero",
    text: "Sí! Enviamos a Neuquén por Andreani. El envío estándar sale **$3.900** y llega en 3-5 días hábiles. ¿Querés que te cotice un producto específico?",
    sentAt: new Date().toISOString(),
    toolCall: { name: "shipping_quote", durationMs: 320 },
  },
  {
    id: "p3",
    conversationId: "playground",
    from: "user",
    text: "Necesito hablar con alguien",
    sentAt: new Date().toISOString(),
  },
];

export function AgentView() {
  const config = MOCK_AGENT_CONFIG;
  const [rules, setRules] = useState(config.escalationRules.map((r) => ({ ...r })));
  const [playgroundText, setPlaygroundText] = useState("");

  return (
    <div style={{ flex: 1, display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }}>
      {/* Config column */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>
          Configuración del agente
        </h1>
        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, marginBottom: 20 }}>
          Cerebro de Zero · versión{" "}
          <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            v{config.version} · publicada {config.publishedAt}
          </span>
        </div>

        {/* Identity */}
        <SectionCard title="Identidad">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <LabelInput label="Nombre del agente" defaultValue={config.name} />
            <LabelInput label="Negocio" defaultValue={config.businessName} />
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--text-3)",
              fontWeight: 600,
            }}
          >
            Tono de voz
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {config.tones.map((t) => {
              const on = config.activeTones.includes(t);
              return (
                <button
                  key={t}
                  aria-pressed={on}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 20,
                    fontSize: 11,
                    background: on ? "var(--aurora)" : "rgba(255,255,255,0.04)",
                    color: on ? "#0a0a0f" : "var(--text-1)",
                    border: on ? "none" : "1px solid var(--hair)",
                    fontWeight: on ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--text-3)",
              fontWeight: 600,
            }}
          >
            Idiomas activos
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {config.languages.map((l) => (
              <button
                key={l.code}
                aria-pressed={l.active}
                style={{
                  padding: "5px 10px",
                  borderRadius: 5,
                  fontSize: 11,
                  fontFamily: "var(--font-jetbrains-mono)",
                  background: l.active ? "oklch(0.80 0.13 200 / 0.15)" : "rgba(255,255,255,0.03)",
                  color: l.active ? "var(--z-cyan)" : "var(--text-3)",
                  border: l.active ? "1px solid oklch(0.80 0.13 200 / 0.3)" : "1px solid var(--hair)",
                  cursor: "pointer",
                }}
              >
                {l.code}
              </button>
            ))}
            <button
              style={{
                padding: "5px 10px",
                borderRadius: 5,
                fontSize: 11,
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-3)",
                border: "1px dashed var(--hair-strong)",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              + agregar
            </button>
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--text-3)",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Instrucciones personalizadas
          </div>
          <textarea
            defaultValue={config.instructions}
            rows={4}
            aria-label="Instrucciones personalizadas para el agente"
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.25)",
              border: "1px solid var(--hair)",
              borderRadius: 8,
              color: "var(--text-0)",
              padding: "10px 12px",
              fontSize: 13,
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </SectionCard>

        {/* Knowledge base */}
        <SectionCard
          title="Base de conocimiento"
          right={
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 5,
                border: "1px solid var(--hair-strong)",
                background: "rgba(255,255,255,0.03)",
                color: "var(--text-1)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Upload size={12} /> Subir fuente
            </button>
          }
        >
          {config.knowledgeSources.map((f) => (
            <div
              key={f.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderTop: "1px solid var(--hair)",
                fontSize: 12,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 5,
                  border: "1px dashed var(--hair-strong)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  color: "var(--text-3)",
                  fontFamily: "var(--font-jetbrains-mono)",
                  flexShrink: 0,
                }}
              >
                DOC
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-3)",
                    fontFamily: "var(--font-jetbrains-mono)",
                    marginTop: 2,
                  }}
                >
                  {f.detail}
                </div>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  fontFamily: "var(--font-jetbrains-mono)",
                  flexShrink: 0,
                }}
              >
                {f.size}
              </div>
              {f.synced ? (
                <Check size={14} style={{ color: "var(--z-green)", flexShrink: 0 }} />
              ) : (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: "2px solid var(--z-cyan)",
                    borderTopColor: "transparent",
                    animation: "spin 1s linear infinite",
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          ))}
        </SectionCard>

        {/* Escalation rules */}
        <SectionCard title="Reglas de escalado a humano">
          {rules.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 4px",
                borderTop: i ? "1px solid var(--hair)" : "none",
                fontSize: 12.5,
              }}
            >
              <button
                role="switch"
                aria-checked={r.active}
                aria-label={`Regla: ${r.rule}`}
                onClick={() =>
                  setRules((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, active: !x.active } : x))
                  )
                }
                style={{
                  width: 30,
                  height: 16,
                  borderRadius: 10,
                  position: "relative",
                  flexShrink: 0,
                  background: r.active ? "var(--aurora)" : "rgba(255,255,255,0.08)",
                  border: "1px solid var(--hair)",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 1,
                    left: r.active ? 15 : 1,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "white",
                    transition: "left .15s",
                  }}
                />
              </button>
              <span style={{ flex: 1, color: r.active ? "var(--text-0)" : "var(--text-3)" }}>
                {r.rule}
              </span>
              <button
                aria-label="Más opciones"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 5, border: "none", background: "transparent", color: "var(--text-3)", cursor: "pointer" }}
              >
                <MoreHorizontal size={14} />
              </button>
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 5,
                border: "1px dashed var(--hair-strong)",
                background: "rgba(255,255,255,0.03)",
                color: "var(--text-1)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              <Plus size={12} /> Nueva regla
            </button>
          </div>
        </SectionCard>
      </div>

      {/* Playground */}
      <aside
        aria-label="Playground del agente"
        className="hidden lg:flex"
        style={{
          width: 340,
          borderLeft: "1px solid var(--hair)",
          background: "rgba(0,0,0,0.25)",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <header
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--hair)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Zap size={14} style={{ color: "var(--z-cyan)" }} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>Playground</div>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "var(--text-3)",
              fontFamily: "var(--font-jetbrains-mono)",
            }}
          >
            borrador v{config.version + 1}
          </span>
        </header>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
          aria-live="polite"
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              fontFamily: "var(--font-jetbrains-mono)",
              textAlign: "center",
            }}
          >
            Probá cambios sin publicar
          </div>
          {PLAYGROUND_MESSAGES.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <div
            style={{
              padding: "8px 12px",
              background: "oklch(0.80 0.14 75 / 0.1)",
              border: "1px dashed oklch(0.80 0.14 75 / 0.35)",
              borderRadius: 8,
              fontSize: 11,
              color: "var(--z-amber)",
            }}
          >
            🪄 Regla activada: &quot;Si el cliente escribe hablar con humano…&quot; · Escalando a humano
          </div>
        </div>
        <div style={{ padding: 10, borderTop: "1px solid var(--hair)" }}>
          <div
            className="glass"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6 }}
          >
            <input
              type="text"
              placeholder="Escribí una prueba…"
              value={playgroundText}
              onChange={(e) => setPlaygroundText(e.target.value)}
              aria-label="Mensaje de prueba para el playground"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-0)",
                fontSize: 12,
              }}
            />
            <button
              aria-label="Enviar prueba"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 5,
                border: "none",
                background: "var(--aurora)",
                color: "#0a0a0f",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => setPlaygroundText("")}
            >
              <Send size={11} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              style={{
                flex: 1,
                justifyContent: "center",
                display: "inline-flex",
                alignItems: "center",
                padding: "5px 10px",
                borderRadius: 5,
                border: "1px solid var(--hair-strong)",
                background: "rgba(255,255,255,0.03)",
                color: "var(--text-1)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Descartar
            </button>
            <button
              style={{
                flex: 1,
                justifyContent: "center",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                borderRadius: 5,
                border: "none",
                background: "var(--aurora)",
                color: "#0a0a0f",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Publicar v{config.version + 1}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SectionCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="glass"
      style={{ borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
      </div>
      {children}
    </section>
  );
}

function LabelInput({
  label,
  defaultValue,
}: {
  label: string;
  defaultValue?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--text-3)",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <input
        type="text"
        defaultValue={defaultValue}
        style={{
          background: "rgba(0,0,0,0.3)",
          border: "1px solid var(--hair)",
          borderRadius: 5,
          color: "var(--text-0)",
          padding: "7px 10px",
          fontSize: 12,
          outline: "none",
        }}
      />
    </label>
  );
}
