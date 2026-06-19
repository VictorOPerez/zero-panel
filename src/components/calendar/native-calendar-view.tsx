"use client";

import { useMemo, useState } from "react";
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
  User,
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

export function NativeCalendarView() {
  return <RequireTenant>{(tenantId) => <Calendar tenantId={tenantId} />}</RequireTenant>;
}

function Calendar({ tenantId }: { tenantId: string }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  // Modal de crear/editar. event=null → crear; event=evento → editar.
  const [editor, setEditor] = useState<
    { mode: "create"; date: string } | { mode: "edit"; event: CalendarLiveEvent } | null
  >(null);

  const weekEnd = addDays(weekStart, 7);
  const { from, to } = { from: weekStart.toISOString(), to: weekEnd.toISOString() };

  const eventsQuery = useQuery({
    queryKey: ["calendar-events", tenantId, from, to],
    queryFn: () => listUpcomingCalendarEvents(tenantId, { from, to }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const events = useMemo(() => eventsQuery.data?.events ?? [], [eventsQuery.data]);
  const byDay = useMemo(() => groupByLocalDay(events), [events]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const todayKey = localDayKey(new Date());

  return (
    <PageShell
      title="Calendario"
      subtitle="Los turnos que toma el bot y los que agregás a mano. Reservás sin conectar Google."
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => eventsQuery.refetch()}
            disabled={eventsQuery.isFetching}
            style={secondaryBtn}
          >
            {eventsQuery.isFetching ? (
              <Loader2 size={12} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <RefreshCw size={12} />
            )}
            Refrescar
          </button>
          <button
            type="button"
            onClick={() => setEditor({ mode: "create", date: localDayKey(new Date()) })}
            style={primaryBtn}
          >
            <CalendarPlus size={13} />
            Nueva reserva
          </button>
        </div>
      }
    >
      {/* Navegación de semana */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <button
          type="button"
          aria-label="Semana anterior"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          style={navBtn}
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          onClick={() => setWeekStart(mondayOf(new Date()))}
          style={{ ...secondaryBtn, padding: "7px 12px" }}
        >
          Hoy
        </button>
        <button
          type="button"
          aria-label="Semana siguiente"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          style={navBtn}
        >
          <ChevronRight size={15} />
        </button>
        <div style={{ marginLeft: 6, fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>
          {weekRangeLabel(weekStart)}
        </div>
      </div>

      {eventsQuery.isError && (
        <div role="alert" style={errorBanner}>
          No pudimos cargar las reservas. Probá refrescar.
        </div>
      )}

      {/* Grilla semanal: 7 columnas con scroll horizontal en pantallas chicas */}
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(150px, 1fr))",
            gap: 8,
            minWidth: 760,
          }}
        >
          {days.map((day) => {
            const key = localDayKey(day);
            const dayEvents = (byDay.get(key) ?? []).sort(sortByStart);
            const isToday = key === todayKey;
            return (
              <DayColumn
                key={key}
                day={day}
                isToday={isToday}
                events={dayEvents}
                onAdd={() => setEditor({ mode: "create", date: key })}
                onPick={(ev) => setEditor({ mode: "edit", event: ev })}
                loading={eventsQuery.isLoading}
              />
            );
          })}
        </div>
      </div>

      {editor && (
        <AppointmentModal
          tenantId={tenantId}
          editor={editor}
          onClose={() => setEditor(null)}
        />
      )}
    </PageShell>
  );
}

function DayColumn({
  day,
  isToday,
  events,
  onAdd,
  onPick,
  loading,
}: {
  day: Date;
  isToday: boolean;
  events: CalendarLiveEvent[];
  onAdd: () => void;
  onPick: (ev: CalendarLiveEvent) => void;
  loading: boolean;
}) {
  return (
    <div
      className="glass"
      style={{
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        minHeight: 220,
        borderColor: isToday ? "oklch(0.62 0.22 295 / 0.45)" : undefined,
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid var(--hair)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: isToday ? "var(--z-cyan)" : "var(--text-3)",
              fontWeight: 600,
            }}
          >
            {day.toLocaleDateString(undefined, { weekday: "short" })}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: isToday ? "var(--text-0)" : "var(--text-1)",
              fontFamily: "var(--font-jetbrains-mono)",
            }}
          >
            {day.getDate()}
          </div>
        </div>
        <button
          type="button"
          aria-label="Agregar reserva"
          onClick={onAdd}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 5,
            border: "1px solid var(--hair-strong)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--text-2)",
            cursor: "pointer",
          }}
        >
          <CalendarPlus size={12} />
        </button>
      </div>

      <div
        style={{
          padding: 6,
          display: "flex",
          flexDirection: "column",
          gap: 5,
          flex: 1,
        }}
      >
        {loading ? (
          <div style={{ padding: 10, textAlign: "center", color: "var(--text-3)" }}>
            <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
          </div>
        ) : events.length === 0 ? (
          <button
            type="button"
            onClick={onAdd}
            style={{
              flex: 1,
              minHeight: 56,
              border: "1px dashed var(--hair)",
              borderRadius: 7,
              background: "transparent",
              color: "var(--text-3)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            + Reservar
          </button>
        ) : (
          events.map((ev) => <EventChip key={ev.id} event={ev} onClick={() => onPick(ev)} />)
        )}
      </div>
    </div>
  );
}

function EventChip({ event, onClick }: { event: CalendarLiveEvent; onClick: () => void }) {
  const start = event.start_at ? new Date(event.start_at) : null;
  const time = start
    ? start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "—";
  const isBot = event.source === "bot";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "7px 8px",
        borderRadius: 7,
        border: `1px solid ${isBot ? "oklch(0.62 0.22 295 / 0.3)" : "var(--hair-strong)"}`,
        background: isBot ? "oklch(0.62 0.22 295 / 0.1)" : "rgba(255,255,255,0.03)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          fontFamily: "var(--font-jetbrains-mono)",
          color: isBot ? "var(--z-cyan)" : "var(--text-2)",
          fontWeight: 600,
        }}
      >
        {isBot ? <Sparkles size={9} /> : <User size={9} />}
        {time}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-0)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {event.summary || "(sin título)"}
      </div>
    </button>
  );
}

// ── Modal crear / editar ──────────────────────────────────────────────────

function AppointmentModal({
  tenantId,
  editor,
  onClose,
}: {
  tenantId: string;
  editor: { mode: "create"; date: string } | { mode: "edit"; event: CalendarLiveEvent };
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
      time: "09:00",
      duration: 30,
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
    mutationFn: () =>
      cancelAppointment(tenantId, existing!.google_event_id),
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
          <CalendarPlus size={16} style={{ color: "var(--text-2)" }} />
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
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={inputStyle}
              />
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

// ── Helpers de fecha ───────────────────────────────────────────────────────

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=dom..6=sab
  const diff = day === 0 ? -6 : 1 - day; // lunes como inicio
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
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

function toIso(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0).toISOString();
}

function weekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const startLabel = weekStart.toLocaleDateString(undefined, {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  const endLabel = end.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function sortByStart(a: CalendarLiveEvent, b: CalendarLiveEvent): number {
  return (a.start_at ?? "").localeCompare(b.start_at ?? "");
}

function groupByLocalDay(events: CalendarLiveEvent[]): Map<string, CalendarLiveEvent[]> {
  const map = new Map<string, CalendarLiveEvent[]>();
  for (const ev of events) {
    if (!ev.start_at) continue;
    const key = localDayKey(new Date(ev.start_at));
    const arr = map.get(key);
    if (arr) arr.push(ev);
    else map.set(key, [ev]);
  }
  return map;
}

// ── Estilos ────────────────────────────────────────────────────────────────

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
};
