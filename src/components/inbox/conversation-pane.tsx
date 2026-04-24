"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Phone,
  Paperclip,
  Send,
  FileText,
  Zap,
  User,
  Check,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { UserAvatar } from "@/components/avatar";
import { ChannelIcon } from "@/components/channel-icon";
import { IconDot, IconSparkle } from "@/components/icons";
import { MessageBubble } from "./message-bubble";
import {
  listMessages,
  markConversationRead,
  resolveConversation,
  returnToAI,
  sendMessage,
  takeControl,
} from "@/lib/api/conversations";
import { subscribeConversation } from "@/lib/socket/use-realtime";
import type { Conversation, Message } from "@/lib/api/types";

interface Props {
  tenantId: string;
  conversation: Conversation;
  onBack?: () => void;
}

export function ConversationPane({ tenantId, conversation: c, onBack }: Props) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messagesKey = ["messages", tenantId, c.id];
  const humanMode = c.status === "humano_atendiendo";

  const messagesQuery = useQuery({
    queryKey: messagesKey,
    queryFn: () => listMessages(tenantId, c.id, { limit: 200 }),
    staleTime: 5_000,
  });

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [c.id, messages.length]);

  useEffect(() => {
    if (!c.id) return;
    markConversationRead(tenantId, c.id).catch(() => undefined);
    const unsubscribe = subscribeConversation(c.id);
    return unsubscribe;
  }, [tenantId, c.id]);

  const sendMut = useMutation({
    mutationFn: (body: { text: string }) => sendMessage(tenantId, c.id, body),
    onSuccess: (m) => {
      qc.setQueryData<Message[] | undefined>(messagesKey, (prev) =>
        prev && prev.some((x) => x.id === m.id) ? prev : [...(prev ?? []), m]
      );
      setText("");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "No pudimos enviar el mensaje.");
    },
  });

  const takeMut = useMutation({
    mutationFn: () => takeControl(tenantId, c.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", tenantId] });
    },
  });

  const returnMut = useMutation({
    mutationFn: () => returnToAI(tenantId, c.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", tenantId] });
    },
  });

  const resolveMut = useMutation({
    mutationFn: () => resolveConversation(tenantId, c.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", tenantId] });
    },
  });

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMut.mutate({ text: trimmed });
  }

  return (
    <section
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {/* Main conversation column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <header
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--hair)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(0,0,0,0.12)",
            flexShrink: 0,
          }}
        >
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Volver a la lista"
              className="flex md:hidden"
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 6,
                border: "none",
                background: "transparent",
                color: "var(--text-1)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <UserAvatar name={c.contactName} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
              <span style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.contactName}</span>
              <ChannelIcon channel={c.channel} size={12} active />
              {c.contactPhone && (
                <span
                  className="hidden sm:inline"
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "var(--text-3)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {c.contactPhone}
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 11,
                color: "var(--text-2)",
                marginTop: 2,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <IconDot
                  color={humanMode ? "var(--z-amber)" : "var(--z-green)"}
                  size={6}
                />
                {humanMode ? "Humano atendiendo" : "IA atendiendo"}
              </span>
              {c.status === "resuelta" && (
                <span style={{ color: "var(--text-3)" }}>· resuelta</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {!humanMode && c.status !== "resuelta" && (
              <button
                onClick={() => takeMut.mutate()}
                disabled={takeMut.isPending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
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
                <User size={12} />
                <span className="hidden sm:inline">Tomar control</span>
              </button>
            )}
            {humanMode && (
              <button
                onClick={() => returnMut.mutate()}
                disabled={returnMut.isPending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
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
                <IconSparkle size={12} />
                <span className="hidden sm:inline">Devolver a IA</span>
              </button>
            )}
            {c.status !== "resuelta" && (
              <button
                onClick={() => resolveMut.mutate()}
                disabled={resolveMut.isPending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
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
                <Check size={12} />
                <span className="hidden sm:inline">Resolver</span>
              </button>
            )}
            <button
              aria-label="Llamar"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 5, border: "1px solid transparent", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}
            >
              <Phone size={14} />
            </button>
            <button
              aria-label="Más opciones"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 5, border: "1px solid transparent", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          aria-live="polite"
          aria-label="Mensajes de la conversación"
          style={{ flex: 1, overflowY: "auto", padding: "20px 18px 12px" }}
        >
          {messagesQuery.isLoading && (
            <div
              style={{
                textAlign: "center",
                fontSize: 11,
                color: "var(--text-3)",
                padding: 20,
              }}
            >
              <Loader2 size={14} style={{ animation: "spin 900ms linear infinite" }} />
            </div>
          )}
          {messages.length === 0 && !messagesQuery.isLoading && (
            <div
              style={{
                textAlign: "center",
                fontSize: 11,
                color: "var(--text-3)",
                padding: 20,
              }}
            >
              Sin mensajes aún.
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--hair)",
            background: "rgba(0,0,0,0.2)",
            flexShrink: 0,
          }}
        >
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: 6,
                padding: "6px 10px",
                borderRadius: 5,
                border: "1px solid oklch(0.68 0.21 25 / 0.4)",
                background: "oklch(0.68 0.21 25 / 0.08)",
                color: "var(--z-red)",
                fontSize: 11,
              }}
            >
              {error}
            </div>
          )}
          <div
            className="glass"
            style={{ borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  fontFamily: "var(--font-jetbrains-mono)",
                }}
              >
                {humanMode
                  ? "modo humano — el mensaje saldrá por " + c.channel
                  : "Tomá el control para responder manualmente"}
              </span>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!humanMode || sendMut.isPending}
              placeholder={
                humanMode
                  ? "Escribí tu mensaje…"
                  : 'Pulsá "Tomar control" para escribir como humano.'
              }
              rows={2}
              aria-label="Escribir mensaje"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                color: "var(--text-0)",
                fontSize: 12.5,
                lineHeight: 1.45,
                padding: "2px 0",
                opacity: humanMode ? 1 : 0.6,
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                aria-label="Adjuntar archivo"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 5, border: "none", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}
              >
                <Paperclip size={14} />
              </button>
              <button
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 8px", borderRadius: 5, border: "none", background: "transparent", color: "var(--text-2)", fontSize: 11, cursor: "pointer" }}
              >
                <FileText size={13} /> Plantillas
              </button>
              <button
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 8px", borderRadius: 5, border: "none", background: "transparent", color: "var(--text-2)", fontSize: 11, cursor: "pointer" }}
              >
                <Zap size={13} /> Macros
              </button>
              <span style={{ marginLeft: "auto" }} />
              <kbd
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  fontFamily: "var(--font-jetbrains-mono)",
                  marginRight: 6,
                }}
              >
                ⌘↵
              </kbd>
              <button
                aria-label="Enviar mensaje"
                disabled={!humanMode || sendMut.isPending || !text.trim()}
                onClick={handleSend}
                style={{
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
                  opacity: !humanMode || sendMut.isPending ? 0.5 : 1,
                }}
              >
                {sendMut.isPending ? (
                  <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
                ) : (
                  <Send size={12} />
                )}
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
