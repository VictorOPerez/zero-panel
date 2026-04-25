"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log a la consola del browser para debug en prod (la pagina default
    // de Next solo dice "This page couldn't load" sin más detalle).
    // eslint-disable-next-line no-console
    console.error("[dashboard error boundary]", error);
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div
      role="alert"
      style={{
        padding: 24,
        margin: "16px auto",
        maxWidth: 720,
        borderRadius: 12,
        border: "1px solid oklch(0.68 0.21 25 / 0.4)",
        background: "oklch(0.68 0.21 25 / 0.08)",
        color: "var(--text-0)",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
        Algo se rompió cargando esta sección
      </h2>
      <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-2)" }}>
        {error.message || "Error desconocido"}
        {error.digest && (
          <span style={{ marginLeft: 8, fontFamily: "var(--font-jetbrains-mono)", opacity: 0.6 }}>
            · digest {error.digest}
          </span>
        )}
      </p>

      {isDev && error.stack && (
        <pre
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 8,
            background: "rgba(0,0,0,0.4)",
            color: "var(--text-1)",
            fontSize: 11,
            fontFamily: "var(--font-jetbrains-mono)",
            overflow: "auto",
            maxHeight: 240,
            whiteSpace: "pre-wrap",
          }}
        >
          {error.stack}
        </pre>
      )}

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "7px 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--aurora)",
            color: "#0a0a0f",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") window.location.reload();
          }}
          style={{
            padding: "7px 14px",
            borderRadius: 6,
            border: "1px solid var(--hair-strong)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--text-1)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Recargar página
        </button>
      </div>
    </div>
  );
}
