"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ConversationList } from "./conversation-list";
import { ConversationPane } from "./conversation-pane";
import { listConversations } from "@/lib/api/conversations";
import { useAuthStore } from "@/store/auth";
import { useRealtime } from "@/lib/socket/use-realtime";
import type { Channel } from "@/lib/api/types";

const PAGE_SIZE = 50;

export function InboxView() {
  const [channel, setChannel] = useState<Channel>("wa");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"list" | "pane">("list");

  const tenantId = useAuthStore((s) => s.activeTenantId);

  useRealtime(tenantId);

  // Paginación por offset: con +50 conversaciones las viejas eran
  // inalcanzables (top-50 fijo). "Cargar más" trae la siguiente página.
  const query = useInfiniteQuery({
    queryKey: ["conversations", tenantId, channel],
    queryFn: ({ pageParam }) =>
      listConversations({
        tenantId: tenantId!,
        channel,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((n, p) => n + p.conversations.length, 0);
      return lastPage.conversations.length >= PAGE_SIZE && loaded < lastPage.total
        ? loaded
        : undefined;
    },
    enabled: !!tenantId,
    refetchInterval: 15_000,
  });

  const conversations = useMemo(() => {
    const merged = (query.data?.pages ?? []).flatMap((p) => p.conversations);
    // El offset puede solapar entre refetches (el orden cambia con cada
    // mensaje): dedup por id.
    const seen = new Set<string>();
    return merged.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  }, [query.data]);

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
          hasMore={!!query.hasNextPage}
          loadingMore={query.isFetchingNextPage}
          onLoadMore={() => query.fetchNextPage()}
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
          // key: remonta el pane al cambiar de conversación — el texto a medio
          // escribir para un cliente jamás queda cargado para otro.
          <ConversationPane
            key={selected.id}
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
