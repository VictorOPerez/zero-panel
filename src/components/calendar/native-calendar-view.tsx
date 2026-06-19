"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  listUpcomingCalendarEvents,
  createAppointment,
  updateAppointment,
  cancelAppointment,
} from "@/lib/api/calendar";
import { ApiError } from "@/lib/api/client";
import { PageShell } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import type { CalendarLiveEvent } from "@/lib/api/contract";

// ── Constantes de layout (grilla de tiempo estilo Google Calendar) ──────────
const HOUR_HEIGHT = 48; // px por hora
const PX_PER_MIN = HOUR_HEIGHT / 60;
const DAY_MINUTES = 24 * 60;
const GUTTER = 56; // ancho de la columna de horas
const SNAP_MIN = 15; // al hacer click, redondea a 15 min

type ViewMode = "day" | "week" | "month";

type Editor =
  | { mode: "create"; date: string; time?: string; duration?: number }
  | { mode: "edit"; event: CalendarLiveEvent };

export function NativeCalendarView() {
  return <RequireTenant>{(tenantId) => <Calendar tenantId={tenantId} />}</RequireTenant>;
}

function Calendar({ tenantId }: { tenantId: string }) {
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [editor, setEditor] = useState<Editor | null>(null);
  // Reloj para mover la línea de "ahora" y recalcular el día actual.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Rango visible según la vista (la query lo usa como ventana).
  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const { from, to } = {
    from: range.start.toISOString(),
    to: range.end.toISOString(),
  };

  const eventsQuery = useQuery({
    queryKey: ["calendar-events", tenantId, from, to],
    // includePast: la vista navega a semanas/meses arbitrarios → necesita el
    // histórico exacto del rango, no sólo lo futuro.
    queryFn: () => listUpcomingCalendarEvents(tenantId, { from, to, includePast: true }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const events = useMemo(() => eventsQuery.data?.events ?? [], [eventsQuery.data]);

  const goToday = () => setAnchor(startOfDay(new Date()));
  const step = (dir: 1 | -1) =>
    setAnchor((a) => {
      if (view === "month") return addMonths(a, dir);
      return addDays(a, dir * (view === "week" ? 7 : 1));
    });
  // Navegar a la vista Día de una fecha (click en un día del Mes o en el
  // encabezado de un día de la Semana). NO abre el modal de crear — fue una
  // queja real: "le doy a un día y se me abre crear reserva".
  const goToDay = (date: Date) => {
    setAnchor(startOfDay(date));
    setView("day");
  };

  return (
    <PageShell
      title="Calendario"
      subtitle="Los turnos que toma el bot y los que agregás a mano. Reservás sin conectar Google."
      actions={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => eventsQuery.refetch()}
            disabled={eventsQuery.isFetching}
            style={secondaryBtn}
            title="Refrescar"
          >
            {eventsQuery.isFetching ? (
              <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <RefreshCw size={12} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setEditor({ mode: "create", date: localDayKey(anchor) })}
            style={primaryBtn}
          >
            <CalendarPlus size={13} />
            Crear
          </button>
        </div>
      }
    >
      {/* Toolbar: hoy / ‹ › / título / Día-Semana-Mes */}
      <div style={toolbar}>
        <button type="button" onClick={goToday} style={{ ...secondaryBtn, padding: "7px 14px" }}>
          Hoy
        </button>
        <div style={{ display: "flex", gap: 2 }}>
          <button type="button" aria-label="Anterior" onClick={() => step(-1)} style={navBtn}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" aria-label="Siguiente" onClick={() => step(1)} style={navBtn}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div style={titleLabel}>{titleFor(view, anchor)}</div>

        <div className="filter-tabs" style={{ marginLeft: "auto" }}>
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              style={view === v ? segActive : segIdle}
            >
              {v === "day" ? "Día" : v === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </div>

      {eventsQuery.isError && (
        <div role="alert" style={errorBanner}>
          No pudimos cargar las reservas. Probá refrescar.
        </div>
      )}

      {view === "month" ? (
        <MonthGrid
          anchor={anchor}
          now={now}
          events={events}
          onDayClick={(date) => goToDay(date)}
          onEventClick={(ev) => setEditor({ mode: "edit", event: ev })}
        />
      ) : (
        <TimeGrid
          days={view === "week" ? weekDays(anchor) : [anchor]}
          now={now}
          events={events}
          loading={eventsQuery.isLoading}
          singleDay={view === "day"}
          onSlotClick={(key, time) =>
            setEditor({ mode: "create", date: key, time })
          }
          onEventClick={(ev) => setEditor({ mode: "edit", event: ev })}
          onDayHeaderClick={(date) => goToDay(date)}
        />
      )}

      {editor && (
        <AppointmentModal tenantId={tenantId} editor={editor} onClose={() => setEditor(null)} />
      )}
    </PageShell>
  );
}

// ── Vista de tiempo (Día / Semana): eje de horas × columnas de días ─────────

function TimeGrid({
  days,
  now,
  events,
  loading,
  singleDay,
  onSlotClick,
  onEventClick,
  onDayHeaderClick,
}: {
  days: Date[];
  now: Date;
  events: CalendarLiveEvent[];
  loading: boolean;
  singleDay: boolean;
  onSlotClick: (dayKey: string, time: string) => void;
  onEventClick: (ev: CalendarLiveEvent) => void;
  onDayHeaderClick: (date: Date) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const todayKey = localDayKey(now);

  // Separar timed vs all-day. Los all-day (o sin hora) van a una banda arriba;
  // si se mezclaran en la grilla se verían como un bloque de día completo.
  const { timedByDay, allDayByDay, hasAllDay } = useMemo(
    () => splitEvents(events),
    [events]
  );

  // Al montar (o cambiar la cantidad de días: día↔semana), desplazar a ~7:00.
  // Medimos el offset real del cuerpo para saltar el header sticky con exactitud.
  useEffect(() => {
    if (scrollRef.current && bodyRef.current) {
      scrollRef.current.scrollTop = bodyRef.current.offsetTop + 7 * HOUR_HEIGHT - 12;
    }
  }, [days.length, hasAllDay]);

  const cols = `${GUTTER}px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
      <div
        ref={scrollRef}
        style={{
          maxHeight: "calc(100vh - 290px)",
          minHeight: 440,
          overflowY: "auto",
          position: "relative",
        }}
      >
        {/* Header sticky (días + banda todo-el-día). Dentro del scroll → alinea
            perfecto con el cuerpo sin importar el ancho del scrollbar. */}
        <div style={{ position: "sticky", top: 0, zIndex: 6, background: "var(--bg-1)" }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--hair)" }}>
            <div style={{ borderRight: "1px solid var(--hair)" }} />
            {days.map((d) => {
              const isToday = localDayKey(d) === todayKey;
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => onDayHeaderClick(d)}
                  title={singleDay ? undefined : "Ver este día"}
                  style={{ ...dayHeadCell, cursor: singleDay ? "default" : "pointer" }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: isToday ? "var(--z-cyan)" : "var(--text-3)",
                      fontWeight: 600,
                    }}
                  >
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 28,
                      height: 28,
                      borderRadius: 999,
                      fontSize: 15,
                      fontWeight: 600,
                      fontFamily: "var(--font-jetbrains-mono)",
                      color: isToday ? "#0a0a0f" : "var(--text-1)",
                      background: isToday ? "var(--aurora)" : "transparent",
                    }}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Banda "todo el día" — sólo si hay alguno en los días visibles */}
          {hasAllDay && (
            <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--hair)" }}>
              <div
                style={{
                  borderRight: "1px solid var(--hair)",
                  fontSize: 9,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "6px 6px 0",
                  textAlign: "right",
                }}
              >
                Todo el día
              </div>
              {days.map((day) => {
                const key = localDayKey(day);
                const list = allDayByDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    style={{
                      borderRight: "1px solid var(--hair)",
                      padding: 4,
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      minHeight: 26,
                    }}
                  >
                    {list.map((ev) => (
                      <AllDayChip key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cuerpo: gutter de horas + columnas por día */}
        <div ref={bodyRef} style={{ display: "grid", gridTemplateColumns: cols, position: "relative" }}>
          {/* Gutter de horas */}
          <div style={{ position: "relative", height: DAY_MINUTES * PX_PER_MIN, borderRight: "1px solid var(--hair)" }}>
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <div
                key={h}
                style={{
                  position: "absolute",
                  top: h * HOUR_HEIGHT - 6,
                  right: 8,
                  fontSize: 10,
                  color: "var(--text-3)",
                  fontFamily: "var(--font-jetbrains-mono)",
                }}
              >
                {hourLabel(h)}
              </div>
            ))}
          </div>

          {/* Columnas por día */}
          {days.map((day) => {
            const key = localDayKey(day);
            const placed = layoutDayEvents(timedByDay.get(key) ?? []);
            const isToday = key === todayKey;
            const nowMin = now.getHours() * 60 + now.getMinutes();
            return (
              <div
                key={key}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return; // sólo el fondo vacío
                  const rect = e.currentTarget.getBoundingClientRect();
                  const min = clampSnap((e.clientY - rect.top) / PX_PER_MIN);
                  onSlotClick(key, minToHHMM(min));
                }}
                style={{
                  position: "relative",
                  height: DAY_MINUTES * PX_PER_MIN,
                  borderRight: "1px solid var(--hair)",
                  cursor: "pointer",
                  background: isToday ? "oklch(0.80 0.13 200 / 0.03)" : undefined,
                  backgroundImage: hourLinesBg,
                }}
              >
                {placed.map(({ event, colIndex, cols: n, startMin, endMin }) => (
                  <EventBlock
                    key={event.id}
                    event={event}
                    top={startMin * PX_PER_MIN}
                    height={Math.max((endMin - startMin) * PX_PER_MIN, 18)}
                    leftPct={(colIndex / n) * 100}
                    widthPct={(1 / n) * 100}
                    onClick={() => onEventClick(event)}
                  />
                ))}

                {isToday && nowMin >= 0 && nowMin <= DAY_MINUTES && (
                  <div style={{ position: "absolute", left: 0, right: 0, top: nowMin * PX_PER_MIN, zIndex: 5, pointerEvents: "none" }}>
                    <div style={{ position: "absolute", left: -4, top: -4, width: 8, height: 8, borderRadius: 999, background: "var(--z-red)" }} />
                    <div style={{ height: 2, background: "var(--z-red)" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {loading && (
          <div style={{ position: "absolute", top: 8, left: 0, right: 0, textAlign: "center", zIndex: 7, pointerEvents: "none" }}>
            <Loader2 size={14} style={{ animation: "spin 900ms linear infinite", color: "var(--text-3)" }} />
          </div>
        )}
      </div>
    </div>
  );
}

function AllDayChip({ event, onClick }: { event: CalendarLiveEvent; onClick: () => void }) {
  const isBot = event.source === "bot";
  const accent = isBot ? "oklch(0.62 0.22 295)" : "oklch(0.80 0.13 200)";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={event.summary || "(sin título)"}
      style={{
        textAlign: "left",
        border: "none",
        borderLeft: `3px solid ${accent}`,
        background: isBot ? "oklch(0.62 0.22 295 / 0.18)" : "oklch(0.80 0.13 200 / 0.14)",
        borderRadius: 4,
        padding: "2px 6px",
        fontSize: 10.5,
        fontWeight: 500,
        color: "var(--text-0)",
        cursor: "pointer",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {event.summary || "(sin título)"}
    </button>
  );
}

function EventBlock({
  event,
  top,
  height,
  leftPct,
  widthPct,
  onClick,
}: {
  event: CalendarLiveEvent;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  onClick: () => void;
}) {
  const isBot = event.source === "bot";
  const accent = isBot ? "oklch(0.62 0.22 295)" : "oklch(0.80 0.13 200)";
  const start = event.start_at ? new Date(event.start_at) : null;
  const compact = height < 34;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={event.summary || "(sin título)"}
      style={{
        position: "absolute",
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        textAlign: "left",
        padding: compact ? "1px 6px" : "3px 7px",
        borderRadius: 6,
        border: `1px solid ${accent}`,
        borderLeft: `3px solid ${accent}`,
        background: isBot
          ? "oklch(0.62 0.22 295 / 0.20)"
          : "oklch(0.80 0.13 200 / 0.16)",
        color: "var(--text-0)",
        cursor: "pointer",
        overflow: "hidden",
        display: "flex",
        flexDirection: compact ? "row" : "column",
        gap: compact ? 5 : 1,
        alignItems: compact ? "center" : "stretch",
        zIndex: 3,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-0)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          flexShrink: 0,
        }}
      >
        {isBot && <Sparkles size={9} style={{ color: accent }} />}
        {event.summary || "(sin título)"}
      </span>
      {start && (
        <span style={{ fontSize: 10, color: "var(--text-2)", fontFamily: "var(--font-jetbrains-mono)" }}>
          {fmtTime(start)}
        </span>
      )}
    </button>
  );
}

// ── Vista de Mes ────────────────────────────────────────────────────────────

function MonthGrid({
  anchor,
  now,
  events,
  onDayClick,
  onEventClick,
}: {
  anchor: Date;
  now: Date;
  events: CalendarLiveEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (ev: CalendarLiveEvent) => void;
}) {
  const cells = useMemo(() => monthCells(anchor), [anchor]);
  const byDay = useMemo(() => groupByLocalDay(events), [events]);
  const todayKey = localDayKey(now);
  const month = anchor.getMonth();
  const weekdays = cells.slice(0, 7);

  return (
    <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--hair)" }}>
        {weekdays.map((d) => (
          <div
            key={d.toISOString()}
            style={{
              padding: "8px 10px",
              textAlign: "center",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-3)",
              fontWeight: 600,
            }}
          >
            {d.toLocaleDateString(undefined, { weekday: "short" })}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map((d, i) => {
          const key = localDayKey(d);
          const dayEvents = (byDay.get(key) ?? []).sort(sortByStart);
          const isToday = key === todayKey;
          const dim = d.getMonth() !== month;
          return (
            <div
              key={key}
              onClick={(e) => {
                if (e.target === e.currentTarget) onDayClick(d);
              }}
              style={{
                minHeight: 104,
                padding: 6,
                borderRight: (i + 1) % 7 === 0 ? undefined : "1px solid var(--hair)",
                borderBottom: i < 35 ? "1px solid var(--hair)" : undefined,
                background: dim ? "rgba(0,0,0,0.15)" : isToday ? "oklch(0.80 0.13 200 / 0.04)" : undefined,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <span
                style={{
                  alignSelf: "flex-start",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 22,
                  height: 22,
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: isToday ? "#0a0a0f" : dim ? "var(--text-3)" : "var(--text-1)",
                  background: isToday ? "var(--aurora)" : "transparent",
                  pointerEvents: "none",
                }}
              >
                {d.getDate()}
              </span>
              {dayEvents.slice(0, 3).map((ev) => {
                const isBot = ev.source === "bot";
                const accent = isBot ? "oklch(0.62 0.22 295)" : "oklch(0.80 0.13 200)";
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    style={{
                      textAlign: "left",
                      border: "none",
                      borderLeft: `3px solid ${accent}`,
                      background: isBot ? "oklch(0.62 0.22 295 / 0.16)" : "oklch(0.80 0.13 200 / 0.14)",
                      borderRadius: 4,
                      padding: "2px 5px",
                      fontSize: 10.5,
                      color: "var(--text-0)",
                      cursor: "pointer",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "flex",
                      gap: 4,
                      alignItems: "center",
                    }}
                  >
                    {ev.start_at && (
                      <span style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-2)", flexShrink: 0 }}>
                        {fmtTime(new Date(ev.start_at))}
                      </span>
                    )}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {ev.summary || "(sin título)"}
                    </span>
                  </button>
                );
              })}
              {dayEvents.length > 3 && (
                <span style={{ fontSize: 10, color: "var(--text-3)", paddingLeft: 4 }}>
                  +{dayEvents.length - 3} más
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Modal crear / editar ────────────────────────────────────────────────────

function AppointmentModal({
  tenantId,
  editor,
  onClose,
}: {
  tenantId: string;
  editor: Editor;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = editor.mode === "edit";
  const existing = isEdit ? editor.event : null;

  const initial = useMemo(() => {
    if (existing && existing.start_at) {
      const s = new Date(existing.start_at);
      const e = existing.end_at ? new Date(existing.end_at) : new Date(s.getTime() + 30 * 60000);
      return {
        date: localDayKey(s),
        time: hhmm(s),
        duration: Math.max(5, Math.round((e.getTime() - s.getTime()) / 60000)),
        title: existing.summary ?? "",
      };
    }
    return {
      date: editor.mode === "create" ? editor.date : localDayKey(new Date()),
      time: editor.mode === "create" && editor.time ? editor.time : "09:00",
      duration: editor.mode === "create" && editor.duration ? editor.duration : 30,
      title: "",
    };
  }, [existing, editor]);

  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(String(initial.duration));
  const [clientName, setClientName] = useState(initial.title);
  const [clientPhone, setClientPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [overlap, setOverlap] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["calendar-events", tenantId] });
    qc.invalidateQueries({ queryKey: ["calendar-events"] });
  };

  const handleError = (err: unknown) => {
    if (err instanceof ApiError) {
      const reason = (err.payload as { reason?: string }).reason;
      if (reason === "overlap") {
        setOverlap(true);
        setError("Ese horario pisa otra reserva. Podés forzarlo igual.");
        return;
      }
      setError(err.payload.error || "No se pudo guardar.");
      return;
    }
    setError("No se pudo guardar.");
  };

  const save = useMutation({
    mutationFn: (force: boolean) => {
      const dur = Math.max(5, parseInt(duration, 10) || 30);
      const startIso = toIso(date, time);
      const endIso = new Date(new Date(startIso).getTime() + dur * 60000).toISOString();
      const payload = {
        startIso,
        endIso,
        clientName: clientName.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        force,
      };
      if (isEdit && existing) {
        return updateAppointment(tenantId, existing.google_event_id, payload);
      }
      return createAppointment(tenantId, payload);
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: handleError,
  });

  const cancel = useMutation({
    mutationFn: () => cancelAppointment(tenantId, existing!.google_event_id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: handleError,
  });

  const submit = (force: boolean) => {
    setError(null);
    setOverlap(false);
    if (!date || !time) {
      setError("Completá la fecha y la hora.");
      return;
    }
    save.mutate(force);
  };

  const busy = save.isPending || cancel.isPending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={overlayStyle}
    >
      <div
        className="glass-strong"
        style={{ width: 440, maxWidth: "100%", borderRadius: 12, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={modalHeader}>
          <CalendarPlus size={16} style={{ color: "var(--z-cyan)" }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {isEdit ? "Editar reserva" : "Nueva reserva"}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={closeBtn}>
            <X size={14} />
          </button>
        </header>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div role="alert" style={errorBanner}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 10 }}>
            <Field label="Fecha">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Hora">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Duración (min)">
              <input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Cliente">
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre del cliente"
              style={inputStyle}
            />
          </Field>

          <Field label="Teléfono (opcional)">
            <input
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="+54 9 11 …"
              style={inputStyle}
            />
          </Field>
        </div>

        <footer style={modalFooter}>
          {isEdit && (
            <button
              type="button"
              onClick={() => {
                if (confirm("¿Cancelar esta reserva? El cliente perderá el turno.")) {
                  cancel.mutate();
                }
              }}
              disabled={busy}
              style={dangerBtn}
            >
              {cancel.isPending ? (
                <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
              ) : (
                <Trash2 size={12} />
              )}
              Cancelar reserva
            </button>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} disabled={busy} style={secondaryBtn}>
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => submit(overlap)}
              disabled={busy}
              style={overlap ? dangerSolidBtn : primaryBtn}
            >
              {save.isPending ? (
                <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
              ) : (
                <Check size={12} />
              )}
              {overlap ? "Forzar igual" : isEdit ? "Guardar" : "Reservar"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

// ── Layout de eventos solapados (packing en columnas) ───────────────────────

interface PlacedEvent {
  event: CalendarLiveEvent;
  colIndex: number;
  cols: number;
  startMin: number;
  endMin: number;
}

function layoutDayEvents(events: CalendarLiveEvent[]): PlacedEvent[] {
  const items = events
    .map((event) => {
      const s = new Date(event.start_at as string);
      if (Number.isNaN(s.getTime())) return null;
      let e = event.end_at ? new Date(event.end_at) : new Date(s.getTime() + 30 * 60000);
      if (Number.isNaN(e.getTime())) e = new Date(s.getTime() + 30 * 60000);
      const startMin = Math.max(0, s.getHours() * 60 + s.getMinutes());
      let endMin = e.getHours() * 60 + e.getMinutes();
      // Si termina en otro día (o después) o es <= start, clampeamos a medianoche.
      if (e.getTime() - s.getTime() >= DAY_MINUTES * 60000 || e.getDate() !== s.getDate() || endMin <= startMin) {
        endMin = DAY_MINUTES;
      }
      return { event, startMin, endMin };
    })
    .filter((x): x is { event: CalendarLiveEvent; startMin: number; endMin: number } => x !== null)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const result: PlacedEvent[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;

  const flush = () => {
    const colEnds: number[] = [];
    const placed = cluster.map((it) => {
      let col = colEnds.findIndex((end) => end <= it.startMin);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(it.endMin);
      } else {
        colEnds[col] = it.endMin;
      }
      return { ...it, col };
    });
    const n = colEnds.length;
    for (const p of placed) {
      result.push({ event: p.event, colIndex: p.col, cols: n, startMin: p.startMin, endMin: p.endMin });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const it of items) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  if (cluster.length) flush();
  return result;
}

// ── Helpers de fecha ───────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=dom..6=sab
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function weekDays(anchor: Date): Date[] {
  const start = mondayOf(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function monthCells(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = mondayOf(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function rangeFor(view: ViewMode, anchor: Date): { start: Date; end: Date } {
  if (view === "day") return { start: startOfDay(anchor), end: addDays(startOfDay(anchor), 1) };
  if (view === "week") {
    const start = mondayOf(anchor);
    return { start, end: addDays(start, 7) };
  }
  const cells = monthCells(anchor);
  return { start: cells[0], end: addDays(cells[41], 1) };
}

function titleFor(view: ViewMode, anchor: Date): string {
  if (view === "day") {
    return anchor.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (view === "month") {
    return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  const start = mondayOf(anchor);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString(undefined, {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  const endLabel = end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function hourLabel(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

function clampSnap(minutes: number): number {
  const snapped = Math.round(minutes / SNAP_MIN) * SNAP_MIN;
  return Math.max(0, Math.min(DAY_MINUTES - SNAP_MIN, snapped));
}

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toIso(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0).toISOString();
}

function sortByStart(a: CalendarLiveEvent, b: CalendarLiveEvent): number {
  return (a.start_at ?? "").localeCompare(b.start_at ?? "");
}

function groupByLocalDay(events: CalendarLiveEvent[]): Map<string, CalendarLiveEvent[]> {
  const map = new Map<string, CalendarLiveEvent[]>();
  for (const ev of events) {
    if (!ev.start_at) continue;
    const d = new Date(ev.start_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = localDayKey(d);
    const arr = map.get(key);
    if (arr) arr.push(ev);
    else map.set(key, [ev]);
  }
  return map;
}

// Separa eventos con hora (van a la grilla de tiempo) de los de día completo
// (van a la banda superior). Descarta fechas inválidas. Agrupa por día local.
function splitEvents(events: CalendarLiveEvent[]): {
  timedByDay: Map<string, CalendarLiveEvent[]>;
  allDayByDay: Map<string, CalendarLiveEvent[]>;
  hasAllDay: boolean;
} {
  const timedByDay = new Map<string, CalendarLiveEvent[]>();
  const allDayByDay = new Map<string, CalendarLiveEvent[]>();
  let hasAllDay = false;
  const push = (m: Map<string, CalendarLiveEvent[]>, k: string, ev: CalendarLiveEvent) => {
    const arr = m.get(k);
    if (arr) arr.push(ev);
    else m.set(k, [ev]);
  };
  for (const ev of events) {
    if (!ev.start_at) continue;
    const d = new Date(ev.start_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = localDayKey(d);
    if (ev.is_all_day) {
      hasAllDay = true;
      push(allDayByDay, key, ev);
    } else {
      push(timedByDay, key, ev);
    }
  }
  return { timedByDay, allDayByDay, hasAllDay };
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const hourLinesBg = `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR_HEIGHT - 1}px, var(--hair) ${HOUR_HEIGHT - 1}px, var(--hair) ${HOUR_HEIGHT}px)`;

const toolbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  flexWrap: "wrap",
};

const titleLabel: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text-0)",
  textTransform: "capitalize",
};

const dayHeadCell: React.CSSProperties = {
  padding: "8px 6px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 3,
  border: "none",
  borderRight: "1px solid var(--hair)",
  background: "transparent",
  color: "var(--text-1)",
  width: "100%",
  fontFamily: "inherit",
};

const segActive: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 6,
  border: "none",
  background: "var(--aurora)",
  color: "#0a0a0f",
  fontSize: 11.5,
  fontWeight: 600,
  cursor: "pointer",
};

const segIdle: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 6,
  border: "none",
  background: "transparent",
  color: "var(--text-2)",
  fontSize: 11.5,
  fontWeight: 500,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 6,
  border: "none",
  background: "var(--aurora)",
  color: "#0a0a0f",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid var(--hair-strong)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-1)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};

const navBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 6,
  border: "1px solid var(--hair-strong)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-1)",
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  borderRadius: 6,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.08)",
  color: "var(--z-red)",
  fontSize: 11.5,
  fontWeight: 500,
  cursor: "pointer",
};

const dangerSolidBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "var(--z-amber)",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  background: "rgba(8,8,18,0.6)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalHeader: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid var(--hair)",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const modalFooter: React.CSSProperties = {
  padding: "12px 18px",
  borderTop: "1px solid var(--hair)",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const closeBtn: React.CSSProperties = {
  marginLeft: "auto",
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
};

const inputStyle: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: 6,
  border: "1px solid var(--hair-strong)",
  background: "rgba(0,0,0,0.2)",
  color: "var(--text-0)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
};

const errorBanner: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.08)",
  color: "var(--z-red)",
  fontSize: 12,
  marginBottom: 4,
};
