import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordFormClient } from "@/components/auth/reset-password-form-client";

export const metadata: Metadata = { title: "Nueva contraseña — Zero" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Elegí una nueva contraseña"
      subtitle="Tu nueva contraseña tiene que tener al menos 8 caracteres."
      footer={
        <>
          ¿Necesitás otro enlace?{" "}
          <Link
            href="/forgot-password"
            style={{ color: "var(--text-0)", fontWeight: 500, textDecoration: "none" }}
          >
            Pedir uno nuevo
          </Link>
        </>
      }
    >
      <ResetPasswordFormClient />
    </AuthShell>
  );
}
