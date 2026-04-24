"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ConversationList } from "./conversation-list";
import { ConversationPane } from "./conversation-pane";
import { listConversations } from "@/lib/api/conversations";
import { useAuthStore } from "@/store/auth";
import { useRealtime } from "@/lib/socket/use-realtime";
import type { Channel } from "@/lib/api/types";

export function InboxView() {
  const [channel, setChannel] = useState<Channel>("wa");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"list" | "pane">("list");

  const tenantId = useAuthStore((s) => s.activeTenantId);

  useRealtime(tenantId);

  const query = useQuery({
    queryKey: ["conversations", tenantId, channel],
    queryFn: () =>
      listConversations({ tenantId: tenantId!, channel, limit: 50 }),
    enabled: !!tenantId,
    refetchInterval: 15_000,
  });

  const conversations = useMemo(
    () => query.data?.conversations ?? [],
    [query.data?.conversations]
  );

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  function handleSelect(id: string) {
    setSelectedId(id);
    setMobilePanel("pane");
  }

  function handleBack() {
    setMobilePanel("list");
  }

  function handleChannelChange(ch: Channel) {
    setChannel(ch);
    setSelectedId(null);
    setMobilePanel("list");
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {/* Conversation list — hidden on mobile when pane is open */}
      <div
        className={
          mobilePanel === "pane"
            ? "hidden md:flex h-full min-w-0"
            : "flex flex-1 md:flex-none h-full min-w-0"
        }
      >
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={handleSelect}
          channel={channel}
          onChannelChange={handleChannelChange}
        />
      </div>

      {/* Conversation pane — hidden on mobile when list is shown */}
      <div
        className={
          mobilePanel === "list"
            ? "hidden md:flex flex-1 min-w-0 h-full"
            : "flex flex-1 min-w-0 h-full"
        }
      >
        {selected && tenantId ? (
          <ConversationPane
            tenantId={tenantId}
            conversation={selected}
            onBack={handleBack}
          />
        ) : (
          <div
            className="hidden md:flex"
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-3)",
              fontSize: 12,
            }}
          >
            {query.isLoading
              ? "Cargando conversaciones…"
              : "Seleccioná una conversación"}
          </div>
        )}
      </div>
    </div>
  );
}
