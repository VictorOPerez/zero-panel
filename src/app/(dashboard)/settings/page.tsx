export const metadata = { title: "Configuración — Zero" };

export default function SettingsPage() {
  return (
    <div style={{ padding: "24px 28px" }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>Configuración</h1>
      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
        Ajustes generales del tenant
      </div>
      <div
        className="glass"
        style={{ marginTop: 24, padding: "20px 24px", borderRadius: 10, maxWidth: 480 }}
      >
        <div style={{ fontSize: 13, color: "var(--text-3)", fontFamily: "var(--font-jetbrains-mono)" }}>
          Próximamente — esta sección está en construcción.
        </div>
      </div>
    </div>
  );
}
