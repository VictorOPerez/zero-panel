import { Sidebar } from "@/components/sidebar";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { QueryProvider } from "@/providers/query-provider";
import { MobileMenuButton } from "@/components/mobile-menu-button";
import { PaymentBanner } from "@/components/payment-banner";
import { AuthGate } from "@/components/auth/auth-gate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <AuthGate>
        <div
          style={{
            display: "flex",
            height: "100vh",
            width: "100vw",
            overflow: "hidden",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Desktop sidebar */}
          <div className="hidden md:flex h-full">
            <Sidebar />
          </div>

          {/* Mobile drawer */}
          <MobileSidebar />

          {/* Main content */}
          <main
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minWidth: 0,
            }}
          >
            {/* Mobile header */}
            <div
              className="flex md:hidden items-center gap-3 px-4 py-3 border-b"
              style={{ borderColor: "var(--hair)", background: "rgba(0,0,0,0.2)" }}
            >
              <MobileMenuButton />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    background: "var(--aurora)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontWeight: 700,
                    fontSize: 11,
                    color: "#0a0a0f",
                  }}
                >
                  0
                </div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Zero</span>
              </div>
            </div>

            <PaymentBanner />
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {children}
            </div>
          </main>
        </div>
      </AuthGate>
    </QueryProvider>
  );
}
