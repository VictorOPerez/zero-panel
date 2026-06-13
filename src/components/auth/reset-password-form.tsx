"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  authErrorBoxStyle,
  authInputStyle,
  authLabelStyle,
  authPrimaryButtonStyle,
} from "./auth-shell";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={authErrorBoxStyle}>
          El enlace no es válido. Pedí uno nuevo desde &quot;¿Olvidaste?&quot;.
        </div>
        <Link href="/forgot-password" style={{ ...authPrimaryButtonStyle, textDecoration: "none" }}>
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, password);
      router.replace("/login?reset=1");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos restablecer la contraseña. Probá de nuevo."
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div style={authErrorBoxStyle}>{error}</div>}
      <div>
        <label htmlFor="password" style={authLabelStyle}>
          Nueva contraseña
        </label>
        <div style={{ position: "relative" }}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ ...authInputStyle, paddingRight: 38 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "var(--text-3)",
              cursor: "pointer",
              display: "inline-flex",
            }}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="confirm" style={authLabelStyle}>
          Repetí la contraseña
        </label>
        <input
          id="confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          style={authInputStyle}
        />
      </div>
      <button type="submit" disabled={submitting} style={authPrimaryButtonStyle}>
        {submitting && <Loader2 size={15} style={{ animation: "spin 900ms linear infinite" }} />}
        {submitting ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
