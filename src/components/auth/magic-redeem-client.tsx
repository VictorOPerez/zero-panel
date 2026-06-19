"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, ShieldCheck, Mail } from "lucide-react";
import {
  requestMagicCode,
  verifyMagicCode,
  redeemMagicLink,
  type MagicRedeemResponse,
} from "@/lib/api/platform";
import { me } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth";

type Phase = "checking" | "code" | "entering" | "error";

export function MagicRedeemClient() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const setSession = useAuthStore((s) => s.setSession);
  const setPermissions = useAuthStore((s) => s.setPermissions);

  const [phase, setPhase] = useState<Phase>("checking");
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const ran = useRef(false);

  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  // Finaliza el ingreso: guarda la sesión, refresca permisos y entra al panel.
  async function finalize(res: MagicRedeemResponse) {
    setPhase("entering");
    setSession({ token: res.token, user: res.user });
    try {
      const m = await me();
      setPermissions(m.permissions);
    } catch {
      // permisos pueden faltar; el guard los vuelve a pedir
    }
    router.replace("/");
  }

  // Si el link ya se usó pero ya hay sesión en este navegador, entramos igual.
  function recoverIfSession(): boolean {
    const existing =
      typeof window !== "undefined" ? window.localStorage.getItem("zero.token") : null;
    if (existing) {
      router.replace("/");
      return true;
    }
    return false;
  }

  useEffect(() => {
    if (ran.current) return; // StrictMode monta 2 veces en dev
    ran.current = true;

    if (!token) {
      setError("Link inválido.");
      setPhase("error");
      return;
    }

    (async () => {
      try {
        const res = await requestMagicCode(token);
        if (res.otp_required) {
          setEmailHint(res.email_hint);
          setPhase("code");
          return;
        }
        // Sin 2do factor → canje directo.
        const session = await redeemMagicLink(token);
        await finalize(session);
      } catch {
        if (recoverIfSession()) return;
        setError(
          "Este link no es válido o ya fue usado. Pedile al equipo de Zero un nuevo enlace de acceso."
        );
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!token || code.trim().length < 6) return;
    setVerifying(true);
    setCodeError(null);
    try {
      const session = await verifyMagicCode(token, code.trim());
      await finalize(session);
    } catch (err) {
      const reason =
        err instanceof ApiError ? (err.payload as { reason?: string }).reason : null;
      setCodeError(
        reason === "expired"
          ? "El código venció. Pedí uno nuevo."
          : reason === "too_many"
            ? "Demasiados intentos. Pedí un código nuevo."
            : err instanceof ApiError && err.status === 401 && err.payload.error !== "invalid_code"
              ? "El enlace no es válido o ya fue usado."
              : "Código incorrecto. Revisá e intentá de nuevo."
      );
      setVerifying(false);
    }
  }

  async function resend() {
    if (!token || resending) return;
    setResending(true);
    setCodeError(null);
    setCode("");
    try {
      const res = await requestMagicCode(token);
      if (!res.otp_required) {
        const session = await redeemMagicLink(token);
        await finalize(session);
        return;
      }
      setEmailHint(res.email_hint);
    } catch {
      setCodeError("No pudimos reenviar el código. Reintentá en un momento.");
    } finally {
      setResending(false);
    }
  }

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
        {phase === "error" ? (
          <>
            <AlertCircle size={26} style={{ color: "var(--z-amber)" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-0)", marginTop: 12 }}>
              No pudimos entrar
            </div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 8, lineHeight: 1.5 }}>
              {error}
            </div>
          </>
        ) : phase === "code" ? (
          <form onSubmit={submitCode}>
            <ShieldCheck size={26} style={{ color: "var(--z-cyan)" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-0)", marginTop: 12 }}>
              Confirmá que sos vos
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-2)",
                marginTop: 8,
                lineHeight: 1.5,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <Mail size={13} style={{ color: "var(--text-3)" }} />
              Te enviamos un código a{" "}
              <strong style={{ color: "var(--text-0)" }}>{emailHint ?? "tu correo"}</strong>
            </div>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="• • • • • •"
              autoFocus
              style={{
                marginTop: 18,
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--hair-strong)",
                background: "rgba(0,0,0,0.2)",
                color: "var(--text-0)",
                fontSize: 22,
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: 8,
                textAlign: "center",
                outline: "none",
              }}
            />
            {codeError && (
              <div style={{ fontSize: 12.5, color: "var(--z-red)", marginTop: 10 }}>
                {codeError}
              </div>
            )}
            <button
              type="submit"
              disabled={code.length < 6 || verifying}
              style={{
                marginTop: 14,
                width: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "11px 16px",
                borderRadius: 10,
                border: "none",
                background: "var(--aurora)",
                color: "#0a0a0f",
                fontSize: 13.5,
                fontWeight: 700,
                cursor: code.length < 6 || verifying ? "not-allowed" : "pointer",
                opacity: code.length < 6 ? 0.55 : 1,
              }}
            >
              {verifying ? (
                <Loader2 size={14} style={{ animation: "spin 900ms linear infinite" }} />
              ) : null}
              {verifying ? "Verificando…" : "Entrar"}
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              style={{
                marginTop: 12,
                background: "transparent",
                border: "none",
                color: "var(--text-3)",
                fontSize: 12,
                cursor: resending ? "default" : "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              {resending ? "Reenviando…" : "Reenviar código"}
            </button>
          </form>
        ) : (
          <>
            <Loader2
              size={26}
              style={{ color: "var(--z-cyan)", animation: "spin 900ms linear infinite" }}
            />
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-0)", marginTop: 12 }}>
              {phase === "entering" ? "Entrando a tu panel…" : "Verificando tu enlace…"}
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
