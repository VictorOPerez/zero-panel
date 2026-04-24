import type { ReactNode } from "react";

export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page-shell">
      <div className="page-shell-head">
        <div style={{ minWidth: 0 }}>
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
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        {actions && <div className="page-shell-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export const cardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 10,
};
