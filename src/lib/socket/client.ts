"use client";

import { io, type Socket } from "socket.io-client";
import { sessionStorage as zeroSession } from "@/lib/api/client";
import type { ServerToClientEvents, ClientToServerEvents } from "./events";

type ZeroSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ZeroSocket | null = null;

function resolveBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WS_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}

export function getSocket(): ZeroSocket {
  if (!socket) {
    const token = zeroSession.readToken() ?? "";
    socket = io(resolveBaseUrl(), {
      path: "/api/realtime",
      autoConnect: false,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      transports: ["websocket", "polling"],
      auth: { token },
    });
  }
  return socket;
}

export function connectSocket(tenantId: string): ZeroSocket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
    s.once("connect", () => {
      s.emit("join:tenant", tenantId);
    });
  } else {
    s.emit("join:tenant", tenantId);
  }
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
