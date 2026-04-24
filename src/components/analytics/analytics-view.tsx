"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { IconDot, IconSparkle } from "@/components/icons";
import { getAnalytics, type AnalyticsPeriod } from "@/lib/api/analytics";
import { useAuthStore } from "@/store/auth";

const PERIODS = ["24h", "7d", "30d", "90d"] as const satisfies readonly AnalyticsPeriod[];
type Period = (typeof PERIODS)[number];

const EMPTY_SERIES = Array(24).fill(0) as number[];

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
  const series = query.data?.series?.length ? query.data.series : EMPTY_SERIES;
  const byChannel = query.data?.byChannel ?? [];
  const csat = query.data?.csat ?? { score: 0, count: 0 };

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
            Últimos {period} · Aurora Bazar
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
              <div style={{ fontSize: 13, fontWeight: 600 }}>Volumen de conversaciones</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Últimas 24 horas</div>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
              <LegendDot color="var(--z-cyan)" label="Zero" />
              <LegendDot color="var(--z-amber)" label="Humano" />
            </div>
          </div>
          <AreaChart data={series} />
        </div>

        <div className="glass" style={{ padding: 16, borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Distribución por canal</div>
          {byChannel.map((c) => (
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
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid-chart-3" style={{ marginTop: 14 }}>
        {/* CSAT */}
        <div className="glass" style={{ padding: 16, borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Satisfacción (CSAT)</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
            <span
              className="aurora-text"
              style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 34, fontWeight: 700 }}
            >
              {csat.score}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>/ 5 · {csat.count} respuestas</span>
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 10 }}>
            {[92, 56, 23, 8, 5].map((v, i) => (
              <div key={i} style={{ flex: 1 }}>
                <div style={{ height: 40, display: "flex", alignItems: "flex-end" }}>
                  <div
                    style={{
                      width: "100%",
                      height: `${v}%`,
                      borderRadius: 2,
                      background: i < 2 ? "var(--aurora)" : "rgba(255,255,255,0.08)",
                    }}
                    role="img"
                    aria-label={`${5 - i} estrellas: ${v}%`}
                  />
                </div>
                <div
                  style={{
                    fontSize: 10,
                    textAlign: "center",
                    color: "var(--text-3)",
                    fontFamily: "var(--font-jetbrains-mono)",
                    marginTop: 3,
                  }}
                >
                  {5 - i}★
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Intenciones */}
        <div className="glass" style={{ padding: 16, borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Intenciones más frecuentes</div>
          <div style={{ marginTop: 10 }}>
            {[
              { t: "Consultas de stock", n: 62, c: "var(--z-cyan)" },
              { t: "Precio / cotización", n: 41, c: "var(--z-purple)" },
              { t: "Estado de envío", n: 28, c: "var(--z-cyan)" },
              { t: "Agendar cita", n: 19, c: "var(--z-purple)" },
              { t: "Devoluciones", n: 12, c: "var(--z-amber)" },
            ].map((item) => (
              <div
                key={item.t}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, padding: "5px 0" }}
              >
                <IconDot color={item.c} size={6} />
                <span style={{ flex: 1 }}>{item.t}</span>
                <span style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-2)" }}>
                  {item.n}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Escalados */}
        <div className="glass" style={{ padding: 16, borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Top escalados</div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              "Cambio de talle ya despachado",
              "Descuento por volumen > 10 uds",
              "Pedido personalizado (grabado)",
              "Facturación a extranjero",
            ].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: "oklch(0.80 0.14 75 / 0.15)",
                    border: "1px solid oklch(0.80 0.14 75 / 0.3)",
                    color: "var(--z-amber)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <User size={10} />
                </span>
                <span style={{ color: "var(--text-1)" }}>{t}</span>
              </div>
            ))}
            <button
              style={{
                marginTop: 6,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 5,
                border: "1px solid var(--hair-strong)",
                background: "rgba(255,255,255,0.03)",
                color: "var(--text-1)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              <IconSparkle size={11} /> Entrenar con estos casos
            </button>
          </div>
        </div>
      </div>
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
    <div
      role="listitem"
      className="glass"
      style={{ padding: 14, borderRadius: 10 }}
    >
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
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--font-jetbrains-mono)",
            color: kpi.trend === "up" ? "var(--z-green)" : "var(--text-3)",
          }}
        >
          {kpi.delta}
        </span>
      </div>
      <Sparkline data={series} />
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 200;
  const h = 28;
  const max = Math.max(...data);
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

function AreaChart({ data }: { data: number[] }) {
  const w = 600;
  const h = 140;
  const max = Math.max(...data);
  const path = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / max) * (h - 10);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h + 22}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: 160 }}
      role="img"
      aria-label="Gráfico de volumen de conversaciones"
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
      {["00", "04", "08", "12", "16", "20", "24"].map((t, i) => (
        <text
          key={t}
          x={(i / 6) * w}
          y={h + 16}
          fill="rgba(255,255,255,0.35)"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
          textAnchor={i === 0 ? "start" : i === 6 ? "end" : "middle"}
        >
          {t}:00
        </text>
      ))}
    </svg>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--text-2)" }}>
      <IconDot color={color} size={7} />
      {label}
    </span>
  );
}
