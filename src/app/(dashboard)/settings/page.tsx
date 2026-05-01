import Link from "next/link";
import { ExternalLink, FileText, Shield } from "lucide-react";

export const metadata = { title: "Configuración — Zero" };

export default function SettingsPage() {
  return (
    <div style={{ padding: "24px 28px", maxWidth: 720 }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>
        Configuración
      </h1>
      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
        Ajustes generales y enlaces legales
      </div>

      <section style={{ marginTop: 24 }}>
        <SectionLabel>Legal</SectionLabel>
        <div
          className="glass"
          style={{
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid var(--hair)",
          }}
        >
          <LegalRow
            href="/privacy"
            icon={<Shield size={15} />}
            title="Política de Privacidad"
            subtitle="Cómo recopilamos, usamos y protegemos los datos del negocio y de los usuarios finales."
          />
          <div style={{ borderTop: "1px solid var(--hair)" }} />
          <LegalRow
            href="/terms"
            icon={<FileText size={15} />}
            title="Términos del Servicio"
            subtitle="Las condiciones que regulan el uso de Zero, pagos y políticas de WhatsApp."
          />
        </div>
        <p
          style={{
            fontSize: 11.5,
            color: "var(--text-3)",
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          Estos enlaces se entregan a Meta como parte del proceso de App Review
          y son los que ven los clientes que pasan por el flujo de Embedded
          Signup.
        </p>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

function LegalRow({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        textDecoration: "none",
        color: "var(--text-0)",
        background: "transparent",
        transition: "background 0.15s",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--hair)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-2)",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      <ExternalLink size={13} style={{ color: "var(--text-3)" }} />
    </Link>
  );
}
