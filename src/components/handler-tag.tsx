import { IconSparkle } from "@/components/icons";
import type { ConversationStatus } from "@/lib/api/types";

const STATUS_MAP: Record<
  ConversationStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  ia_atendiendo: {
    label: "Zero",
    color: "var(--z-cyan)",
    bg: "oklch(0.62 0.22 295 / 0.15)",
    border: "oklch(0.62 0.22 295 / 0.3)",
  },
  esperando_humano: {
    label: "Esperando",
    color: "var(--z-amber)",
    bg: "oklch(0.80 0.14 75 / 0.08)",
    border: "oklch(0.80 0.14 75 / 0.25)",
  },
  humano_atendiendo: {
    label: "Humano",
    color: "var(--z-amber)",
    bg: "oklch(0.80 0.14 75 / 0.15)",
    border: "oklch(0.80 0.14 75 / 0.3)",
  },
  resuelta: {
    label: "Resuelta",
    color: "var(--z-green)",
    bg: "oklch(0.78 0.15 155 / 0.12)",
    border: "oklch(0.78 0.15 155 / 0.25)",
  },
  pausada: {
    label: "Pausada",
    color: "var(--text-3)",
    bg: "rgba(255,255,255,0.04)",
    border: "var(--hair)",
  },
};

export function HandlerTag({ status }: { status: ConversationStatus }) {
  const t = STATUS_MAP[status];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 500,
        padding: "1px 6px",
        borderRadius: 3,
        color: t.color,
        background: t.bg,
        border: `1px solid ${t.border}`,
        fontFamily: "var(--font-jetbrains-mono)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {status === "ia_atendiendo" && <IconSparkle size={8} />}
      {t.label}
    </span>
  );
}
