"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarOff, Loader2, RefreshCw, Sparkles, User } from "lucide-react";
import { listUpcomingCalendarEvents } from "@/lib/api/calendar";
import { getCalendarStatus } from "@/lib/api/calendar";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import type { CalendarLiveEvent } from "@/lib/api/contract";

type RangeKey = "today" | "week" | "month";

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: "today", label: "Hoy", days: 1 },
  { key: "week", label: "7 días", days: 7 },
  { key: "month", label: "30 días", days: 30 },
];

export function BookingsView() {
  return <RequireTenant>{(tenantId) => <Bookings tenantId={tenantId} />}</RequireTenant>;
}

function Bookings({ tenantId }: { tenantId: string }) {
  const [range, setRange] = useState<RangeKey>("week");

  const rangeConfig = RANGES.find((r) => r.key === range)!;
  const { from, to } = useMemo(() => computeRange(rangeConfig.days), [rangeConfig.days]);

  const statusQuery = useQuery({
    queryKey: ["calendar-status", tenantId],
    queryFn: () => getCalendarStatus(tenantId),
    staleTime: 60_000,
  });

  const eventsQuery = useQuery({
    queryKey: ["calendar-events", tenantId, from, to],
    queryFn: () => listUpcomingCalendarEvents(tenantId, { from, to }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const calendarConnected = statusQuery.data?.status?.connected;
  const events = eventsQuery.data?.events ?? [];
  const grouped = useMemo(() => groupByDay(events), [events]);

  return (
    <PageShell
      title="Reservas"
      subtitle="Próximos turnos en Google Calendar. Se actualiza en vivo."
      actions={
        <button
          type="button"
          onClick={() => eventsQuery.refetch()}
          disabled={eventsQuery.isFetching}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 5,
            border: "1px solid var(--hair-strong)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--text-1)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {eventsQuery.isFetching ? (
            <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
          ) : (
            <RefreshCw size={12} />
          )}
          Refrescar
        </button>
      }
    >
      {/* Estado: calendar no conectado → invitá a conectar */}
      {statusQuery.data && calendarConnected === false && (
        <div
          className="glass"
          style={{
            ...cardStyle,
            marginBottom: 14,
            borderColor: "oklch(0.80 0.14 75 / 0.35)",
            background: "oklch(0.80 0.14 75 / 0.06)",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <CalendarOff size={16} style={{ color: "var(--z-amber)", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "var(--text-0)", fontSize: 13 }}>
              Google Calendar no está conectado
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, lineHeight: 1.4 }}>
              Conectalo para ver y gestionar los turnos que el bot reserva.
            </div>
          </div>
          <Link
            href="/integrations"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 5,
              background: "var(--aurora)",
              color: "#0a0a0f",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            Conectar
          </Link>
        </div>
      )}

      {/* Tabs de rango */}
      <div
        role="tablist"
        aria-label="Rango de fechas"
        style={{
          display: "inline-flex",
          gap: 2,
          padding: 3,
          background: "rgba(0,0,0,0.25)",
          borderRadius: 8,
          border: "1px solid var(--hair)",
          marginBottom: 14,
        }}
      >
        {RANGES.map((r) => {
          const on = range === r.key;
          return (
            <button
              key={r.key}
              role="tab"
              aria-selected={on}
              onClick={() => setRange(r.key)}
              style={{
                padding: "6px 14px",
                borderRadius: 5,
                border: "none",
                background: on ? "rgba(255,255,255,0.07)" : "transparent",
                color: on ? "var(--text-0)" : "var(--text-2)",
                fontSize: 12,
                fontWeight: on ? 500 : 400,
                cursor: "pointer",
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {eventsQuery.isLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          <Loader2 size={14} style={{ animation: "spin 900ms linear infinite", verticalAlign: "middle" }} />{" "}
          Cargando…
        </div>
      ) : events.length === 0 ? (
        <EmptyState connected={calendarConnected !== false} range={rangeConfig.label} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {grouped.map((group) => (
            <DayGroup key={group.key} title={group.label} events={group.events} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function EmptyState({ connected, range }: { connected: boolean; range: string }) {
  return (
    <div
      style={{
        padding: "40px 24px",
        borderRadius: 10,
        border: "1px dashed var(--hair-strong)",
        background: "rgba(255,255,255,0.015)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>
        No hay reservas activas
      </div>
      <div style={{ fontSize: 12, color: "var(--text-2)", maxWidth: 420, lineHeight: 1.5 }}>
        {connected
          ? `Ventana: ${range.toLowerCase()}. Las reservas canceladas y las que ya pasaron no se muestran.`
          : "Conectá Google Calendar para empezar a ver los turnos acá."}
      </div>
    </div>
  );
}

function DayGroup({ title, events }: { title: string; events: CalendarLiveEvent[] }) {
  return (
    <section>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {title}
        <span
          style={{
            marginLeft: 8,
            fontFamily: "var(--font-jetbrains-mono)",
            color: "var(--text-3)",
          }}
        >
          · {events.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {events.map((ev) => (
          <EventRow key={ev.id} event={ev} />
        ))}
      </div>
    </section>
  );
}

function EventRow({ event }: { event: CalendarLiveEvent }) {
  const start = event.start_at ? new Date(event.start_at) : null;
  const end = event.end_at ? new Date(event.end_at) : null;
  const durationMin =
    start && end
      ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000))
      : null;

  const timeLabel = start
    ? event.is_all_day
      ? "Todo el día"
      : start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "—";
  const endLabel = end && !event.is_all_day
    ? end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div
      className="glass"
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
        minWidth: 0,
      }}
    >
      <div
        style={{
          minWidth: 64,
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text-0)",
          flexShrink: 0,
        }}
      >
        {timeLabel}
        {endLabel && (
          <span
            style={{
              display: "block",
              fontSize: 10,
              color: "var(--text-3)",
              fontWeight: 400,
            }}
          >
            {endLabel}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-0)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {event.summary || "(sin título)"}
        </div>
        {(event.description || event.location) && (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-2)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.description ?? event.location}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {durationMin !== null && !event.is_all_day && (
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-jetbrains-mono)",
              color: "var(--text-3)",
            }}
          >
            {durationMin}min
          </span>
        )}
        <SourceBadge source={event.source} />
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: "bot" | "external" }) {
  const isBot = source === "bot";
  return (
    <span
      title={isBot ? "Reservado por el bot" : "Creado desde Google Calendar"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "var(--font-jetbrains-mono)",
        background: isBot
          ? "oklch(0.62 0.22 295 / 0.12)"
          : "rgba(255,255,255,0.04)",
        color: isBot ? "var(--z-cyan)" : "var(--text-3)",
        border: isBot
          ? "1px solid oklch(0.62 0.22 295 / 0.3)"
          : "1px solid var(--hair)",
      }}
    >
      {isBot ? <Sparkles size={9} /> : <User size={9} />}
      {isBot ? "bot" : "manual"}
    </span>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function computeRange(days: number): { from: string; to: string } {
  const now = new Date();
  const from = now;
  const to = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

interface DayGroup {
  key: string;
  label: string;
  events: CalendarLiveEvent[];
}

function groupByDay(events: CalendarLiveEvent[]): DayGroup[] {
  const groups = new Map<string, { label: string; events: CalendarLiveEvent[] }>();

  for (const ev of events) {
    if (!ev.start_at) continue;
    const date = new Date(ev.start_at);
    const key = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const label = formatDayLabel(date);
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(ev);
    } else {
      groups.set(key, { label, events: [ev] });
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, label: value.label, events: value.events }));
}

function formatDayLabel(date: Date): string {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Mañana";
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  }
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
