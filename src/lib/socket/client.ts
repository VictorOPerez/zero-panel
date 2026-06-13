"use client";

import { io, type Socket } from "socket.io-client";
import { sessionStorage as zeroSession } from "@/lib/api/client";
import type { ServerToClientEvents, ClientToServerEvents } from "./events";

type ZeroSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ZeroSocket | null = null;

// Estado de suscripción que debe sobrevivir a las reconexiones: socket.io
// re-dispara "connect" tras cada caída (WiFi, deploy, laptop dormida) pero los
// rooms del servidor se pierden con la conexión vieja — hay que re-joinear.
let joinedTenantId: string | null = null;
const subscribedConversations = new Map<string, number>();

function resolveBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WS_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}

function rejoinRooms(s: ZeroSocket): void {
  if (joinedTenantId) s.emit("join:tenant", joinedTenantId);
  for (const conversationId of subscribedConversations.keys()) {
    s.emit("subscribe:conversation", conversationId);
  }
}

export function getSocket(): ZeroSocket {
  if (!socket) {
    const token = zeroSession.readToken() ?? "";
    socket = io(resolveBaseUrl(), {
      path: "/api/realtime",
      autoConnect: false,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 15_000,
      transports: ["websocket", "polling"],
      auth: { token },
    });
    // Handler persistente (NO once): corre en la conexión inicial y en cada
    // reconexión automática.
    socket.on("connect", () => rejoinRooms(socket!));
  }
  return socket;
}

export function connectSocket(tenantId: string): ZeroSocket {
  const s = getSocket();
  joinedTenantId = tenantId;
  if (!s.connected) {
    s.connect();
  } else {
    s.emit("join:tenant", tenantId);
  }
  return s;
}

export function subscribeConversationRoom(conversationId: string): () => void {
  const s = getSocket();
  const count = subscribedConversations.get(conversationId) ?? 0;
  subscribedConversations.set(conversationId, count + 1);
  if (s.connected && count === 0) {
    s.emit("subscribe:conversation", conversationId);
  }
  return () => {
    const current = subscribedConversations.get(conversationId) ?? 0;
    if (current <= 1) {
      subscribedConversations.delete(conversationId);
      if (s.connected) s.emit("unsubscribe:conversation", conversationId);
    } else {
      subscribedConversations.set(conversationId, current - 1);
    }
  };
}

export function disconnectSocket(): void {
  joinedTenantId = null;
  subscribedConversations.clear();
  socket?.disconnect();
  socket = null;
}
