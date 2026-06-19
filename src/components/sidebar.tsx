"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, Fragment } from "react";
import {
  Inbox,
  Home,
  LogOut,
  CreditCard,
  Settings,
  BookOpen,
  Users,
  CalendarClock,
  CalendarDays,
  Package,
  ShoppingBag,
  Briefcase,
  FileText,
  ShieldUser,
  Phone,
  Lock,
  Image as ImageIcon,
  LayoutGrid,
} from "lucide-react";
import { IconDot } from "@/components/icons";
import { SidebarUsage } from "@/components/sidebar-usage";
import { useAuthStore } from "@/store/auth";
import { useStripeMode } from "@/lib/hooks/use-stripe-mode";
import { usePlanEntitlements } from "@/lib/hooks/use-plan-entitlements";
import type { GatedFeature } from "@/lib/billing/entitlements";

const ESSENTIAL_NAV_ITEMS = [
  { key: "inbox", label: "Inbox", href: "/inbox", icon: Inbox },
  { key: "brief", label: "Brief", href: "/brief", icon: FileText },
  { key: "admins", label: "Admins WA", href: "/admins", icon: ShieldUser },
  { key: "integrations", label: "Conexiones", href: "/integrations", icon: Home },
  { key: "numbers", label: "Números", href: "/numbers", icon: Phone },
  { key: "billing", label: "Suscripción", href: "/billing", icon: CreditCard },
] as const;

const TOOL_MENU_SECTIONS = [
  {
    label: "Operacional",
    items: [
      { key: "calendar", label: "Calendario", href: "/calendar", icon: CalendarDays },
      { key: "knowledge", label: "Conocimiento", href: "/knowledge", icon: BookOpen },
      { key: "services", label: "Servicios", href: "/services", icon: Briefcase },
      { key: "gallery", label: "Galería", href: "/gallery", icon: ImageIcon },
      { key: "crm", label: "Contactos", href: "/crm", icon: Users, feature: "crm" as GatedFeature },
      { key: "followups", label: "Followups", href: "/followups", icon: CalendarClock, feature: "followups" as GatedFeature },
      { key: "products", label: "Productos", href: "/products", icon: Package, feature: "products" as GatedFeature },
      { key: "orders", label: "Pedidos", href: "/orders", icon: ShoppingBag, feature: "orders" as GatedFeature },
    ],
  },
  {
    label: "Sistema",
    items: [
      { key: "settings", label: "Configuración", href: "/settings", icon: Settings },
    ],
  },
] as const;

// Lo único que ve el CLIENTE (no super_admin). Todo lo demás es solo del panel
// de administrador. Suscripción se deja para que el cliente pueda pagar/gestionar
// su plan; el resto (brief, conexiones, números, herramientas) es del admin.
const CLIENT_NAV_ITEMS = [
  { key: "inbox", label: "Inbox", href: "/inbox", icon: Inbox },
  { key: "calendar", label: "Calendario", href: "/calendar", icon: CalendarDays },
  { key: "billing", label: "Suscripción", href: "/billing", icon: CreditCard },
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

  // Mini-badge global cuando STRIPE_MODE=test en el backend. Aparece al lado
  // del logo "Zero" para que el operador NUNCA confunda en qué modo está,
  // independientemente de la página en la que esté navegando.
  const { isTest: stripeTestMode } = useStripeMode();
  const { isLocked } = usePlanEntitlements();

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

  // Gate maestro de la navegación: solo el super_admin (vos) ve el panel
  // completo; el cliente ve únicamente su menú reducido. Mientras hidrata,
  // user es null → cae en la vista de cliente (default seguro, no filtra el
  // panel admin por un instante).
  const isSuper = user?.role === "super_admin";

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
        {stripeTestMode && (
          <div
            title="STRIPE_MODE=test en el backend — Stripe está en sandbox"
            style={{
              fontSize: 9,
              fontFamily: "var(--font-jetbrains-mono)",
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "2px 5px",
              borderRadius: 4,
              background: "oklch(0.85 0.18 90 / 0.18)",
              color: "oklch(0.85 0.18 90)",
              border: "1px solid oklch(0.85 0.18 90 / 0.4)",
            }}
          >
            TEST
          </div>
        )}
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

      <nav
        style={{ display: "flex", flexDirection: "column", gap: 1, overflowY: "auto", minHeight: 0 }}
        aria-label="Navegación principal"
      >
        {isSuper ? (
          // ── Vista ADMIN (super_admin): TODO visible inline. Las herramientas
          //    salieron de la subventana y ahora se ven directo acá. ───────────
          <>
            <SectionLabel text="Esenciales" first />
            {ESSENTIAL_NAV_ITEMS.map((n) => (
              <NavLinkItem key={n.key} item={n} active={isActive(n.href)} />
            ))}

            {TOOL_MENU_SECTIONS.map((section) => (
              <Fragment key={section.label}>
                <SectionLabel text={section.label} />
                {section.items.map((item) => (
                  <NavLinkItem
                    key={item.key}
                    item={item}
                    active={isActive(item.href)}
                    locked={"feature" in item ? isLocked(item.feature) : false}
                  />
                ))}
              </Fragment>
            ))}

            <SectionLabel text="Plataforma" />
            <NavLinkItem
              item={{
                key: "platform",
                label: "Centro de Control",
                href: "/platform",
                icon: LayoutGrid,
              }}
              active={isActive("/platform")}
            />
          </>
        ) : (
          // ── Vista CLIENTE: solo Inbox + Calendario + Suscripción. ───────────
          <>
            <SectionLabel text="Menú" first />
            {CLIENT_NAV_ITEMS.map((n) => (
              <NavLinkItem key={n.key} item={n} active={isActive(n.href)} />
            ))}
          </>
        )}
      </nav>

      <div style={{ flex: 1, minHeight: 8 }} />

      <SidebarUsage tenantId={activeTenantId} />

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

function SectionLabel({ text, first = false }: { text: string; first?: boolean }) {
  return (
    <div
      style={{
        padding: first ? "0 4px 6px" : "14px 4px 6px",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--text-3)",
        fontWeight: 600,
      }}
    >
      {text}
    </div>
  );
}

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: typeof Inbox;
  feature?: GatedFeature;
};

function NavLinkItem({
  item,
  active,
  compact = false,
  locked = false,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
  locked?: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  // Locked → no navega a la feature: lleva a /billing (upsell). El bloqueo real
  // del bot lo hace el backend; esto es el candado visual.
  const href = locked ? "/billing" : item.href;
  return (
    <Link
      href={href}
      onClick={onClick}
      title={locked ? "Disponible en el plan Pro — tocá para mejorar tu plan" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: compact ? "7px 8px" : "7px 8px",
        borderRadius: 6,
        background: active
          ? "linear-gradient(90deg, oklch(0.62 0.22 295 / 0.16), transparent)"
          : "transparent",
        color: locked ? "var(--text-3)" : active ? "var(--text-0)" : "var(--text-1)",
        textDecoration: "none",
        fontSize: compact ? 12.5 : 13,
        fontWeight: active ? 500 : 400,
        position: "relative",
        flexShrink: 0,
        opacity: locked ? 0.85 : 1,
      }}
      aria-current={active ? "page" : undefined}
    >
      {active && !locked && (
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
        style={{
          color: locked ? "var(--text-3)" : active ? "var(--z-cyan)" : "var(--text-2)",
          flexShrink: 0,
        }}
      />
      <span className="truncate">{item.label}</span>
      {locked && (
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 9,
            fontFamily: "var(--font-jetbrains-mono)",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "var(--z-amber)",
            background: "oklch(0.80 0.14 75 / 0.12)",
            border: "1px solid oklch(0.80 0.14 75 / 0.3)",
            padding: "1px 5px",
            borderRadius: 4,
          }}
        >
          <Lock size={9} />
          PRO
        </span>
      )}
    </Link>
  );
}
