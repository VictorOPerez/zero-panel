"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#0a0a0f",
          color: "#e9edef",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          display: "grid",
          placeItems: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: "100%",
            padding: 24,
            borderRadius: 12,
            border: "1px solid rgba(255,107,107,0.4)",
            background: "rgba(255,107,107,0.08)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            La aplicación se cayó
          </h2>
          <p style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
            {error.message || "Error desconocido"}
            {error.digest && (
              <span style={{ marginLeft: 8, opacity: 0.6 }}>· {error.digest}</span>
            )}
          </p>
          {process.env.NODE_ENV !== "production" && error.stack && (
            <pre
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 8,
                background: "rgba(0,0,0,0.4)",
                fontSize: 11,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                overflow: "auto",
                maxHeight: 220,
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
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                background: "#00a884",
                color: "#0a0a0f",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "#e9edef",
                cursor: "pointer",
              }}
            >
              Recargar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
