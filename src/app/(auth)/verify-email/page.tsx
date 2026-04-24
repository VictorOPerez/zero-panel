import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailClient } from "@/components/auth/verify-email-client";

export const metadata: Metadata = { title: "Verificar email — Zero" };

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <AuthShell
      title="Verificar email"
      subtitle="Confirmá tu dirección para poder iniciar sesión."
      footer={
        <>
          ¿Ya lo verificaste?{" "}
          <Link
            href="/login"
            style={{ color: "var(--text-0)", fontWeight: 500, textDecoration: "none" }}
          >
            Ingresar
          </Link>
        </>
      }
    >
      <VerifyEmailClient searchParams={searchParams} />
    </AuthShell>
  );
}
