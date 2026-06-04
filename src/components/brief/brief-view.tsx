"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BookOpenText,
  MessageSquareText,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { getTenantBrief } from "@/lib/api/brief";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";

export function BriefView() {
  return (
    <RequireTenant>{(tenantId) => <Brief tenantId={tenantId} />}</RequireTenant>
  );
}

function Brief({ tenantId }: { tenantId: string }) {
  const query = useQuery({
    queryKey: ["tenant-brief", tenantId],
    queryFn: () => getTenantBrief(tenantId),
    refetchInterval: 15_000,
  });

  const brief = query.data;
  const hasContent = !!brief?.content.trim();

  return (
    <PageShell
      title="Brief del negocio"
      subtitle="Lo que el bot sabe sobre tu negocio. Se edita conversando por WhatsApp con tu número admin."
    >
      <EditViaWaNotice />

      {query.isLoading && (
        <div style={loadingStyle}>Cargando brief…</div>
      )}

      {!query.isLoading && !hasContent && <EmptyState />}

      {!query.isLoading && hasContent && brief && (
        <div
          className="glass"
          style={{
            ...cardStyle,
            border: "1px solid var(--hair)",
          }}
        >
          <div style={metaRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpenText
                size={14}
                style={{ color: "var(--z-cyan)" }}
              />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-0)" }}>
                Brief vigente
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={chipStyle}>v{brief.version}</span>
              <span style={mutedSmall}>
                {brief.content.length} chars
              </span>
              {brief.updated_at && (
                <span style={mutedSmall}>
                  · {formatRelative(brief.updated_at)}
                </span>
              )}
            </div>
          </div>

          <pre style={contentStyle}>{brief.content}</pre>
        </div>
      )}
    </PageShell>
  );
}

function EmptyState() {
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
        gap: 12,
        textAlign: "center",
      }}
    >
      <Sparkles size={20} style={{ color: "var(--z-cyan)" }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>
        Todavía no cargaste el brief
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-2)",
          maxWidth: 460,
          lineHeight: 1.55,
        }}
      >
        El brief es <strong>el contexto que el bot usa para responder bien</strong>:
        descripción del negocio, tono, horarios, FAQs, políticas, qué decir y qué
        no. Hablale al bot por WhatsApp desde tu número admin y decile{" "}
        <em>&quot;configurá mi negocio&quot;</em> — te va a ir preguntando y
        armando el brief con vos.
      </div>
    </div>
  );
}

function EditViaWaNotice() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid oklch(0.80 0.13 200 / 0.25)",
        background: "oklch(0.80 0.13 200 / 0.06)",
        marginBottom: 14,
      }}
    >
      <MessageSquareText
        size={16}
        style={{ color: "var(--z-cyan)", flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.55 }}>
        <strong style={{ color: "var(--text-0)" }}>
          El brief se edita por WhatsApp, no acá.
        </strong>
        <div style={{ marginTop: 3, color: "var(--text-2)" }}>
          Escribile a tu número admin desde tu teléfono y decile{" "}
          <em>&quot;configurá X&quot;</em>, <em>&quot;cambiá los horarios&quot;</em>
          , <em>&quot;agregá esta FAQ&quot;</em>, etc. El bot te pregunta lo que
          falte, te muestra un resumen de los cambios y pide confirmación antes de
          guardar. Después de cada confirmación el cambio aparece acá.
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
            padding: "4px 8px",
            borderRadius: 5,
            border: "1px solid var(--hair)",
            fontSize: 11,
            color: "var(--text-2)",
          }}
        >
          <ShieldCheck size={11} style={{ color: "var(--z-cyan)" }} />
          Solo admins verificados pueden modificarlo
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60_000);
    if (mins < 1) return "recién";
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.round(hours / 24);
    if (days < 30) return `hace ${days} d`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

const metaRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingBottom: 12,
  marginBottom: 14,
  borderBottom: "1px solid var(--hair)",
  flexWrap: "wrap",
  gap: 8,
};

const chipStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "var(--font-jetbrains-mono)",
  fontWeight: 700,
  letterSpacing: "0.08em",
  padding: "3px 8px",
  borderRadius: 4,
  background: "oklch(0.80 0.13 200 / 0.10)",
  color: "var(--z-cyan)",
  border: "1px solid oklch(0.80 0.13 200 / 0.4)",
  textTransform: "uppercase",
};

const mutedSmall: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-3)",
};

const contentStyle: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 12.5,
  color: "var(--text-1)",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  margin: 0,
  padding: 0,
  background: "transparent",
};

const loadingStyle: React.CSSProperties = {
  padding: 24,
  textAlign: "center",
  color: "var(--text-3)",
  fontSize: 13,
};
