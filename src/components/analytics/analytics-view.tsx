"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconDot } from "@/components/icons";
import { getAnalytics, type AnalyticsPeriod } from "@/lib/api/analytics";
import { useAuthStore } from "@/store/auth";

const PERIODS = ["24h", "7d", "30d", "90d"] as const satisfies readonly AnalyticsPeriod[];
type Period = (typeof PERIODS)[number];

const PERIOD_LABEL: Record<Period, string> = {
  "24h": "Últimas 24 horas",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
};

const SERIES_LABEL: Record<Period, string> = {
  "24h": "Por hora",
  "7d": "Por día",
  "30d": "Por día",
  "90d": "Por semana",
};

export function AnalyticsView() {
  const [period, setPeriod] = useState<Period>("7d");
  const tenantId = useAuthStore((s) => s.activeTenantId);

  const query = useQuery({
    queryKey: ["analytics", tenantId, period],
    queryFn: () => getAnalytics(tenantId!, period),
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  const kpis = query.data?.kpis ?? [];
  const series = query.data?.series ?? [];
  const byChannel = query.data?.byChannel ?? [];
  const breakdown = query.data?.breakdown;

  const hasActivity = series.some((v) => v > 0) || kpis.some((k) => Number(k.value) > 0);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 28px 40px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>Analytics</h1>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
            {PERIOD_LABEL[period]}
          </div>
        </div>
        <div
          role="group"
          aria-label="Período de tiempo"
          style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
        >
          {PERIODS.map((r) => (
            <button
              key={r}
              onClick={() => setPeriod(r)}
              aria-pressed={period === r}
              style={{
                padding: "5px 12px",
                borderRadius: 5,
                fontSize: 11,
                fontFamily: "var(--font-jetbrains-mono)",
                fontWeight: 500,
                background: period === r ? "var(--aurora)" : "rgba(255,255,255,0.03)",
                color: period === r ? "#0a0a0f" : "var(--text-2)",
                border: period === r ? "none" : "1px solid var(--hair)",
                cursor: "pointer",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
          Cargando métricas…
        </div>
      ) : query.isError ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
          No pudimos cargar las métricas.{" "}
          <button
            onClick={() => query.refetch()}
            style={{
              border: "none",
              background: "none",
              color: "var(--z-cyan)",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: 12,
            }}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div
            className="grid-kpis"
            style={{ marginTop: 18 }}
            role="list"
            aria-label="Indicadores clave"
          >
            {kpis.map((k) => (
              <KpiCard key={k.label} kpi={k} series={series} />
            ))}
          </div>

          {/* Charts */}
          <div className="grid-chart-2" style={{ marginTop: 14 }}>
            <div className="glass" style={{ padding: 16, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Volumen de mensajes</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                    {SERIES_LABEL[period]}
                  </div>
                </div>
              </div>
              {hasActivity ? (
                <AreaChart data={series} period={period} />
              ) : (
                <ChartEmpty />
              )}
            </div>

            <div className="glass" style={{ padding: 16, borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Distribución por canal</div>
              {byChannel.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-3)", padding: "20px 0" }}>
                  Sin conversaciones en este período.
                </div>
              ) : (
                byChannel.map((c) => (
                  <div key={c.label} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: "var(--text-1)" }}>{c.label}</span>
                      <span style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-2)" }}>
                        {c.value} · {c.pct}%
                      </span>
                    </div>
                    <div
                      style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)" }}
                      role="progressbar"
                      aria-valuenow={c.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={c.label}
                    >
                      <div
                        style={{ width: `${c.pct}%`, height: "100%", borderRadius: 2, background: "var(--aurora)" }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Mensajes por origen — dato real del backend */}
          {breakdown && (
            <div className="glass" style={{ padding: 16, borderRadius: 10, marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Mensajes por origen</div>
              <OriginBars breakdown={breakdown} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ChartEmpty() {
  return (
    <div
      style={{
        height: 160,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-3)",
        fontSize: 12,
      }}
    >
      Sin actividad en este período todavía.
    </div>
  );
}

function OriginBars({
  breakdown,
}: {
  breakdown: { messages_by_user: number; messages_by_ai: number; messages_by_human: number };
}) {
  const rows = [
    { label: "Clientes", value: breakdown.messages_by_user, color: "var(--text-1)" },
    { label: "Zero (IA)", value: breakdown.messages_by_ai, color: "var(--z-cyan)" },
    { label: "Humano (vos)", value: breakdown.messages_by_human, color: "var(--z-amber)" },
  ];
  const total = rows.reduce((acc, r) => acc + r.value, 0);
  if (total === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-3)", padding: "12px 0" }}>
        Sin mensajes en este período.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r) => {
        const pct = Math.round((r.value / total) * 100);
        return (
          <div key={r.label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-1)" }}>
                <IconDot color={r.color} size={6} />
                {r.label}
              </span>
              <span style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-2)" }}>
                {r.value} · {pct}%
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: r.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface KpiLike {
  label: string;
  value: string | number;
  delta: string;
  trend: string;
}

function KpiCard({ kpi, series }: { kpi: KpiLike; series: number[] }) {
  return (
    <div role="listitem" className="glass" style={{ padding: 14, borderRadius: 10 }}>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--text-3)",
          fontWeight: 600,
        }}
      >
        {kpi.label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
        <span
          style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 26, fontWeight: 700, color: "var(--text-0)" }}
        >
          {kpi.value}
        </span>
        {kpi.delta !== "—" && (
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-jetbrains-mono)",
              color: kpi.trend === "up" ? "var(--z-green)" : kpi.trend === "down" ? "var(--z-red)" : "var(--text-3)",
            }}
          >
            {kpi.delta}
          </span>
        )}
      </div>
      <Sparkline data={series} />
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 200;
  const h = 28;
  const max = Math.max(...data, 0);
  if (data.length < 2 || max === 0) {
    return <div style={{ height: 28, marginTop: 8 }} aria-hidden />;
  }
  const path = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: 28, marginTop: 8 }}
      aria-hidden
    >
      <defs>
        <linearGradient id="spk" x1="0" x2="1" y1="0" y2="0">
          <stop stopColor="oklch(0.62 0.22 295)" />
          <stop offset="1" stopColor="oklch(0.80 0.13 200)" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke="url(#spk)" strokeWidth="1.5" />
    </svg>
  );
}

function AreaChart({ data, period }: { data: number[]; period: Period }) {
  const w = 600;
  const h = 140;
  const max = Math.max(...data, 0);
  const safeMax = max === 0 ? 1 : max;
  const path = data
    .map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * w;
      const y = h - (v / safeMax) * (h - 10);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Etiquetas del eje X según el período (antes siempre decía 00:00–24:00,
  // incorrecto para 7d/30d/90d).
  const axisLabels = buildAxisLabels(period, data.length);

  return (
    <svg
      viewBox={`0 0 ${w} ${h + 22}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: 160 }}
      role="img"
      aria-label="Gráfico de volumen de mensajes"
    >
      <defs>
        <linearGradient id="ar-fill" x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="oklch(0.62 0.22 295 / 0.4)" />
          <stop offset="1" stopColor="oklch(0.62 0.22 295 / 0)" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1="0"
          x2={w}
          y1={((h - 10) * i) / 3 + 5}
          y2={((h - 10) * i) / 3 + 5}
          stroke="rgba(255,255,255,0.04)"
        />
      ))}
      <path d={`${path} L ${w},${h} L 0,${h} Z`} fill="url(#ar-fill)" />
      <path d={path} fill="none" stroke="oklch(0.80 0.13 200)" strokeWidth="1.5" />
      {axisLabels.map((label, i) => (
        <text
          key={`${label}-${i}`}
          x={(i / Math.max(1, axisLabels.length - 1)) * w}
          y={h + 16}
          fill="rgba(255,255,255,0.35)"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
          textAnchor={i === 0 ? "start" : i === axisLabels.length - 1 ? "end" : "middle"}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

function buildAxisLabels(period: Period, count: number): string[] {
  const now = Date.now();
  if (period === "24h") {
    return ["00:00", "06:00", "12:00", "18:00", "ahora"];
  }
  // Para series por día/semana, mostramos ~5 fechas equiespaciadas.
  const stepMs = period === "90d" ? 7.5 * 86400_000 : 86400_000;
  const labels: string[] = [];
  const picks = 5;
  for (let p = 0; p < picks; p++) {
    const idx = Math.round((p / (picks - 1)) * (count - 1));
    const d = new Date(now - (count - 1 - idx) * stepMs);
    labels.push(d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }));
  }
  return labels;
}
