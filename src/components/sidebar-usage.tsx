"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getTenantSubscriptionStatus } from "@/lib/api/billing";
import type { TenantStatusReport } from "@/lib/api/contract";

// Barra de uso SIEMPRE visible en el sidebar (toda página). Le habla al cliente
// en % + conversaciones, nunca en tokens. Estados de color a 80%/100% para que
// el límite sea transparente y el upsell aparezca solo. Clic → /billing.

const UNLIMITED_CONV_THRESHOLD = 50_000; // por encima = "Ilimitado" (grants dueño)

function tone(percent: number): { color: string; track: string } {
  if (percent >= 100) return { color: "var(--z-red)", track: "oklch(0.68 0.21 25 / 0.18)" };
  if (percent >= 80) return { color: "var(--z-amber)", track: "oklch(0.80 0.14 75 / 0.16)" };
  return { color: "var(--z-green)", track: "rgba(255,255,255,0.06)" };
}

function isUnlimited(s: TenantStatusReport): boolean {
  const total = s.estimated_conversations_total ?? -1;
  return total < 0 || total > UNLIMITED_CONV_THRESHOLD;
}

export function SidebarUsage({ tenantId }: { tenantId: string | null }) {
  const { data: status } = useQuery({
    queryKey: ["tenant-status", tenantId],
    queryFn: () => getTenantSubscriptionStatus(tenantId as string),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });

  if (!tenantId || !status) return null;

  const unlimited = isUnlimited(status);
  const percent = Math.min(100, Math.max(0, Math.round(status.usage_percent)));
  const remaining = status.estimated_conversations_remaining ?? -1;
  const t = tone(status.usage_percent);

  return (
    <Link
      href="/billing"
      title="Tu uso del plan este mes — tocá para ver detalles"
      style={{
        display: "block",
        textDecoration: "none",
        padding: "9px 10px",
        marginBottom: 8,
        borderRadius: 8,
        border: "1px solid var(--hair)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 9.5,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--text-3)",
            fontWeight: 600,
          }}
        >
          Uso del plan
        </span>
        {!unlimited && (
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: "var(--font-jetbrains-mono)",
              color: t.color,
            }}
          >
            {percent}%
          </span>
        )}
      </div>

      {unlimited ? (
        <div style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500 }}>
          Ilimitado
        </div>
      ) : (
        <>
          <div
            style={{
              height: 5,
              borderRadius: 999,
              background: t.track,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                borderRadius: 999,
                background: t.color,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 6 }}>
            {remaining >= 0
              ? `≈ ${remaining.toLocaleString("es-AR")} conversaciones restantes`
              : "Este mes"}
          </div>
        </>
      )}
    </Link>
  );
}
