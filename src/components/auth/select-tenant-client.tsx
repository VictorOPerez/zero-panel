"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Check, Loader2 } from "lucide-react";
import { listTenants } from "@/lib/api/tenants";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth";
import type { TenantSummary } from "@/lib/api/contract";
import {
  authErrorBoxStyle,
  authSecondaryButtonStyle,
} from "./auth-shell";

export function SelectTenantClient() {
  const router = useRouter();
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);
  const activeTenantId = useAuthStore((s) => s.activeTenantId);
  const setActiveTenant = useAuthStore((s) => s.setActiveTenant);

  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(activeTenantId);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const res = await listTenants();
        if (!cancel) {
          setTenants(res.tenants);
          if (!selected && res.tenants.length > 0) {
            setSelected(res.tenants[0].tenant_id);
          }
        }
      } catch (err) {
        if (!cancel) {
          setError(
            err instanceof ApiError
              ? err.payload.error || "No pudimos cargar tus tenants."
              : "No pudimos conectar con el servidor."
          );
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [hydrated, user, router, selected]);

  function onContinue() {
    if (!selected) return;
    setActiveTenant(selected);
    router.replace("/");
  }

  if (!tenants && !error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 10,
          color: "var(--text-2)",
          fontSize: 13,
        }}
      >
        <Loader2 size={16} style={{ animation: "spin 900ms linear infinite" }} />
        Cargando tenants…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div role="alert" style={authErrorBoxStyle}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tenants?.map((t) => {
          const on = selected === t.tenant_id;
          return (
            <button
              key={t.tenant_id}
              type="button"
              onClick={() => setSelected(t.tenant_id)}
              aria-pressed={on}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 10,
                border: on
                  ? "1px solid oklch(0.62 0.22 295 / 0.5)"
                  : "1px solid var(--hair)",
                background: on
                  ? "linear-gradient(90deg, oklch(0.62 0.22 295 / 0.14), transparent)"
                  : "rgba(255,255,255,0.02)",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--text-0)",
                fontFamily: "inherit",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--hair)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-2)",
                  flexShrink: 0,
                }}
              >
                <Building2 size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {t.business?.name || t.tenant_id}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-3)",
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                >
                  {t.tenant_id}
                  {t.active ? " · activo" : " · inactivo"}
                </div>
              </div>
              {on && <Check size={16} style={{ color: "var(--z-cyan)", flexShrink: 0 }} />}
            </button>
          );
        })}
        {tenants?.length === 0 && (
          <div style={{ padding: 16, textAlign: "center", color: "var(--text-2)", fontSize: 13 }}>
            No tenés tenants asociados. Contactá al administrador de la plataforma.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!selected}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "11px 16px",
          borderRadius: 8,
          border: "none",
          background: selected ? "var(--aurora)" : "rgba(255,255,255,0.05)",
          color: selected ? "#0a0a0f" : "var(--text-3)",
          fontSize: 13,
          fontWeight: 600,
          cursor: selected ? "pointer" : "not-allowed",
          marginTop: 6,
        }}
      >
        Entrar al workspace
        <ArrowRight size={14} />
      </button>

      {user && (
        <button
          type="button"
          onClick={() => {
            useAuthStore.getState().logout();
            router.replace("/login");
          }}
          style={authSecondaryButtonStyle}
        >
          Cerrar sesión
        </button>
      )}
    </div>
  );
}
