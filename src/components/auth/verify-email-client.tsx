"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { confirmEmailVerification } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  authErrorBoxStyle,
  authInfoBoxStyle,
  authPrimaryButtonStyle,
} from "./auth-shell";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function VerifyEmailClient({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = use(searchParams);
  const token = params.token;
  const [state, setState] = useState<State>({ kind: token ? "loading" : "idle" });

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    (async () => {
      try {
        await confirmEmailVerification(token);
        if (!cancel) setState({ kind: "ok" });
      } catch (err) {
        if (cancel) return;
        const msg =
          err instanceof ApiError
            ? err.payload.error || "El token de verificación no es válido o expiró."
            : "No pudimos confirmar el email. Probá de nuevo.";
        setState({ kind: "error", message: msg });
      }
    })();
    return () => {
      cancel = true;
    };
  }, [token]);

  if (!token || state.kind === "idle") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={authInfoBoxStyle}>
          Abrí el link que te enviamos por email para verificar tu dirección. Si no llegó, revisá
          spam o pediendo un nuevo email desde tu sesión.
        </div>
        <Link href="/login" style={{ ...authPrimaryButtonStyle, textDecoration: "none" }}>
          Volver al login
        </Link>
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 12 }}>
        <Loader2 size={24} style={{ color: "var(--text-2)", animation: "spin 900ms linear infinite" }} />
        <div style={{ fontSize: 13, color: "var(--text-2)" }}>Verificando tu email…</div>
      </div>
    );
  }

  if (state.kind === "ok") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "oklch(0.78 0.15 155 / 0.15)",
            border: "1px solid oklch(0.78 0.15 155 / 0.35)",
            color: "var(--z-green)",
            alignSelf: "center",
          }}
        >
          <CheckCircle2 size={24} />
        </div>
        <div style={{ fontSize: 13.5, textAlign: "center", color: "var(--text-1)" }}>
          Tu email está verificado. Ya podés iniciar sesión.
        </div>
        <Link href="/login" style={{ ...authPrimaryButtonStyle, textDecoration: "none" }}>
          Ir al login
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "oklch(0.68 0.21 25 / 0.1)",
          border: "1px solid oklch(0.68 0.21 25 / 0.35)",
          color: "var(--z-red)",
          alignSelf: "center",
        }}
      >
        <XCircle size={24} />
      </div>
      <div style={authErrorBoxStyle}>{state.message}</div>
      <Link href="/login" style={{ ...authPrimaryButtonStyle, textDecoration: "none" }}>
        Volver al login
      </Link>
    </div>
  );
}
