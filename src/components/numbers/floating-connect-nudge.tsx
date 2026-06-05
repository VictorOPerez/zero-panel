"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { listTenantNumbers } from "@/lib/api/numbers";

const DISMISS_KEY = "zero.nudge.connect.dismissed";

// Nudge flotante de onboarding: invita a conectar/comprar un número para activar
// el agente virtual. Se muestra solo si el tenant todavía NO tiene números, no
// está en la página /numbers, y no lo cerró antes (persistido en localStorage).
export function FloatingConnectNudge() {
  const router = useRouter();
  const pathname = usePathname();
  const tenantId = useAuthStore((s) => s.activeTenantId);
  const hydrated = useAuthStore((s) => s.hydrated);
  const [dismissed, setDismissed] = useState(true); // oculto hasta leer localStorage

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const numbersQuery = useQuery({
    queryKey: ["tenant-numbers", tenantId],
    queryFn: () => listTenantNumbers(tenantId as string),
    enabled: Boolean(tenantId) && hydrated && !dismissed,
  });

  if (!hydrated || !tenantId || dismissed) return null;
  if (pathname?.startsWith("/numbers")) return null; // redundante ahí
  if (numbersQuery.isLoading) return null;
  if ((numbersQuery.data?.length ?? 0) > 0) return null; // ya tiene número

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
    setDismissed(true);
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 80,
        maxWidth: 340,
        width: "calc(100vw - 40px)",
      }}
    >
      <div
        className="glass"
        style={{
          position: "relative",
          border: "1px solid var(--hair-strong)",
          borderRadius: 14,
          padding: "16px 16px 14px",
          background: "var(--surface-1, rgba(15,15,20,0.96))",
          boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            border: "none",
            background: "transparent",
            color: "var(--text-3)",
            cursor: "pointer",
            padding: 2,
            lineHeight: 0,
          }}
        >
          <X size={14} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--aurora)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Sparkles size={16} style={{ color: "#0a0a0f" }} />
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-0)" }}>
            Activá tu agente virtual
          </div>
        </div>

        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-2)",
            lineHeight: 1.5,
            marginTop: 9,
          }}
        >
          Conectá un número a <strong style={{ color: "var(--text-1)" }}>WhatsApp
          Business</strong> para que tu agente atienda solo. ¿No tenés uno?{" "}
          <strong style={{ color: "var(--text-1)" }}>Comprá un número virtual</strong>{" "}
          en segundos.
        </div>

        <button
          type="button"
          onClick={() => {
            router.push("/numbers");
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 12,
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--aurora)",
            color: "#0a0a0f",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Empezar <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
