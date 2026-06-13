"use client";

import { useEffect, useRef } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { connectSocket, disconnectSocket, subscribeConversationRoom } from "./client";
import type { Message } from "@/lib/api/types";
import type { RealtimeBackendMessage } from "./events";

function mapMessage(m: RealtimeBackendMessage): Message {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    from: m.from,
    text: m.text,
    sentAt: m.sent_at,
  };
}

// El cache de mensajes es de useInfiniteQuery: pages[0] = el batch más
// reciente. Los mensajes nuevos se agregan al final de pages[0].
type MessagesCache = InfiniteData<Message[]>;

function appendToMessagesCache(
  prev: MessagesCache | undefined,
  mapped: Message
): MessagesCache | undefined {
  if (!prev || prev.pages.length === 0) return prev;
  if (prev.pages.some((page) => page.some((m) => m.id === mapped.id))) return prev;
  const pages = prev.pages.slice();
  pages[0] = [...pages[0], mapped];
  return { ...prev, pages };
}

export function useRealtime(tenantId: string | null | undefined): void {
  const qc = useQueryClient();
  // Throttle del refetch de la lista: un tenant ocupado emite message:new por
  // cada burbuja/fragmento del streaming, y cada refetch de la lista cuesta
  // decenas de queries en el backend. Máximo un refetch cada 3s (con trailing
  // para no perder el último estado).
  const lastInvalidateRef = useRef(0);
  const pendingInvalidateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const socket = connectSocket(tenantId);

    const invalidateConversations = () => {
      const THROTTLE_MS = 3_000;
      const run = () => {
        lastInvalidateRef.current = Date.now();
        qc.invalidateQueries({ queryKey: ["conversations", tenantId] });
      };
      const elapsed = Date.now() - lastInvalidateRef.current;
      if (elapsed >= THROTTLE_MS) {
        run();
        return;
      }
      if (!pendingInvalidateRef.current) {
        pendingInvalidateRef.current = setTimeout(() => {
          pendingInvalidateRef.current = null;
          run();
        }, THROTTLE_MS - elapsed);
      }
    };

    const onMessage = (payload: {
      conversationId: string;
      message: RealtimeBackendMessage;
    }) => {
      const mapped = mapMessage(payload.message);
      const messagesKey = ["messages", tenantId, payload.conversationId];
      const existing = qc.getQueryData<MessagesCache>(messagesKey);
      if (existing) {
        qc.setQueryData<MessagesCache>(messagesKey, (prev) =>
          appendToMessagesCache(prev, mapped)
        );
      } else {
        // El fetch inicial está en vuelo (o aún no abrieron la conversación):
        // invalidar en vez de descartar para no perder el mensaje.
        qc.invalidateQueries({ queryKey: messagesKey });
      }
      invalidateConversations();
    };

    const onStatus = () => {
      invalidateConversations();
    };

    const onConversationNew = () => {
      invalidateConversations();
    };

    const onRequestNew = () => {
      qc.invalidateQueries({ queryKey: ["requests", tenantId] });
    };

    socket.on("message:new", onMessage);
    socket.on("conversation:status", onStatus);
    socket.on("conversation:new", onConversationNew);
    socket.on("request:new", onRequestNew);

    return () => {
      socket.off("message:new", onMessage);
      socket.off("conversation:status", onStatus);
      socket.off("conversation:new", onConversationNew);
      socket.off("request:new", onRequestNew);
      if (pendingInvalidateRef.current) {
        clearTimeout(pendingInvalidateRef.current);
        pendingInvalidateRef.current = null;
      }
    };
  }, [tenantId, qc]);

  useEffect(() => {
    return () => {
      // Disconnect only when the app unmounts (React Strict Mode will double-fire
      // this effect in dev; that's OK because the singleton is re-created lazily).
      disconnectSocket();
    };
  }, []);
}

export function subscribeConversation(conversationId: string): () => void {
  // Delegado al client para que la suscripción sobreviva reconexiones.
  return subscribeConversationRoom(conversationId);
}
