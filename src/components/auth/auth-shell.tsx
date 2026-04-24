import type { ReactNode } from "react";
import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: wide ? 520 : 420,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          alignSelf: "center",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--aurora)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-jetbrains-mono)",
            fontWeight: 700,
            fontSize: 16,
            color: "#0a0a0f",
            boxShadow: "0 0 20px oklch(0.62 0.22 295 / 0.45)",
          }}
        >
          0
        </div>
        <div
          style={{
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: -0.3,
            color: "var(--text-0)",
          }}
        >
          Zero
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-3)",
            fontFamily: "var(--font-jetbrains-mono)",
            paddingTop: 4,
          }}
        >
          by Navapex
        </div>
      </Link>

      {/* Card */}
      <div
        className="glass-strong"
        style={{
          borderRadius: 14,
          padding: "28px 28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: -0.3,
              color: "var(--text-0)",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
              {subtitle}
            </div>
          )}
        </div>
        {children}
      </div>

      {footer && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "var(--text-2)",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

export const authInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--hair-strong)",
  background: "rgba(0,0,0,0.25)",
  color: "var(--text-0)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 120ms, background 120ms",
};

export const authLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "var(--text-2)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
  display: "block",
};

export const authPrimaryButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "11px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--aurora)",
  color: "#0a0a0f",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 120ms",
};

export const authSecondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 16px",
  borderRadius: 8,
  border: "1px solid var(--hair-strong)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-1)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

export const authErrorBoxStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.1)",
  color: "var(--z-red)",
  fontSize: 12.5,
  lineHeight: 1.45,
};

export const authInfoBoxStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid oklch(0.80 0.13 200 / 0.35)",
  background: "oklch(0.80 0.13 200 / 0.08)",
  color: "var(--text-1)",
  fontSize: 12.5,
  lineHeight: 1.45,
};
