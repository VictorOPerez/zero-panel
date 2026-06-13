"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  Paperclip,
  Send,
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
  fileToBase64,
  listMessages,
  markConversationRead,
  mediaKindFromMime,
  resolveConversation,
  returnToAI,
  sendMediaMessage,
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
  const WINDOW_MS = 24 * 60 * 60 * 1000;

  // Paginación real: la primera página son los últimos 100; "Cargar
  // anteriores" pide con el cursor `before` (keyset que el backend ya
  // soporta). pages[0] = batch más reciente.
  const PAGE_SIZE = 100;
  const messagesQuery = useInfiniteQuery({
    queryKey: messagesKey,
    queryFn: ({ pageParam }) =>
      listMessages(tenantId, c.id, { limit: PAGE_SIZE, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length >= PAGE_SIZE ? lastPage[0]?.id : undefined,
    staleTime: 5_000,
  });

  const messages = useMemo(() => {
    const pages = messagesQuery.data?.pages ?? [];
    const merged = [...pages].reverse().flat();
    const seen = new Set<string>();
    return merged.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }, [messagesQuery.data]);

  // Ventana de 24h de Meta (solo WhatsApp): se computa del último mensaje
  // entrante del cliente que ya está cargado — cero costo extra. Fuera de la
  // ventana, Meta rechaza el texto libre, así que avisamos y bloqueamos.
  const lastInboundAt = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].from === "user") return messages[i].sentAt;
    }
    return null;
  }, [messages]);
  const outside24h =
    c.channel === "wa" &&
    messages.length > 0 &&
    (!lastInboundAt || Date.now() - new Date(lastInboundAt).getTime() >= WINDOW_MS);

  // Auto-scroll. Al ABRIR la conversación baja del todo (de una, sin animar);
  // después, en cada mensaje nuevo solo baja si ya estabas cerca del fondo —
  // cargar historial viejo o leer arriba no te arranca al fondo.
  // BUG viejo: el salto inicial corría ANTES de que cargaran los mensajes, así
  // que conversaciones con historial no bajaban. Ahora el salto se dispara
  // cuando los mensajes ya están en pantalla (y se rearma al cambiar de chat).
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [c.id]);
  useEffect(() => {
    if (messages.length === 0) return;
    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      return;
    }
    const el = messagesContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageId]);

  useEffect(() => {
    if (!c.id) return;
    markConversationRead(tenantId, c.id).catch(() => undefined);
    const unsubscribe = subscribeConversation(c.id);
    return unsubscribe;
  }, [tenantId, c.id]);

  const sendMut = useMutation({
    mutationFn: (body: { text: string }) => sendMessage(tenantId, c.id, body),
    onSuccess: (m) => {
      qc.setQueryData<InfiniteData<Message[]> | undefined>(messagesKey, (prev) => {
        if (!prev || prev.pages.length === 0) return prev;
        if (prev.pages.some((page) => page.some((x) => x.id === m.id))) return prev;
        const pages = prev.pages.slice();
        pages[0] = [...pages[0], m];
        return { ...prev, pages };
      });
      setText("");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "No pudimos enviar el mensaje.");
    },
  });

  // Enviar adjunto (foto/video/audio/pdf) cuando el humano tomó el control.
  // El backend lo sube a Cloudinary y lo manda por WhatsApp; vuelve como un
  // mensaje 'human' con media que cae en el cache igual que el texto.
  const MAX_MEDIA_BYTES = 16 * 1024 * 1024;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendToCache = (m: Message) => {
    qc.setQueryData<InfiniteData<Message[]> | undefined>(messagesKey, (prev) => {
      if (!prev || prev.pages.length === 0) return prev;
      if (prev.pages.some((page) => page.some((x) => x.id === m.id))) return prev;
      const pages = prev.pages.slice();
      pages[0] = [...pages[0], m];
      return { ...prev, pages };
    });
  };
  const sendMediaMut = useMutation({
    mutationFn: async (file: File) => {
      const content_base64 = await fileToBase64(file);
      return sendMediaMessage(tenantId, c.id, {
        content_base64,
        mime: file.type || "application/octet-stream",
        kind: mediaKindFromMime(file.type || ""),
        filename: file.name,
      });
    },
    onSuccess: (m) => {
      appendToCache(m);
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : "No pudimos enviar el archivo."
      );
    },
  });

  function onPickFile() {
    if (!humanMode || outside24h || sendMediaMut.isPending) return;
    fileInputRef.current?.click();
  }
  function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-elegir el mismo archivo
    if (!file) return;
    if (file.size > MAX_MEDIA_BYTES) {
      setError("El archivo supera el límite de 16 MB.");
      return;
    }
    sendMediaMut.mutate(file);
  }

  // Los errores de estas mutaciones se mostraban a NADIE (sin onError): si
  // "Tomar control" fallaba (permiso, red, sesión), el botón no hacía nada y
  // el dueño quedaba sin saber por qué "no lo dejó" intervenir.
  const takeMut = useMutation({
    mutationFn: () => takeControl(tenantId, c.id),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["conversations", tenantId] });
    },
    onError: (err) => {
      setError(
        err instanceof Error
          ? `No pudimos tomar el control: ${err.message}`
          : "No pudimos tomar el control. Probá de nuevo."
      );
    },
  });

  const returnMut = useMutation({
    mutationFn: () => returnToAI(tenantId, c.id),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["conversations", tenantId] });
    },
    onError: (err) => {
      setError(
        err instanceof Error
          ? `No pudimos devolver la conversación a la IA: ${err.message}`
          : "No pudimos devolver la conversación a la IA. Probá de nuevo."
      );
    },
  });

  const resolveMut = useMutation({
    mutationFn: () => resolveConversation(tenantId, c.id),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["conversations", tenantId] });
    },
    onError: (err) => {
      setError(
        err instanceof Error
          ? `No pudimos marcarla como resuelta: ${err.message}`
          : "No pudimos marcarla como resuelta. Probá de nuevo."
      );
    },
  });

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || outside24h || sendMut.isPending) return;
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
            {/* "Tomar control" SIEMPRE disponible mientras no haya un humano
                al mando — incluso en conversaciones resueltas: el backend la
                reabre y pausa la IA. Antes el botón desaparecía en "resuelta"
                y el dueño no tenía forma de intervenir. */}
            {/* Botones de modo BIEN visibles: azul sólido cuando atiende la
                IA (acción principal: tomar control), rojo sólido cuando está
                el humano (estás al mando — devolver a la IA). */}
            {!humanMode && (
              <button
                onClick={() => takeMut.mutate()}
                disabled={takeMut.isPending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 16px",
                  borderRadius: 7,
                  border: "1px solid oklch(0.55 0.17 255)",
                  background: "oklch(0.50 0.17 255)",
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 0 12px oklch(0.50 0.17 255 / 0.35)",
                  opacity: takeMut.isPending ? 0.6 : 1,
                }}
              >
                <User size={14} />
                <span className="hidden sm:inline">
                  {c.status === "resuelta" ? "Reabrir y tomar control" : "Tomar control"}
                </span>
              </button>
            )}
            {humanMode && (
              <button
                onClick={() => returnMut.mutate()}
                disabled={returnMut.isPending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 16px",
                  borderRadius: 7,
                  border: "1px solid oklch(0.58 0.21 25)",
                  background: "oklch(0.52 0.20 25)",
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 0 12px oklch(0.52 0.20 25 / 0.35)",
                  opacity: returnMut.isPending ? 0.6 : 1,
                }}
              >
                <IconSparkle size={14} />
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
          </div>
        </header>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          aria-label="Mensajes de la conversación"
          style={{ flex: 1, overflowY: "auto", padding: "20px 18px 12px" }}
        >
          {messagesQuery.hasNextPage && (
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => messagesQuery.fetchNextPage()}
                disabled={messagesQuery.isFetchingNextPage}
                style={{
                  padding: "5px 14px",
                  borderRadius: 6,
                  border: "1px solid var(--hair-strong)",
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--text-2)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {messagesQuery.isFetchingNextPage
                  ? "Cargando…"
                  : "Cargar mensajes anteriores"}
              </button>
            </div>
          )}
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
          {humanMode && outside24h && (
            <div
              role="note"
              style={{
                marginBottom: 6,
                padding: "8px 10px",
                borderRadius: 5,
                border: "1px solid oklch(0.80 0.14 75 / 0.4)",
                background: "oklch(0.80 0.14 75 / 0.08)",
                color: "var(--z-amber)",
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              El cliente escribió hace más de 24&nbsp;h. Por reglas de WhatsApp, no se
              puede enviar texto libre hasta que vuelva a escribir (solo plantillas
              aprobadas).
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
              disabled={!humanMode || outside24h || sendMut.isPending}
              placeholder={
                !humanMode
                  ? 'Pulsá "Tomar control" para escribir como humano.'
                  : outside24h
                    ? "Fuera de la ventana de 24 h de WhatsApp."
                    : "Escribí tu mensaje…"
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
                opacity: humanMode && !outside24h ? 1 : 0.6,
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,application/pdf"
                onChange={onFileSelected}
                style={{ display: "none" }}
              />
              <button
                aria-label="Adjuntar archivo"
                title={
                  !humanMode
                    ? "Tomá el control para adjuntar"
                    : outside24h
                      ? "Fuera de la ventana de 24 h"
                      : "Adjuntar foto, video, audio o PDF"
                }
                onClick={onPickFile}
                disabled={!humanMode || outside24h || sendMediaMut.isPending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: 5,
                  border: "none",
                  background: "transparent",
                  color: "var(--text-2)",
                  cursor: !humanMode || outside24h ? "not-allowed" : "pointer",
                  opacity: !humanMode || outside24h ? 0.5 : 1,
                }}
              >
                {sendMediaMut.isPending ? (
                  <Loader2 size={14} style={{ animation: "spin 900ms linear infinite" }} />
                ) : (
                  <Paperclip size={14} />
                )}
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
                disabled={!humanMode || outside24h || sendMut.isPending || !text.trim()}
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
                  opacity: !humanMode || outside24h || sendMut.isPending ? 0.5 : 1,
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
