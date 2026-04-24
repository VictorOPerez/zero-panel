import type { IntegrationStatus } from "@/lib/api/types";

const MAP: Record<
  IntegrationStatus,
  { label: string; color: string; bg: string }
> = {
  connected: { label: "conectado", color: "var(--z-green)", bg: "oklch(0.78 0.15 155 / 0.12)" },
  disconnected: { label: "sin conectar", color: "var(--text-3)", bg: "rgba(255,255,255,0.04)" },
  embed: { label: "listo", color: "var(--z-cyan)", bg: "oklch(0.80 0.13 200 / 0.12)" },
  error: { label: "error", color: "var(--z-red)", bg: "oklch(0.68 0.21 25 / 0.12)" },
};

export function StatusPill({ status }: { status: IntegrationStatus }) {
  const s = MAP[status];
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 10,
        color: s.color,
        background: s.bg,
        fontFamily: "var(--font-jetbrains-mono)",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      ● {s.label}
    </span>
  );
}
