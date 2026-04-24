import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterFormClient } from "@/components/auth/register-form-client";

export const metadata: Metadata = { title: "Crear cuenta — Zero" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Crear tu cuenta Zero"
      subtitle="Creá tu tenant, activá el asistente y empezá tu trial sin tarjeta."
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link
            href="/login"
            style={{ color: "var(--text-0)", fontWeight: 500, textDecoration: "none" }}
          >
            Ingresar
          </Link>
        </>
      }
      wide
    >
      <RegisterFormClient />
    </AuthShell>
  );
}
