import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginFormClient } from "@/components/auth/login-form-client";

export const metadata: Metadata = { title: "Ingresar — Zero" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Ingresar a Zero"
      subtitle="Bienvenido de vuelta. Entra con tu email y contraseña para administrar tu asistente."
      footer={
        <>
          ¿Todavía no tenés cuenta?{" "}
          <Link
            href="/register"
            style={{ color: "var(--text-0)", fontWeight: 500, textDecoration: "none" }}
          >
            Crear cuenta
          </Link>
        </>
      }
    >
      <LoginFormClient />
    </AuthShell>
  );
}
