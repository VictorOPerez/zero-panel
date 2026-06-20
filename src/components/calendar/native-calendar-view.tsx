"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Pencil,
  Plus,
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
import { RequireTenant } from "@/components/panel/require-tenant";
import type { CalendarLiveEvent } from "@/lib/api/contract";

// ── Constantes de layout (grilla de tiempo estilo Google Calendar) ──────────
const HOUR_HEIGHT = 48; // px por hora
const PX_PER_MIN = HOUR_HEIGHT / 60;
const DAY_MINUTES = 24 * 60;
const GUTTER = 52; // ancho de la columna de horas
const SNAP_MIN = 15; // al hacer click, redondea a 15 min
const SWIPE_MS = 280; // duración del deslizamiento entre paneles

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
  const [detail, setDetail] = useState<CalendarLiveEvent | null>(null);
  const reduced = usePrefersReducedMotion();

  // Reloj para mover la línea de "ahora" y recalcular el día actual.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Rango visible AMPLIADO: cubre el panel anterior + actual + siguiente para
  // que el carrusel de swipe tenga datos en los 3 paneles sin un fetch por cada
  // gesto. Al navegar, la query se re-dispara para la nueva ventana.
  const range = useMemo(() => {
    const prev = rangeFor(view, stepAnchor(view, anchor, -1));
    const next = rangeFor(view, stepAnchor(view, anchor, 1));
    return { start: prev.start, end: next.end };
  }, [view, anchor]);
  const from = range.start.toISOString();
  const to = range.end.toISOString();

  const eventsQuery = useQuery({
    queryKey: ["calendar-events", tenantId, from, to],
    // includePast: la vista navega a semanas/meses arbitrarios → necesita el
    // histórico exacto del rango, no sólo lo futuro.
    queryFn: () => listUpcomingCalendarEvents(tenantId, { from, to, includePast: true }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    // Mantener los eventos previos mientras refetchea la nueva ventana evita que
    // los paneles parpadeen en vacío al deslizar.
    placeholderData: keepPreviousData,
  });

  const events = useMemo(() => eventsQuery.data?.events ?? [], [eventsQuery.data]);

  const goToday = () => setAnchor(startOfDay(new Date()));
  const step = useCallback(
    (dir: 1 | -1) => setAnchor((a) => stepAnchor(view, a, dir)),
    [view]
  );
  // Navegar a la vista Día de una fecha (click en un día del Mes o en el
  // encabezado de un día de la Semana). NO abre el modal de crear.
  const goToDay = (date: Date) => {
    setAnchor(startOfDay(date));
    setView("day");
  };

  const openCreate = (date: string, time?: string, duration?: number) =>
    setEditor({ mode: "create", date, time, duration });

  // Render de UN panel del carrusel para un offset (-1 anterior, 0 actual, +1
  // siguiente). Comparte la misma lista de eventos (la ventana ya los cubre).
  const renderPanel = (offset: -1 | 0 | 1) => {
    const panelAnchor = stepAnchor(view, anchor, offset);
    if (view === "month") {
      return (
        <MonthGrid
          anchor={panelAnchor}
          now={now}
          events={events}
          onDayClick={goToDay}
          onEventClick={setDetail}
        />
      );
    }
    return (
      <TimeGrid
        days={view === "week" ? weekDays(panelAnchor) : [panelAnchor]}
        now={now}
        events={events}
        loading={eventsQuery.isLoading}
        singleDay={view === "day"}
        onSlotClick={(key, time) => openCreate(key, time)}
        onEventClick={setDetail}
        onDayHeaderClick={goToDay}
      />
    );
  };

  return (
    <div className="page-shell" style={{ paddingTop: 14, position: "relative" }}>
      {/* Header compacto: una sola fila, iconos, sin título grande. */}
      <div style={bar}>
        <div style={titleLabel} title={titleFor(view, anchor)}>
          {titleFor(view, anchor)}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
          <button type="button" onClick={goToday} style={pillBtn} title="Hoy">
            Hoy
          </button>
          <button type="button" aria-label="Anterior" onClick={() => step(-1)} style={iconBtn}>
            <ChevronLeft size={17} />
          </button>
          <button type="button" aria-label="Siguiente" onClick={() => step(1)} style={iconBtn}>
            <ChevronRight size={17} />
          </button>
          <button
            type="button"
            aria-label="Refrescar"
            onClick={() => eventsQuery.refetch()}
            disabled={eventsQuery.isFetching}
            style={iconBtn}
            title="Refrescar"
          >
            {eventsQuery.isFetching ? (
              <Loader2 size={15} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <RefreshCw size={14} />
            )}
          </button>
        </div>

        <div className="filter-tabs" style={{ width: "100%", marginTop: 2 }}>
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

      {/* Carrusel con swipe: el offset visible cambia de panel al deslizar. */}
      <SwipeDeck
        viewKey={view}
        reduced={reduced}
        onNavigate={(dir) => step(dir)}
        renderPanel={renderPanel}
      />

      {/* FAB de crear (abajo-derecha) */}
      <button
        type="button"
        aria-label="Crear reserva"
        onClick={() => openCreate(localDayKey(anchor))}
        style={fab}
        title="Crear reserva"
      >
        <Plus size={24} strokeWidth={2.4} />
      </button>

      {detail && (
        <EventSheet
          tenantId={tenantId}
          event={detail}
          reduced={reduced}
          onClose={() => setDetail(null)}
          onEdit={(ev) => {
            setDetail(null);
            setEditor({ mode: "edit", event: ev });
          }}
        />
      )}

      {editor && (
        <AppointmentModal tenantId={tenantId} editor={editor} onClose={() => setEditor(null)} />
      )}
    </div>
  );
}

// ── Carrusel de 3 paneles con swipe (pointer events, sin dependencias) ───────
// Muestra [anterior][actual][siguiente] y desliza al arrastrar horizontal.
// Distingue gesto horizontal vs vertical por el ángulo dominante para no robar
// el scroll vertical de la grilla de horas. Snap-back si no supera el umbral
// (~25% del ancho) o un flick rápido. prefers-reduced-motion → cambio directo.
function SwipeDeck({
  viewKey,
  reduced,
  onNavigate,
  renderPanel,
}: {
  viewKey: string;
  reduced: boolean;
  onNavigate: (dir: 1 | -1) => void;
  renderPanel: (offset: -1 | 0 | 1) => React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(1);
  const gesture = useRef<{
    x: number;
    y: number;
    t: number;
    locked: null | "h" | "v";
  } | null>(null);
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [epoch, setEpoch] = useState(0); // remount → reset limpio a la base

  // Cambiar de vista resetea el deck (alturas/columnas distintas).
  useEffect(() => {
    setDragPx(0);
    setDragging(false);
    setEpoch((e) => e + 1);
  }, [viewKey]);

  const settle = useCallback(
    (dir: 0 | 1 | -1) => {
      const W = widthRef.current || 1;
      if (dir === 0) {
        setDragging(false);
        setDragPx(0);
        return;
      }
      setDragging(false);
      setDragPx(dir > 0 ? -W : W); // anima el panel fuera de pantalla
      window.setTimeout(
        () => {
          onNavigate(dir);
          setEpoch((e) => e + 1); // monta de nuevo en la base (-100%)
          setDragPx(0);
        },
        reduced ? 0 : SWIPE_MS
      );
    },
    [onNavigate, reduced]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    widthRef.current = containerRef.current?.clientWidth ?? 1;
    gesture.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, locked: null };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.locked === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // todavía un tap
      g.locked = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (g.locked === "h") {
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
    }
    if (g.locked === "h") setDragPx(dx);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.locked !== "h") {
      setDragging(false);
      return;
    }
    const dx = e.clientX - g.x;
    const W = widthRef.current || 1;
    const dt = Math.max(1, e.timeStamp - g.t);
    const vx = dx / dt; // px por ms
    const threshold = Math.min(W * 0.25, 120);
    const flick = Math.abs(vx) > 0.5 && Math.abs(dx) > 30;
    if (dx <= -threshold || (flick && dx < 0)) settle(1);
    else if (dx >= threshold || (flick && dx > 0)) settle(-1);
    else settle(0);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        overflow: "hidden",
        touchAction: "pan-y",
        position: "relative",
        // Arrastrar para deslizar/scrollear no debe seleccionar el texto de la
        // grilla (el header no lo sufre porque son <button>). Los inputs del
        // modal/sheet viven fuera del deck → no se ven afectados.
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <div
        key={epoch}
        style={{
          display: "flex",
          transform: `translateX(calc(-100% + ${dragPx}px))`,
          transition:
            dragging || reduced
              ? "none"
              : `transform ${SWIPE_MS}ms cubic-bezier(.22,.61,.36,1)`,
          willChange: "transform",
        }}
      >
        <div style={panelCell}>{renderPanel(-1)}</div>
        <div style={panelCell}>{renderPanel(0)}</div>
        <div style={panelCell}>{renderPanel(1)}</div>
      </div>
    </div>
  );
}

const panelCell: React.CSSProperties = { flex: "0 0 100%", minWidth: 0 };

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

  const { timedByDay, allDayByDay, hasAllDay } = useMemo(
    () => splitEvents(events),
    [events]
  );

  // Al montar (o cambiar día↔semana), desplazar a ~7:00.
  useEffect(() => {
    if (scrollRef.current && bodyRef.current) {
      scrollRef.current.scrollTop = bodyRef.current.offsetTop + 7 * HOUR_HEIGHT - 12;
    }
  }, [days.length, hasAllDay]);

  const cols = `${GUTTER}px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="glass" style={{ borderRadius: 14, overflow: "hidden" }}>
      <div
        ref={scrollRef}
        style={{
          maxHeight: "calc(100dvh - 220px)",
          minHeight: 440,
          overflowY: "auto",
          position: "relative",
        }}
      >
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
                      fontSize: 11,
                      color: isToday ? "var(--z-cyan)" : "var(--text-3)",
                      fontWeight: 600,
                    }}
                  >
                    {weekdayShort(d)}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 30,
                      height: 30,
                      borderRadius: 999,
                      fontSize: 15,
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono)",
                      color: isToday ? "#06121a" : "var(--text-1)",
                      background: isToday ? "var(--aurora)" : "transparent",
                    }}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

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
                todo el día
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
                      <ChipPill key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cuerpo: gutter de horas + columnas por día */}
        <div ref={bodyRef} style={{ display: "grid", gridTemplateColumns: cols, position: "relative" }}>
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

// Píldora sólida totalmente redondeada (banda "todo el día" + reutilizable).
function ChipPill({ event, onClick }: { event: CalendarLiveEvent; onClick: () => void }) {
  const c = pillColors(event.source === "bot");
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
        background: c.bg,
        color: c.fg,
        borderRadius: 999,
        padding: "2px 9px",
        fontSize: 10.5,
        fontWeight: 600,
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
  const c = pillColors(isBot);
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
        padding: compact ? "1px 9px" : "3px 10px",
        borderRadius: compact ? 999 : 10,
        border: "none",
        background: c.bg,
        color: c.fg,
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
          fontWeight: 700,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          flexShrink: 0,
        }}
      >
        {isBot && <Sparkles size={9} />}
        {event.summary || "(sin título)"}
      </span>
      {start && !compact && (
        <span style={{ fontSize: 10, opacity: 0.85, fontFamily: "var(--font-jetbrains-mono)" }}>
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
    <div className="glass" style={{ borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--hair)" }}>
        {weekdays.map((d) => (
          <div
            key={d.toISOString()}
            style={{
              padding: "8px 10px",
              textAlign: "center",
              fontSize: 11,
              color: "var(--text-3)",
              fontWeight: 600,
            }}
          >
            {weekdayShort(d)}
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
                minHeight: 124,
                padding: 6,
                borderRight: (i + 1) % 7 === 0 ? undefined : "1px solid var(--hair)",
                borderBottom: i < 35 ? "1px solid var(--hair)" : undefined,
                background: dim ? "rgba(0,0,0,0.18)" : isToday ? "oklch(0.80 0.13 200 / 0.05)" : undefined,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span
                style={{
                  alignSelf: "flex-start",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 26,
                  height: 26,
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: isToday ? "#06121a" : dim ? "var(--text-3)" : "var(--text-0)",
                  background: isToday ? "var(--aurora)" : "transparent",
                  pointerEvents: "none",
                }}
              >
                {d.getDate()}
              </span>
              {dayEvents.slice(0, 3).map((ev) => {
                const c = pillColors(ev.source === "bot");
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    title={ev.summary || "(sin título)"}
                    style={{
                      textAlign: "left",
                      border: "none",
                      background: c.bg,
                      color: c.fg,
                      borderRadius: 999,
                      padding: "2px 8px",
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ev.start_at ? `${fmtTime(new Date(ev.start_at))} · ` : ""}
                    {ev.summary || "(sin título)"}
                  </button>
                );
              })}
              {dayEvents.length > 3 && (
                <span style={{ fontSize: 10, color: "var(--text-3)", paddingLeft: 6, fontWeight: 600 }}>
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

// ── Bottom-sheet de detalle (al tocar un evento) ────────────────────────────

function EventSheet({
  tenantId,
  event,
  reduced,
  onClose,
  onEdit,
}: {
  tenantId: string;
  event: CalendarLiveEvent;
  reduced: boolean;
  onClose: () => void;
  onEdit: (ev: CalendarLiveEvent) => void;
}) {
  const qc = useQueryClient();
  const [shown, setShown] = useState(reduced);
  // Sube desde abajo al montar (un frame después para animar).
  useEffect(() => {
    if (reduced) return;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const close = () => {
    if (reduced) return onClose();
    setShown(false);
    window.setTimeout(onClose, 200);
  };

  const cancel = useMutation({
    mutationFn: () => cancelAppointment(tenantId, event.google_event_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      close();
    },
  });

  const isBot = event.source === "bot";
  const c = pillColors(isBot);
  const start = event.start_at ? new Date(event.start_at) : null;
  const end = event.end_at ? new Date(event.end_at) : null;

  return (
    <div role="dialog" aria-modal="true" onClick={close} style={sheetOverlay(shown)}>
      <div
        className="glass-strong"
        onClick={(e) => e.stopPropagation()}
        style={{
          ...sheetPanel,
          transform: shown ? "translateY(0)" : "translateY(100%)",
          transition: reduced ? "none" : "transform 220ms cubic-bezier(.22,.61,.36,1)",
        }}
      >
        <div style={sheetGrip} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
          <span style={{ width: 12, height: 12, borderRadius: 999, background: c.bg, marginTop: 5, flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-0)", overflowWrap: "anywhere" }}>
              {event.summary || "(sin título)"}
            </div>
            <span
              style={{
                display: "inline-block",
                marginTop: 6,
                fontSize: 10.5,
                fontWeight: 600,
                padding: "2px 9px",
                borderRadius: 999,
                background: c.bg,
                color: c.fg,
              }}
            >
              {isBot ? "Reserva del bot" : "Agendada a mano"}
            </span>
          </div>
          <button type="button" onClick={close} aria-label="Cerrar" style={closeBtn}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {start && (
            <div style={sheetRow}>
              <Clock size={15} style={{ color: "var(--z-cyan)" }} />
              <span>
                {start.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                {" · "}
                {fmtTime(start)}
                {end ? ` – ${fmtTime(end)}` : ""}
              </span>
            </div>
          )}
          {event.location && (
            <div style={sheetRow}>
              <MapPin size={15} style={{ color: "var(--z-cyan)", flexShrink: 0 }} />
              <span style={{ overflowWrap: "anywhere" }}>{event.location}</span>
            </div>
          )}
          {event.description && (
            <div style={{ fontSize: 13, color: "var(--text-2)", overflowWrap: "anywhere", paddingLeft: 24 }}>
              {event.description}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              if (confirm("¿Cancelar esta reserva? El cliente perderá el turno.")) cancel.mutate();
            }}
            disabled={cancel.isPending}
            style={{ ...dangerBtn, flex: 1, justifyContent: "center", padding: "10px 12px" }}
          >
            {cancel.isPending ? (
              <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <Trash2 size={13} />
            )}
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onEdit(event)}
            style={{ ...primaryBtn, flex: 1, justifyContent: "center", padding: "10px 12px" }}
          >
            <Pencil size={13} />
            Editar
          </button>
        </div>
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
        style={{ width: 440, maxWidth: "100%", borderRadius: 14, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={modalHeader}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
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

// ── Hooks ────────────────────────────────────────────────────────────────────

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
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

// Domingo de la semana de `d` (semana empieza en DOMINGO, como Google).
function sundayOf(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay()); // getDay 0=dom..6=sab
  return x;
}

function weekDays(anchor: Date): Date[] {
  const start = sundayOf(anchor);
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
  const start = sundayOf(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// Avance de ancla por vista (compartido por la navegación y el carrusel).
function stepAnchor(view: ViewMode, a: Date, dir: number): Date {
  if (view === "month") return addMonths(a, dir);
  return addDays(a, dir * (view === "week" ? 7 : 1));
}

function rangeFor(view: ViewMode, anchor: Date): { start: Date; end: Date } {
  if (view === "day") return { start: startOfDay(anchor), end: addDays(startOfDay(anchor), 1) };
  if (view === "week") {
    const start = sundayOf(anchor);
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
    });
  }
  if (view === "month") {
    return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  const start = sundayOf(anchor);
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

// Día de semana corto en minúscula y sin punto (dom, lun, mar…), como Google.
function weekdayShort(d: Date): string {
  return d
    .toLocaleDateString(undefined, { weekday: "short" })
    .replace(/\./g, "")
    .toLowerCase();
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

// Separa eventos con hora (van a la grilla) de los de día completo (banda).
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

// ── Colores de píldora por tipo (sólido, paleta NavApex) ─────────────────────
function pillColors(isBot: boolean): { bg: string; fg: string } {
  return isBot
    ? { bg: "oklch(0.62 0.22 295)", fg: "#f5f1ff" } // turnos del bot — violeta
    : { bg: "oklch(0.80 0.13 200)", fg: "#06121a" }; // manuales — cyan
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const hourLinesBg = `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR_HEIGHT - 1}px, var(--hair) ${HOUR_HEIGHT - 1}px, var(--hair) ${HOUR_HEIGHT}px)`;

const bar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
  flexWrap: "wrap",
};

const titleLabel: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "var(--text-0)",
  textTransform: "capitalize",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
};

const dayHeadCell: React.CSSProperties = {
  padding: "7px 6px",
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
  padding: "6px 14px",
  borderRadius: 999,
  border: "none",
  background: "var(--aurora)",
  color: "#06121a",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const segIdle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 999,
  border: "none",
  background: "transparent",
  color: "var(--text-2)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "var(--aurora)",
  color: "#06121a",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--hair-strong)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-1)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};

const pillBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid var(--hair-strong)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-1)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const iconBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "1px solid var(--hair-strong)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-1)",
  cursor: "pointer",
  flexShrink: 0,
};

const fab: React.CSSProperties = {
  position: "fixed",
  right: "max(20px, env(safe-area-inset-right))",
  bottom: "max(20px, env(safe-area-inset-bottom))",
  width: 56,
  height: 56,
  borderRadius: 999,
  border: "none",
  background: "var(--aurora)",
  color: "#06121a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  zIndex: 30,
  boxShadow: "0 10px 28px oklch(0.62 0.22 295 / 0.45), 0 2px 8px rgba(0,0,0,0.4)",
};

const dangerBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.08)",
  color: "var(--z-red)",
  fontSize: 11.5,
  fontWeight: 600,
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

const sheetOverlay = (shown: boolean): React.CSSProperties => ({
  position: "fixed",
  inset: 0,
  zIndex: 50,
  background: shown ? "rgba(8,8,18,0.6)" : "rgba(8,8,18,0)",
  backdropFilter: shown ? "blur(6px)" : "blur(0px)",
  transition: "background 220ms ease, backdrop-filter 220ms ease",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
});

const sheetPanel: React.CSSProperties = {
  width: 480,
  maxWidth: "100%",
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  padding: "10px 20px calc(22px + env(safe-area-inset-bottom))",
  willChange: "transform",
};

const sheetGrip: React.CSSProperties = {
  width: 40,
  height: 4,
  borderRadius: 999,
  background: "var(--hair-strong)",
  margin: "0 auto 14px",
};

const sheetRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  fontSize: 13,
  color: "var(--text-1)",
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
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "none",
  background: "rgba(255,255,255,0.05)",
  color: "var(--text-2)",
  cursor: "pointer",
  flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: 8,
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
  borderRadius: 8,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.08)",
  color: "var(--z-red)",
  fontSize: 12,
  marginBottom: 10,
};
