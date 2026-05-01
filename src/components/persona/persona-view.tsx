"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Save, ShieldCheck, Plus, Trash2 } from "lucide-react";
import { getTenant } from "@/lib/api/tenants";
import { previewPersona, patchPersona } from "@/lib/api/persona";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import type {
  MessageSource,
  TenantBusinessHoursConfig,
  TenantBusinessHoursWeekday,
  TenantPersonaConfig,
} from "@/lib/api/contract";

const CHANNELS: { id: MessageSource; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "websocket", label: "WebSocket" },
];

const TONES: { value: string; label: string; hint: string }[] = [
  { value: "cercano", label: "Cercano", hint: "Informal, cálido, habla de vos." },
  { value: "profesional", label: "Profesional", hint: "Claro y respetuoso." },
  { value: "formal", label: "Formal", hint: "Trato de usted, estilo corporativo." },
  { value: "divertido", label: "Divertido", hint: "Con buen humor, emojis ocasionales." },
  { value: "directo", label: "Directo", hint: "Frases cortas, al grano." },
];

const LANGUAGES: { value: string; label: string; hint: string }[] = [
  { value: "es", label: "Español", hint: "Siempre responde en español." },
  { value: "en", label: "English", hint: "Always replies in English." },
  {
    value: "auto",
    label: "Bilingüe",
    hint: "Detecta el idioma del cliente y responde en el mismo (ES/EN).",
  },
];

// Mismo orden que TenantBusinessHoursWeekday. "monday" es el índice 0 porque
// es la convención ISO (semana empieza lunes), más natural para el negocio.
const WEEKDAYS: { key: TenantBusinessHoursWeekday; label: string; short: string }[] = [
  { key: "monday", label: "Lunes", short: "Lun" },
  { key: "tuesday", label: "Martes", short: "Mar" },
  { key: "wednesday", label: "Miércoles", short: "Mié" },
  { key: "thursday", label: "Jueves", short: "Jue" },
  { key: "friday", label: "Viernes", short: "Vie" },
  { key: "saturday", label: "Sábado", short: "Sáb" },
  { key: "sunday", label: "Domingo", short: "Dom" },
];

// Límites para evitar que el system prompt crezca sin control (y con él, el
// costo por mensaje + la pérdida de atención del modelo sobre lo importante).
const DESCRIPTION_MAX = 500;
const RULES_MAX_COUNT = 5;
const RULE_MAX_LENGTH = 120;

type WorkingDay = { enabled: boolean; open: string; close: string };

const DEFAULT_DAY: WorkingDay = { enabled: false, open: "09:00", close: "18:00" };

export function PersonaView() {
  return (
    <RequireTenant>{(tenantId) => <PersonaEditor tenantId={tenantId} />}</RequireTenant>
  );
}

function PersonaEditor({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const tenantQuery = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => getTenant(tenantId),
  });

  const [tone, setTone] = useState("cercano");
  const [language, setLanguage] = useState("es");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<string[]>([]);
  const [typingSimulation, setTypingSimulation] = useState(true);
  const [hideAiIdentity, setHideAiIdentity] = useState(false);
  const [hours, setHours] = useState<Record<TenantBusinessHoursWeekday, WorkingDay>>(
    () =>
      Object.fromEntries(WEEKDAYS.map((w) => [w.key, { ...DEFAULT_DAY }])) as Record<
        TenantBusinessHoursWeekday,
        WorkingDay
      >
  );

  const persona = tenantQuery.data?.tenant?.persona;

  useEffect(() => {
    if (!persona) return;
    setTone(persona.tone?.toLowerCase() || "cercano");
    setLanguage(persona.language || "es");
    setDescription((persona.system_prompt_extra ?? "").slice(0, DESCRIPTION_MAX));
    setRules((persona.rules ?? []).slice(0, RULES_MAX_COUNT));
    setTypingSimulation(persona.behavior?.typing_simulation ?? true);
    setHideAiIdentity(persona.behavior?.hide_ai_identity ?? false);

    const storedHours = persona.behavior?.business_hours;
    setHours((prev) => {
      const next = { ...prev };
      for (const { key } of WEEKDAYS) {
        const entry = storedHours?.[key];
        next[key] = entry
          ? { enabled: true, open: entry.open, close: entry.close }
          : { ...DEFAULT_DAY, enabled: false };
      }
      return next;
    });
  }, [persona]);

  const [previewChannel, setPreviewChannel] = useState<MessageSource>("whatsapp");
  const previewQuery = useQuery({
    queryKey: ["persona-preview", tenantId, previewChannel],
    queryFn: () => previewPersona(tenantId, previewChannel),
  });

  const mutation = useMutation({
    mutationFn: (body: Partial<TenantPersonaConfig>) => patchPersona(tenantId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
      qc.invalidateQueries({ queryKey: ["persona-preview", tenantId] });
    },
  });

  const businessHoursForSave: TenantBusinessHoursConfig = useMemo(() => {
    const out: TenantBusinessHoursConfig = {};
    for (const { key } of WEEKDAYS) {
      const d = hours[key];
      if (d.enabled && d.open && d.close && d.open < d.close) {
        out[key] = { open: d.open, close: d.close };
      }
    }
    return out;
  }, [hours]);

  async function onSave() {
    const cleanRules = rules
      .map((r) => r.trim())
      .filter(Boolean)
      .slice(0, RULES_MAX_COUNT)
      .map((r) => r.slice(0, RULE_MAX_LENGTH));

    await mutation.mutateAsync({
      tone,
      language,
      system_prompt_extra: description.trim().slice(0, DESCRIPTION_MAX),
      rules: cleanRules,
      behavior: {
        typing_simulation: typingSimulation,
        hide_ai_identity: hideAiIdentity,
        business_hours: businessHoursForSave,
      },
    });
  }

  function toggleDay(key: TenantBusinessHoursWeekday) {
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  }
  function setDayTime(
    key: TenantBusinessHoursWeekday,
    field: "open" | "close",
    value: string
  ) {
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function addRule() {
    if (rules.length >= RULES_MAX_COUNT) return;
    setRules((prev) => [...prev, ""]);
  }
  function updateRule(idx: number, value: string) {
    setRules((prev) => prev.map((r, i) => (i === idx ? value.slice(0, RULE_MAX_LENGTH) : r)));
  }
  function removeRule(idx: number) {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  }

  const saving = mutation.isPending;

  return (
    <PageShell
      title="Persona del asistente"
      subtitle="Tono, idioma, horario y reglas de tu bot."
      actions={
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !persona}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 5,
            border: "none",
            background: "var(--aurora)",
            color: "#0a0a0f",
            fontSize: 12,
            fontWeight: 600,
            cursor: saving ? "progress" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
          ) : (
            <Save size={13} />
          )}
          Guardar
        </button>
      }
    >
      {mutation.isError && (
        <ErrorBox>
          {mutation.error instanceof ApiError
            ? mutation.error.payload.error
            : "No pudimos guardar los cambios."}
        </ErrorBox>
      )}
      {mutation.isSuccess && (
        <SuccessBox>
          <Check size={13} /> Persona actualizada.
        </SuccessBox>
      )}

      <ProtectedNotice />

      <div className="grid-persona">
        <div
          className="glass"
          style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 16 }}
        >
          {/* ── Tono ─────────────────────────────────────────────────── */}
          <section style={sectionStyle}>
            <SectionTitle>Tono del bot</SectionTitle>
            <SectionHint>Cómo habla con tus clientes.</SectionHint>
            <div style={chipGridStyle}>
              {TONES.map((t) => (
                <ChipOption
                  key={t.value}
                  active={tone === t.value}
                  label={t.label}
                  hint={t.hint}
                  onClick={() => setTone(t.value)}
                />
              ))}
            </div>
          </section>

          {/* ── Idioma ───────────────────────────────────────────────── */}
          <section style={sectionStyle}>
            <SectionTitle>Idioma</SectionTitle>
            <SectionHint>
              En qué idioma responde el bot. El modo bilingüe detecta el idioma del
              cliente en cada mensaje.
            </SectionHint>
            <div style={chipGridStyle}>
              {LANGUAGES.map((l) => (
                <ChipOption
                  key={l.value}
                  active={language === l.value}
                  label={l.label}
                  hint={l.hint}
                  onClick={() => setLanguage(l.value)}
                />
              ))}
            </div>
          </section>

          {/* ── Descripción ──────────────────────────────────────────── */}
          <section style={sectionStyle}>
            <SectionTitle>Descripción del negocio</SectionTitle>
            <SectionHint>
              1–2 frases cortas. Qué vendés, dónde estás. Mantenelo breve: un
              texto largo no mejora las respuestas y aumenta el costo por
              mensaje.
            </SectionHint>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
              rows={3}
              placeholder="Ej: Barbería en Palermo, CABA. Hacemos corte, barba y combo. Turnos de 45 min."
              style={{ ...inputStyle, fontSize: 13 }}
            />
            <div
              style={{
                textAlign: "right",
                fontSize: 10,
                color: "var(--text-3)",
                fontFamily: "var(--font-jetbrains-mono)",
              }}
            >
              {description.length}/{DESCRIPTION_MAX}
            </div>
          </section>

          {/* ── Horarios ─────────────────────────────────────────────── */}
          <section style={sectionStyle}>
            <SectionTitle>Horario de atención</SectionTitle>
            <SectionHint>
              Los días apagados quedan como cerrados. El bot no va a ofrecer
              turnos fuera de estos horarios.
            </SectionHint>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {WEEKDAYS.map((w) => (
                <DayRow
                  key={w.key}
                  label={w.label}
                  shortLabel={w.short}
                  day={hours[w.key]}
                  onToggle={() => toggleDay(w.key)}
                  onOpenChange={(v) => setDayTime(w.key, "open", v)}
                  onCloseChange={(v) => setDayTime(w.key, "close", v)}
                />
              ))}
            </div>
          </section>

          {/* ── Reglas ───────────────────────────────────────────────── */}
          <section style={sectionStyle}>
            <SectionTitle>Reglas</SectionTitle>
            <SectionHint>
              Cosas puntuales que el bot debe evitar o recordar. Máximo{" "}
              {RULES_MAX_COUNT}; mantenelas cortas.
            </SectionHint>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rules.map((r, idx) => (
                <div key={idx} style={{ display: "flex", gap: 6 }}>
                  <input
                    value={r}
                    onChange={(e) => updateRule(idx, e.target.value)}
                    placeholder={idx === 0 ? "Ej: Nunca prometer descuentos sin confirmar" : "Otra regla…"}
                    maxLength={RULE_MAX_LENGTH}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeRule(idx)}
                    aria-label={`Quitar regla ${idx + 1}`}
                    style={iconBtnStyle}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {rules.length < RULES_MAX_COUNT && (
                <button
                  type="button"
                  onClick={addRule}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    alignSelf: "flex-start",
                    padding: "6px 10px",
                    borderRadius: 5,
                    border: "1px dashed var(--hair-strong)",
                    background: "transparent",
                    color: "var(--text-2)",
                    fontSize: 11.5,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={12} />
                  Agregar regla ({rules.length}/{RULES_MAX_COUNT})
                </button>
              )}
            </div>
          </section>

          {/* ── Comportamiento ───────────────────────────────────────── */}
          <section style={sectionStyle}>
            <SectionTitle>Comportamiento</SectionTitle>
            <SectionHint>Detalles finos de cómo se siente la conversación.</SectionHint>
            <Toggle
              label="Simular que está escribiendo"
              description="Muestra 'escribiendo…' antes de responder, parece más humano."
              checked={typingSimulation}
              onChange={setTypingSimulation}
            />
            <Toggle
              label="No mencionar que es un bot"
              description="Si el cliente pregunta '¿sos un bot?', evita confirmarlo."
              checked={hideAiIdentity}
              onChange={setHideAiIdentity}
            />
          </section>
        </div>

        <div
          className="glass"
          style={{
            ...cardStyle,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div className="persona-preview-head">
            <SectionTitle>Preview efectivo</SectionTitle>
            <div className="persona-preview-tabs">
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPreviewChannel(c.id)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "none",
                    background:
                      previewChannel === c.id
                        ? "rgba(255,255,255,0.08)"
                        : "transparent",
                    color:
                      previewChannel === c.id
                        ? "var(--text-0)"
                        : "var(--text-2)",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {previewQuery.data ? (
            <pre className="persona-preview-pre">
              {JSON.stringify(previewQuery.data.effective, null, 2)}
            </pre>
          ) : (
            <div style={{ padding: 16, color: "var(--text-3)", fontSize: 12 }}>
              {previewQuery.isLoading
                ? "Cargando preview…"
                : "Sin preview disponible."}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

function ChipOption({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        padding: "8px 11px",
        borderRadius: 7,
        border: active
          ? "1px solid oklch(0.62 0.22 295 / 0.55)"
          : "1px solid var(--hair)",
        background: active
          ? "oklch(0.62 0.22 295 / 0.10)"
          : "rgba(255,255,255,0.02)",
        color: "var(--text-0)",
        cursor: "pointer",
        textAlign: "left",
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.3 }}>
        {hint}
      </span>
    </button>
  );
}

function DayRow({
  label,
  shortLabel,
  day,
  onToggle,
  onOpenChange,
  onCloseChange,
}: {
  label: string;
  shortLabel: string;
  day: WorkingDay;
  onToggle: () => void;
  onOpenChange: (v: string) => void;
  onCloseChange: (v: string) => void;
}) {
  return (
    <div
      className="persona-day-row"
      style={{
        background: day.enabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
        opacity: day.enabled ? 1 : 0.55,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={day.enabled}
        style={{
          width: 28,
          height: 16,
          borderRadius: 8,
          border: "1px solid var(--hair-strong)",
          background: day.enabled ? "var(--aurora)" : "rgba(255,255,255,0.05)",
          position: "relative",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: day.enabled ? 13 : 1,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "white",
            transition: "left 120ms",
          }}
        />
      </button>

      <div className="persona-day-row-label">
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel}</span>
      </div>

      {day.enabled ? (
        <div className="persona-day-row-times">
          <input
            type="time"
            value={day.open}
            onChange={(e) => onOpenChange(e.target.value)}
            aria-label={`Abre ${label}`}
            style={{ ...inputStyle, padding: "5px 8px" }}
          />
          <span style={{ color: "var(--text-3)", fontSize: 11, flexShrink: 0 }}>a</span>
          <input
            type="time"
            value={day.close}
            onChange={(e) => onCloseChange(e.target.value)}
            aria-label={`Cierra ${label}`}
            style={{ ...inputStyle, padding: "5px 8px" }}
          />
        </div>
      ) : (
        <span
          style={{
            fontSize: 11.5,
            color: "var(--text-3)",
            fontFamily: "var(--font-jetbrains-mono)",
            marginLeft: "auto",
          }}
        >
          cerrado
        </span>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  help,
  children,
}: {
  label: string;
  hint?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--text-3)",
          fontWeight: 600,
        }}
      >
        <span>{label}</span>
        {hint && (
          <span style={{ fontFamily: "var(--font-jetbrains-mono)", textTransform: "none" }}>
            {hint}
          </span>
        )}
      </span>
      {help && (
        <span style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.4 }}>
          {help}
        </span>
      )}
      {children}
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid var(--hair)",
        background: "rgba(255,255,255,0.02)",
        cursor: "pointer",
        fontSize: 13,
        color: "var(--text-0)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span>{label}</span>
        {description && (
          <span style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.4 }}>
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 34,
          height: 20,
          borderRadius: 10,
          border: "1px solid var(--hair-strong)",
          background: checked ? "var(--aurora)" : "rgba(255,255,255,0.05)",
          position: "relative",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: checked ? 15 : 1,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            transition: "left 120ms",
          }}
        />
      </button>
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function SectionHint({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        color: "var(--text-3)",
        lineHeight: 1.4,
        marginTop: -4,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Banner que le explica al cliente qué puede personalizar y qué NO.
 * La lógica del sistema de reservas (prompts de ChatPhase/Executor/Summarize)
 * vive en código hardcoded — nada de lo que el cliente escriba acá puede
 * romper la mecánica del bot.
 */
function ProtectedNotice() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid oklch(0.80 0.13 200 / 0.25)",
        background: "oklch(0.80 0.13 200 / 0.06)",
        marginBottom: 14,
      }}
    >
      <ShieldCheck
        size={16}
        style={{ color: "var(--z-cyan)", flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--text-0)" }}>
          Personalizá cómo habla tu bot, no cómo funciona.
        </strong>
        <div style={{ marginTop: 3, color: "var(--text-2)" }}>
          Acá ajustás tono, idioma, horarios y reglas. La lógica del sistema de
          reservas (calendario, validaciones, flujo de booking) está protegida —
          nosotros nos ocupamos de que siempre funcione.
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};
const chipGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 8,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--hair)",
  background: "rgba(0,0,0,0.2)",
  color: "var(--text-0)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};
const iconBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 6,
  border: "1px solid var(--hair)",
  background: "transparent",
  color: "var(--text-2)",
  cursor: "pointer",
  flexShrink: 0,
};

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid oklch(0.68 0.21 25 / 0.4)",
        background: "oklch(0.68 0.21 25 / 0.08)",
        color: "var(--z-red)",
        fontSize: 12.5,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function SuccessBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 6,
        border: "1px solid oklch(0.78 0.15 155 / 0.4)",
        background: "oklch(0.78 0.15 155 / 0.08)",
        color: "var(--z-green)",
        fontSize: 12,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}
