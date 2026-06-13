"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  authErrorBoxStyle,
  authInfoBoxStyle,
  authInputStyle,
  authLabelStyle,
  authPrimaryButtonStyle,
} from "./auth-shell";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.payload.error : "No pudimos procesar el pedido. Probá de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...authInfoBoxStyle, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <MailCheck size={16} style={{ color: "var(--z-cyan)", flexShrink: 0, marginTop: 1 }} />
          <span>
            Si <strong>{email}</strong> tiene una cuenta, te enviamos un enlace para restablecer la
            contraseña. Revisá tu bandeja (y el spam). El enlace vence en 1 hora.
          </span>
        </div>
        <Link href="/login" style={{ ...authPrimaryButtonStyle, textDecoration: "none" }}>
          Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div style={authErrorBoxStyle}>{error}</div>}
      <div>
        <label htmlFor="email" style={authLabelStyle}>
          Email de tu cuenta
        </label>
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
      <button type="submit" disabled={submitting} style={authPrimaryButtonStyle}>
        {submitting && <Loader2 size={15} style={{ animation: "spin 900ms linear infinite" }} />}
        {submitting ? "Enviando…" : "Enviarme el enlace"}
      </button>
    </form>
  );
}
