"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { me } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

// Rutas que el CLIENTE (no super_admin) puede abrir. Todo lo demás es del panel
// de administrador; si un cliente entra por URL directa, lo mandamos a /inbox.
// El super_admin no tiene esta restricción (ve y entra a todo).
const CLIENT_ALLOWED_PREFIXES = [
  "/inbox",
  "/conversations",
  "/calendar",
  "/billing",
  "/payment-success",
];

function isClientAllowed(pathname: string): boolean {
  return CLIENT_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

/**
 * Guarda las rutas del dashboard: exige sesión, refresca /me en background
 * y si el usuario tiene múltiples tenants sin elegir, redirige a /select-tenant.
 * Además, gatea por rol: el cliente solo accede a su menú reducido (inbox /
 * calendario / suscripción); cualquier otra ruta lo redirige a /inbox.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

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

  // CAMBIO DE NEGOCIO (impersonación / select-tenant): al cambiar el tenant
  // activo, TIRAMOS todo el caché de React Query. Sin esto, la data del negocio
  // anterior queda retenida (refetch-interval/socket la mantienen caliente) y se
  // ve cruzada con la del nuevo — "información de chats como si fuera falsa".
  // Un único QueryClient sirve a toda la app, así que limpiarlo acá cubre todas
  // las vistas. Guardamos el tenant previo para no limpiar en el primer render.
  const prevTenantRef = useRef(activeTenantId);
  useEffect(() => {
    if (prevTenantRef.current !== activeTenantId) {
      prevTenantRef.current = activeTenantId;
      queryClient.clear();
    }
  }, [activeTenantId, queryClient]);

  // Gate por rol: el cliente solo navega su menú reducido. Cualquier otra ruta
  // (escrita a mano o por link viejo) lo devuelve a /inbox. El super_admin pasa.
  const blocked =
    status === "ready" &&
    user != null &&
    user.role !== "super_admin" &&
    !isClientAllowed(pathname);

  useEffect(() => {
    if (blocked) router.replace("/inbox");
  }, [blocked, router]);

  if (status !== "ready" || blocked) {
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
