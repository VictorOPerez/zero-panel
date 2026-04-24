"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { login, me, requestEmailVerification } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth";
import {
  authErrorBoxStyle,
  authInfoBoxStyle,
  authInputStyle,
  authLabelStyle,
  authPrimaryButtonStyle,
  authSecondaryButtonStyle,
} from "./auth-shell";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const setPermissions = useAuthStore((s) => s.setPermissions);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "loading" | "sent">("idle");

  const next = params.get("next") || "/";
  const verifiedParam = params.get("verified");
  const verifiedBanner =
    verifiedParam === "1"
      ? "Tu email quedó verificado. Iniciá sesión para entrar al panel."
      : verifiedParam === "pending"
        ? "Te enviamos un email con el link de verificación. Cliqueá el link y después entrá con tu password."
        : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setUnverifiedEmail(null);

    try {
      const res = await login({ email, password });
      setSession({ token: res.token, user: res.user });

      // Traer permisos desde /me
      try {
        const m = await me();
        setPermissions(m.permissions);
      } catch {
        // permisos pueden faltar si la conexión falla; el guard los volverá a pedir
      }

      // Si tiene más de un tenant, elegir antes de entrar
      if (res.user.tenant_ids.length > 1) {
        router.replace("/select-tenant");
        return;
      }
      router.replace(next.startsWith("/") ? next : "/");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.is("email_not_verified")) {
          setUnverifiedEmail(email);
          setError("Tu email todavía no fue verificado.");
        } else if (err.status === 401) {
          setError("Email o contraseña incorrectos.");
        } else {
          setError(err.payload.error || "No pudimos iniciar sesión. Intentá de nuevo.");
        }
      } else {
        setError("No pudimos conectar con el servidor. Revisá tu conexión.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (!unverifiedEmail || resendState === "loading") return;
    setResendState("loading");
    try {
      await requestEmailVerification(unverifiedEmail);
      setResendState("sent");
    } catch {
      setResendState("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div role="alert" style={authErrorBoxStyle}>{error}</div>}

      {!error && verifiedBanner && <div style={authInfoBoxStyle}>{verifiedBanner}</div>}

      {unverifiedEmail && (
        <div style={authInfoBoxStyle}>
          Te enviamos un email con el link de verificación a{" "}
          <strong style={{ color: "var(--text-0)" }}>{unverifiedEmail}</strong>.
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={onResend}
              disabled={resendState !== "idle"}
              style={{
                ...authSecondaryButtonStyle,
                padding: "6px 12px",
                width: "auto",
                fontSize: 12,
              }}
            >
              {resendState === "loading"
                ? "Enviando…"
                : resendState === "sent"
                ? "Mail reenviado"
                : "Reenviar email"}
            </button>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="email" style={authLabelStyle}>Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vos@empresa.com"
          style={authInputStyle}
        />
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label htmlFor="password" style={authLabelStyle}>Contraseña</label>
          <Link
            href="/login"
            style={{
              fontSize: 11,
              color: "var(--text-2)",
              textDecoration: "none",
              marginBottom: 6,
            }}
          >
            ¿Olvidaste?
          </Link>
        </div>
        <div style={{ position: "relative" }}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ ...authInputStyle, paddingRight: 38 }}
          />
          <button
            type="button"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            onClick={() => setShowPassword((v) => !v)}
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              width: 28,
              height: 28,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "transparent",
              color: "var(--text-3)",
              cursor: "pointer",
              borderRadius: 6,
            }}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          ...authPrimaryButtonStyle,
          opacity: submitting ? 0.7 : 1,
          cursor: submitting ? "progress" : "pointer",
          marginTop: 6,
        }}
      >
        {submitting ? (
          <>
            <Loader2 size={14} style={{ animation: "spin 900ms linear infinite" }} />
            Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </button>
    </form>
  );
}
