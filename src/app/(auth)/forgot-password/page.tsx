import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordFormClient } from "@/components/auth/forgot-password-form-client";

export const metadata: Metadata = { title: "Recuperar contraseña — Zero" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle="Ingresá tu email y te mandamos un enlace para elegir una nueva contraseña."
      footer={
        <>
          ¿Te acordaste?{" "}
          <Link
            href="/login"
            style={{ color: "var(--text-0)", fontWeight: 500, textDecoration: "none" }}
          >
            Volver a ingresar
          </Link>
        </>
      }
    >
      <ForgotPasswordFormClient />
    </AuthShell>
  );
}
