"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import { PageShell } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import { WhatsappBusinessCard } from "@/components/channels/whatsapp-business-card";

export function IntegrationsView() {
  return (
    <RequireTenant>
      {(tenantId) => (
        <PageShell
          title="Conexiones"
          subtitle="Conectá WhatsApp Business y Google Calendar para que el bot opere."
        >
          <div
            className="grid-integrations"
            style={{ marginBottom: 18 }}
            role="list"
            aria-label="Canales"
          >
            <WhatsappBusinessCard tenantId={tenantId} />
          </div>

          <div
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Herramientas
          </div>
          <div className="grid-integrations">
            <Link
              href="/calendar"
              className="glass"
              style={{
                padding: 16,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
                textDecoration: "none",
                color: "var(--text-0)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--hair)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-2)",
                }}
              >
                <Calendar size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Google Calendar</div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Agendamiento
                </div>
              </div>
            </Link>
          </div>
        </PageShell>
      )}
    </RequireTenant>
  );
}
