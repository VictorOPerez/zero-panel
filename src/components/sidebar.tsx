"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Inbox,
  Home,
  LogOut,
  CreditCard,
  Settings,
  Sparkles,
  BookOpen,
  Wallet,
  Users,
  CalendarClock,
} from "lucide-react";
import { IconDot } from "@/components/icons";
import { useAuthStore } from "@/store/auth";

const NAV_ITEMS = [
  { key: "integrations", label: "Inicio", href: "/integrations", icon: Home },
  { key: "inbox", label: "Inbox", href: "/inbox", icon: Inbox, badge: 14 },
  { key: "bot", label: "Bot", href: "/bot", icon: Sparkles },
  { key: "knowledge", label: "Conocimiento", href: "/knowledge", icon: BookOpen },
  { key: "crm", label: "Contactos", href: "/crm", icon: Users },
  { key: "followups", label: "Followups", href: "/followups", icon: CalendarClock },
  { key: "payments", label: "Cobros", href: "/payments", icon: Wallet },
  { key: "billing", label: "Suscripción", href: "/billing", icon: CreditCard },
  { key: "settings", label: "Configuración", href: "/settings", icon: Settings },
] as const;

const CHANNELS = [
  { key: "wa", label: "WhatsApp", color: "#25D366", active: true, count: 0 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);
  const activeTenantId = useAuthStore((s) => s.activeTenantId);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const isActive = (href: string) => {
    if (href === "/integrations")
      return pathname === "/" || pathname.startsWith("/integrations");
    return pathname.startsWith(href);
  };

  const initials = (() => {
    if (!user?.email) return "Z";
    const [local] = user.email.split("@");
    return local.slice(0, 2).toUpperCase();
  })();

  const roleLabel =
    user?.role === "super_admin"
      ? "Super admin"
      : user?.role === "tenant_admin"
      ? "Admin"
      : user?.role === "tenant_user"
      ? "Miembro"
      : "—";

  return (
    <aside
      style={{
        width: 240,
        height: "100%",
        flexShrink: 0,
        borderRight: "1px solid var(--hair)",
        background: "rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        padding: "14px 12px 12px",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 4px" }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "var(--aurora)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-jetbrains-mono)",
            fontWeight: 700,
            fontSize: 12,
            color: "#0a0a0f",
            boxShadow: "0 0 12px oklch(0.62 0.22 295 / 0.4)",
          }}
        >
          0
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: -0.2 }}>Zero</div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-3)",
            fontFamily: "var(--font-jetbrains-mono)",
            marginLeft: "auto",
          }}
        >
          v2.4
        </div>
      </div>

      <div style={{ height: 18 }} />

      {/* Channel tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 4px 6px",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--text-3)",
          fontWeight: 600,
        }}
      >
        <span>Canales</span>
        <span style={{ fontFamily: "var(--font-jetbrains-mono)", textTransform: "none", letterSpacing: 0 }}>
          {CHANNELS.filter((c) => c.active).length}/{CHANNELS.length}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: 3,
          background: "rgba(0,0,0,0.25)",
          borderRadius: 8,
          border: "1px solid var(--hair)",
        }}
      >
        {CHANNELS.map((ch) => (
          <button
            key={ch.key}
            title={ch.label}
            onClick={() => router.push("/integrations")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "5px 4px",
              borderRadius: 6,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <IconDot size={10} color={ch.active ? ch.color : "var(--text-3)"} />
          </button>
        ))}
      </div>

      <div style={{ height: 20 }} />

      {/* Nav label */}
      <div
        style={{
          padding: "0 4px 6px",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--text-3)",
          fontWeight: 600,
        }}
      >
        Navegación
      </div>

      {/* Nav items */}
      <nav
        style={{ display: "flex", flexDirection: "column", gap: 1, overflowY: "auto", minHeight: 0 }}
        aria-label="Navegación principal"
      >
        {NAV_ITEMS.map((n) => {
          const Icon = n.icon;
          const on = isActive(n.href);
          return (
            <Link
              key={n.key}
              href={n.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 8px",
                borderRadius: 6,
                background: on
                  ? "linear-gradient(90deg, oklch(0.62 0.22 295 / 0.16), transparent)"
                  : "transparent",
                color: on ? "var(--text-0)" : "var(--text-1)",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: on ? 500 : 400,
                position: "relative",
                flexShrink: 0,
              }}
              aria-current={on ? "page" : undefined}
            >
              {on && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 2,
                    borderRadius: 2,
                    background: "var(--aurora)",
                  }}
                />
              )}
              <Icon
                size={15}
                style={{ color: on ? "var(--z-cyan)" : "var(--text-2)", flexShrink: 0 }}
              />
              <span className="truncate">{n.label}</span>
              {"badge" in n && n.badge && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontWeight: 600,
                    color: on ? "#0a0a0f" : "var(--text-0)",
                    background: on ? "var(--aurora)" : "rgba(255,255,255,0.08)",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  {n.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ flex: 1, minHeight: 8 }} />

      {/* User */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 6px",
          borderTop: "1px solid var(--hair)",
          marginTop: 8,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "linear-gradient(135deg, oklch(0.5 0.15 330), oklch(0.45 0.18 280))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 600,
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.3, minWidth: 0, flex: 1 }}>
          <div
            style={{
              color: "var(--text-0)",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.email ?? "—"}
          </div>
          <div
            style={{
              color: "var(--text-3)",
              fontSize: 11,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeTenantId ? `${roleLabel} · ${activeTenantId}` : roleLabel}
          </div>
        </div>
        <button
          type="button"
          aria-label="Cerrar sesión"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--text-3)",
            cursor: "pointer",
            padding: 4,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
          }}
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}
