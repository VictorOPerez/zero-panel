"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { me } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * Guarda las rutas del dashboard: exige sesión, refresca /me en background
 * y si el usuario tiene múltiples tenants sin elegir, redirige a /select-tenant.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const activeTenantId = useAuthStore((s) => s.activeTenantId);
  const setSession = useAuthStore((s) => s.setSession);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const logout = useAuthStore((s) => s.logout);

  const [status, setStatus] = useState<"checking" | "ready" | "redirect">(
    hydrated && token && user ? "ready" : "checking"
  );

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!hydrated) return;

    if (!token) {
      setStatus("redirect");
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/login?next=${next}`);
      return;
    }

    if (user && (user.tenant_ids?.length ?? 0) > 1 && !activeTenantId) {
      setStatus("redirect");
      router.replace("/select-tenant");
      return;
    }

    // Tenemos token — refrescamos /me en background y marcamos como listos.
    setStatus("ready");
    let cancel = false;
    (async () => {
      try {
        const m = await me();
        if (cancel) return;
        setSession({ token, user: m.user, permissions: m.permissions });
        setPermissions(m.permissions);
      } catch (err) {
        if (cancel) return;
        if (err instanceof ApiError && err.status === 401) {
          logout();
          router.replace("/login");
        }
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, token, activeTenantId]);

  if (status !== "ready") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          color: "var(--text-2)",
          fontSize: 13,
        }}
      >
        <Loader2 size={16} style={{ animation: "spin 900ms linear infinite" }} />
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}
