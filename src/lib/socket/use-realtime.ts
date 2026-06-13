"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

export function useRealtime(tenantId: string | null | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!tenantId) return;

    const socket = connectSocket(tenantId);

    const onMessage = (payload: {
      conversationId: string;
      message: RealtimeBackendMessage;
    }) => {
      const mapped = mapMessage(payload.message);
      const messagesKey = ["messages", tenantId, payload.conversationId];
      const existing = qc.getQueryData<Message[]>(messagesKey);
      if (existing) {
        qc.setQueryData<Message[]>(messagesKey, (prev) =>
          prev!.some((m) => m.id === mapped.id) ? prev! : [...prev!, mapped]
        );
      } else {
        // El fetch inicial está en vuelo (o aún no abrieron la conversación):
        // invalidar en vez de descartar para no perder el mensaje.
        qc.invalidateQueries({ queryKey: messagesKey });
      }
      qc.invalidateQueries({ queryKey: ["conversations", tenantId] });
    };

    const onStatus = () => {
      qc.invalidateQueries({ queryKey: ["conversations", tenantId] });
    };

    const onConversationNew = () => {
      qc.invalidateQueries({ queryKey: ["conversations", tenantId] });
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
    };
  }, [tenantId, qc]);

  useEffect(() => {
    return () => {
      // Disconnect only when the app unmounts (React Strict Mode will double-fire
      // this effect in dev; that's OK because the singleton is re-created lazily).
      disconnectSocket();
    };
  }, []);

  // Subscribe helper for conversation-level rooms.
  return;
}

export function subscribeConversation(conversationId: string): () => void {
  // Delegado al client para que la suscripción sobreviva reconexiones.
  return subscribeConversationRoom(conversationId);
}
