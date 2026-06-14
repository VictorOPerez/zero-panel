"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { redeemMagicLink } from "@/lib/api/platform";
import { me } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth";

export function MagicRedeemClient() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const setSession = useAuthStore((s) => s.setSession);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // un solo canje (StrictMode monta 2 veces en dev)
    ran.current = true;

    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    if (!token) {
      setError("Link inválido.");
      return;
    }

    (async () => {
      try {
        const res = await redeemMagicLink(token);
        setSession({ token: res.token, user: res.user });
        try {
          const m = await me();
          setPermissions(m.permissions);
        } catch {
          // permisos pueden faltar; el guard los vuelve a pedir
        }
        router.replace("/");
      } catch {
        // Si el link ya se usó pero ya hay sesión guardada, entramos igual.
        const existing =
          typeof window !== "undefined"
            ? window.localStorage.getItem("zero.token")
            : null;
        if (existing) {
          router.replace("/");
          return;
        }
        setError(
          "Este link no es válido o ya fue usado. Pedile al equipo de Zero un nuevo enlace de acceso."
        );
      }
    })();
  }, [params, router, setSession, setPermissions]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="glass"
        style={{
          width: "min(420px, 100%)",
          padding: 28,
          borderRadius: 14,
          border: "1px solid var(--hair-strong)",
          textAlign: "center",
        }}
      >
        {error ? (
          <>
            <AlertCircle size={26} style={{ color: "var(--z-amber)" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-0)", marginTop: 12 }}>
              No pudimos entrar
            </div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 8, lineHeight: 1.5 }}>
              {error}
            </div>
          </>
        ) : (
          <>
            <Loader2
              size={26}
              style={{ color: "var(--z-cyan)", animation: "spin 900ms linear infinite" }}
            />
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-0)", marginTop: 12 }}>
              Entrando a tu panel…
            </div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 8 }}>
              Un segundo, estamos preparando todo.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
