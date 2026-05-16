"use client";

import { useState } from "react";
import { History, Users } from "lucide-react";
import { PageShell } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import { AdminsTableView } from "./admins-table-view";
import { AdminAuditView } from "./admin-audit-view";

type Tab = "admins" | "audit";

export function AdminsView() {
  return (
    <RequireTenant>
      {(tenantId) => <AdminsPage tenantId={tenantId} />}
    </RequireTenant>
  );
}

function AdminsPage({ tenantId }: { tenantId: string }) {
  const [tab, setTab] = useState<Tab>("admins");

  return (
    <PageShell
      title="Admins por WhatsApp"
      subtitle="Números autorizados a conversar con el bot como administradores del negocio."
    >
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--hair)",
          marginBottom: 16,
        }}
      >
        <TabButton
          active={tab === "admins"}
          icon={<Users size={13} />}
          onClick={() => setTab("admins")}
        >
          Admins
        </TabButton>
        <TabButton
          active={tab === "audit"}
          icon={<History size={13} />}
          onClick={() => setTab("audit")}
        >
          Audit log
        </TabButton>
      </div>

      {tab === "admins" ? (
        <AdminsTableView tenantId={tenantId} />
      ) : (
        <AdminAuditView tenantId={tenantId} />
      )}
    </PageShell>
  );
}

function TabButton({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        border: "none",
        borderBottom: active
          ? "2px solid var(--aurora)"
          : "2px solid transparent",
        background: "transparent",
        color: active ? "var(--text-0)" : "var(--text-2)",
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        marginBottom: -1,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
