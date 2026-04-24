import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SelectTenantClient } from "@/components/auth/select-tenant-client";

export const metadata: Metadata = { title: "Elegir tenant — Zero" };

export default function SelectTenantPage() {
  return (
    <AuthShell
      title="Elegí tu workspace"
      subtitle="Tenés acceso a más de un tenant. Seleccioná con cuál querés trabajar."
      wide
    >
      <SelectTenantClient />
    </AuthShell>
  );
}
