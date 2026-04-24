"use client";
import { Menu } from "lucide-react";
import { useUIStore } from "@/store/ui";

export function MobileMenuButton() {
  const { toggleMobileDrawer } = useUIStore();
  return (
    <button
      onClick={toggleMobileDrawer}
      aria-label="Abrir menú"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 6,
        border: "none",
        background: "transparent",
        color: "var(--text-1)",
        cursor: "pointer",
      }}
    >
      <Menu size={18} />
    </button>
  );
}
