"use client";

import { useState } from "react";
import { Search, Filter, MoreHorizontal } from "lucide-react";
import { UserAvatar } from "@/components/avatar";
import { HandlerTag } from "@/components/handler-tag";
import { ChannelIcon } from "@/components/channel-icon";
import type { Conversation, Channel } from "@/lib/api/types";

const CHANNEL_TABS: Array<{ key: Channel; label: string }> = [
  { key: "wa", label: "WhatsApp" },
  { key: "tg", label: "Telegram" },
];

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  channel: Channel;
  onChannelChange: (ch: Channel) => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function ConversationList({ conversations, selectedId, onSelect, channel, onChannelChange }: Props) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) => {
    if (c.channel !== channel) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.contactName.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unreadTotal = conversations.filter((c) => c.unreadCount > 0).length;

  return (
    <section
      aria-label="Lista de conversaciones"
      className="inbox-list-panel"
      style={{
        height: "100%",
        borderRight: "1px solid var(--hair)",
        display: "flex",
        flexDirection: "column",
        background: "rgba(0,0,0,0.12)",
        minWidth: 0,
      }}
    >
      {/* Header */}
      <header style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--hair)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>Inbox</div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-3)",
                fontFamily: "var(--font-jetbrains-mono)",
                marginTop: 2,
              }}
            >
              {unreadTotal} sin leer · {conversations.length} hoy
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              aria-label="Filtrar"
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
                cursor: "pointer",
              }}
            >
              <Filter size={14} />
            </button>
            <button
              aria-label="Más opciones"
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
                cursor: "pointer",
              }}
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div
          role="search"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(0,0,0,0.3)",
            border: "1px solid var(--hair)",
            borderRadius: 6,
            padding: "6px 9px",
            marginBottom: 10,
          }}
        >
          <Search size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
          <input
            type="search"
            placeholder="Buscar conversación…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar conversaciones"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-0)",
              fontSize: 12,
            }}
          />
          <kbd
            className="hidden md:inline-flex"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 10,
              color: "var(--text-3)",
              border: "1px solid var(--hair)",
              padding: "1px 5px",
              borderRadius: 3,
              flexShrink: 0,
            }}
          >
            ⌘K
          </kbd>
        </div>

        {/* Channel tabs */}
        <div role="tablist" aria-label="Canal" style={{ display: "flex", gap: 2, fontSize: 11 }}>
          {CHANNEL_TABS.map((t) => {
            const count = conversations.filter((c) => c.channel === t.key).length;
            const on = channel === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => onChannelChange(t.key)}
                style={{
                  flex: 1,
                  padding: "6px 6px",
                  borderRadius: 5,
                  border: "none",
                  background: on ? "rgba(255,255,255,0.07)" : "transparent",
                  color: on ? "var(--text-0)" : "var(--text-2)",
                  cursor: "pointer",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <ChannelIcon channel={t.key} size={12} active={on} />
                {t.label}
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "var(--text-3)",
                    fontSize: 10,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* List */}
      <div
        role="listbox"
        aria-label="Conversaciones"
        style={{ flex: 1, overflowY: "auto" }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-3)",
              fontSize: 12,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 24 }}>✨</span>
            <span>Todo en cero</span>
          </div>
        ) : (
          filtered.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              selected={c.id === selectedId}
              onSelect={() => onSelect(c.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ConversationRow({
  conversation: c,
  selected,
  onSelect,
}: {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      style={{
        width: "100%",
        textAlign: "left",
        border: "none",
        background: selected
          ? "linear-gradient(90deg, oklch(0.62 0.22 295 / 0.14), oklch(0.80 0.13 200 / 0.04))"
          : "transparent",
        padding: "10px 14px",
        borderBottom: "1px solid var(--hair)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        cursor: "pointer",
        position: "relative",
      }}
    >
      {selected && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: "var(--aurora)",
          }}
        />
      )}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <UserAvatar name={c.contactName} size={30} />
        <div
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "var(--bg-0)",
            border: "1px solid var(--hair-strong)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChannelIcon channel={c.channel} size={9} active />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontWeight: c.unreadCount ? 600 : 500,
              fontSize: 13,
              color: "var(--text-0)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.contactName}
          </span>
          <span
            suppressHydrationWarning
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "var(--text-3)",
              fontFamily: "var(--font-jetbrains-mono)",
              flexShrink: 0,
            }}
          >
            {relativeTime(c.updatedAt)}
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            color: c.unreadCount ? "var(--text-1)" : "var(--text-2)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginTop: 3,
          }}
        >
          {c.preview}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <HandlerTag status={c.status} />
          {c.unreadCount > 0 && (
            <span
              style={{
                marginLeft: "auto",
                background: "var(--aurora)",
                color: "#0a0a0f",
                fontFamily: "var(--font-jetbrains-mono)",
                fontWeight: 700,
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 10,
              }}
            >
              {c.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
