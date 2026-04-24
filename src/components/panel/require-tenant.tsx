"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { AlertCircle } from "lucide-react";

/**
 * Render children sólo si hay tenant activo; si no, muestra un placeholder
 * con un CTA para elegir tenant. Pensado como guard por-página dentro del dashboard.
 */
export function RequireTenant({
  children,
}: {
  children: (tenantId: string) => React.ReactNode;
}) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const tenantId = useAuthStore((s) => s.activeTenantId);

  if (!hydrated) {
    return (
      <div
        style={{
          padding: 40,
          color: "var(--text-2)",
          fontSize: 13,
        }}
      >
        Cargando…
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div
        style={{
          padding: "40px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 12,
          maxWidth: 480,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--z-amber)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <AlertCircle size={16} /> Seleccioná un tenant
        </div>
        <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
          Necesitás elegir con qué workspace querés trabajar para ver esta sección.
        </div>
        <Link
          href="/select-tenant"
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
            textDecoration: "none",
          }}
        >
          Elegir workspace
        </Link>
      </div>
    );
  }

  return <>{children(tenantId)}</>;
}
