"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { getConversation } from "@/lib/api/conversations";
import { ConversationPane } from "@/components/inbox/conversation-pane";
import { useAuthStore } from "@/store/auth";
import { useRealtime } from "@/lib/socket/use-realtime";

interface Props {
  params: Promise<{ id: string }>;
}

export default function ConversationPage({ params }: Props) {
  const { id } = use(params);
  const tenantId = useAuthStore((s) => s.activeTenantId);

  useRealtime(tenantId);

  const query = useQuery({
    queryKey: ["conversation", tenantId, id],
    queryFn: () => getConversation(tenantId!, id),
    enabled: !!tenantId,
  });

  if (!tenantId || query.isLoading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-3)",
          fontSize: 12,
        }}
      >
        Cargando conversación…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--z-red)",
          fontSize: 12,
        }}
      >
        No pudimos cargar la conversación.
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ConversationPane tenantId={tenantId} conversation={query.data} />
    </div>
  );
}
