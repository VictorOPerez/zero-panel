"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { signup } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  authErrorBoxStyle,
  authInfoBoxStyle,
  authInputStyle,
  authLabelStyle,
  authPrimaryButtonStyle,
} from "./auth-shell";

const TIMEZONES = [
  "America/Argentina/Buenos_Aires",
  "America/Argentina/Cordoba",
  "America/Santiago",
  "America/Montevideo",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Caracas",
  "Europe/Madrid",
  "Europe/London",
];

export function RegisterForm() {
  const router = useRouter();

  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [timezone, setTimezone] = useState(
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || TIMEZONES[0]
      : TIMEZONES[0]
  );
  const [locale] = useState("es-AR");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<null | { email: string }>(null);

  function scorePassword(pw: string): { pct: number; label: string; color: string } {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const pct = Math.min(100, (score / 5) * 100);
    const label = score < 2 ? "Débil" : score < 4 ? "Aceptable" : "Fuerte";
    const color = score < 2 ? "var(--z-red)" : score < 4 ? "var(--z-amber)" : "var(--z-green)";
    return { pct, label, color };
  }
  const strength = scorePassword(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await signup({
        business_name: businessName.trim(),
        email: email.trim(),
        password,
        timezone,
        locale,
      });
      // Importante: NO guardamos la sesión todavía. El backend ahora exige
      // email verificado para acceder al panel, así que si metemos el token
      // y redirigimos a "/" todos los calls admin van a tirar 403. Mejor
      // mostramos el mensaje de "verificá tu email" y mandamos a /login
      // para que entre recién cuando haya clickeado el link.
      setSuccess({ email: res.user.email });
      setTimeout(() => {
        router.replace("/login?verified=pending");
      }, 2500);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError("Ya existe una cuenta con ese email o nombre de negocio.");
        } else {
          setError(err.payload.error || "No pudimos crear tu cuenta. Intentá de nuevo.");
        }
      } else {
        setError("No pudimos conectar con el servidor. Revisá tu conexión.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          <MailCheck size={24} />
        </div>
        <div style={{ textAlign: "center", fontSize: 14, lineHeight: 1.5, color: "var(--text-1)" }}>
          Tu cuenta fue creada. Te mandamos un email a{" "}
          <strong style={{ color: "var(--text-0)" }}>{success.email}</strong> para verificar tu
          dirección.
          <div style={{ marginTop: 6, color: "var(--text-2)", fontSize: 12.5 }}>
            Te llevamos al panel en un momento…
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div role="alert" style={authErrorBoxStyle}>{error}</div>}

      <div>
        <label htmlFor="business_name" style={authLabelStyle}>Nombre del negocio</label>
        <input
          id="business_name"
          type="text"
          required
          minLength={2}
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Aurora Bazar"
          style={authInputStyle}
        />
      </div>

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
        <label htmlFor="password" style={authLabelStyle}>Contraseña</label>
        <div style={{ position: "relative" }}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
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
        {password.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                width: "100%",
                height: 3,
                borderRadius: 2,
                background: "rgba(255,255,255,0.05)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${strength.pct}%`,
                  height: "100%",
                  background: strength.color,
                  transition: "width 180ms, background 180ms",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 11,
                color: strength.color,
                fontFamily: "var(--font-jetbrains-mono)",
              }}
            >
              {strength.label}
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="timezone" style={authLabelStyle}>Zona horaria</label>
        <select
          id="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={{ ...authInputStyle, appearance: "none", paddingRight: 30 }}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz} style={{ background: "var(--bg-1)" }}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      <div style={authInfoBoxStyle}>
        Al crear tu cuenta arrancás en <strong style={{ color: "var(--text-0)" }}>trial</strong>
        {" "}sin tarjeta de crédito. Incluye conexión de WhatsApp, Telegram y calendario.
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          ...authPrimaryButtonStyle,
          opacity: submitting ? 0.7 : 1,
          cursor: submitting ? "progress" : "pointer",
        }}
      >
        {submitting ? (
          <>
            <Loader2 size={14} style={{ animation: "spin 900ms linear infinite" }} />
            Creando tu cuenta…
          </>
        ) : (
          <>
            <Check size={14} />
            Crear cuenta y arrancar trial
          </>
        )}
      </button>

      <div style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", lineHeight: 1.5 }}>
        Al continuar aceptás los términos y la política de privacidad de Zero.
      </div>
    </form>
  );
}
