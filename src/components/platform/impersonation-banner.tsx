"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { Eye, LayoutGrid, MessageCircle, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getTenant } from "@/lib/api/tenants";

// Señalización para el dueño de plataforma (super_admin): cuando está operando
// DENTRO de una sub-cuenta (un negocio), una barra arriba deja claro EN CUÁL
// está, para que no se confunda al entrar a varios. Solo super_admin la ve; se
// oculta en el propio Centro de Control (ahí la vista es cross-tenant).
export function ImpersonationBanner() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);
  const activeTenantId = useAuthStore((s) => s.activeTenantId);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const isSuper = user?.role === "super_admin";
  const onPlatform = pathname?.startsWith("/platform") ?? false;
  const enabled = Boolean(hydrated && isSuper && activeTenantId && !onPlatform);

  const q = useQuery({
    queryKey: ["impersonation-tenant", activeTenantId],
    queryFn: () => getTenant(activeTenantId as string),
    enabled,
    staleTime: 60_000,
  });

  if (!enabled) return null;

  const name = q.data?.tenant?.business?.name || activeTenantId;
  const waNumber = q.data?.tenant?.channels?.whatsapp?.number?.trim();
  // NavApex (tenant dueño de plataforma) → verde "tu cuenta · super admin".
  // Un negocio cliente → ámbar "sub-cuenta".
  const isOwner = q.data?.tenant?.is_platform_owner === true;
  const hue = isOwner ? "155" : "75"; // verde vs ámbar
  const accent = isOwner ? "0.78 0.15 155" : "0.85 0.16 75";

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 16px",
        background: `linear-gradient(90deg, oklch(0.80 0.16 ${hue} / 0.16), oklch(0.80 0.16 ${hue} / 0.06))`,
        borderBottom: `1px solid oklch(0.80 0.16 ${hue} / 0.35)`,
        color: `oklch(${accent})`,
        fontSize: 12.5,
        flexWrap: "wrap",
      }}
    >
      {isOwner ? (
        <ShieldCheck size={14} style={{ flexShrink: 0 }} />
      ) : (
        <Eye size={14} style={{ flexShrink: 0 }} />
      )}
      <span>
        {isOwner ? (
          <>
            Tu cuenta · <strong style={{ color: "var(--text-0)" }}>Super admin</strong> ·{" "}
            <strong style={{ color: "var(--text-0)" }}>{name}</strong>
          </>
        ) : (
          <>
            Estás dentro de la sub-cuenta:{" "}
            <strong style={{ color: "var(--text-0)" }}>{name}</strong>
          </>
        )}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: 11.5,
          color: waNumber ? "var(--text-1)" : "var(--text-3)",
          padding: "2px 8px",
          borderRadius: 4,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--hair)",
        }}
      >
        <MessageCircle size={11} style={{ color: "oklch(0.78 0.15 155)" }} />
        {waNumber ? `+${waNumber.replace(/^\+/, "")}` : "sin WhatsApp"}
      </span>
      <button
        type="button"
        onClick={() => router.push("/platform")}
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 5,
          border: `1px solid oklch(0.80 0.16 ${hue} / 0.4)`,
          background: "transparent",
          color: `oklch(${accent})`,
          fontSize: 11.5,
          fontWeight: 600,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <LayoutGrid size={12} /> Centro de Control
      </button>
    </div>
  );
}
