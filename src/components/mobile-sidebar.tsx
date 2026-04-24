"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useUIStore } from "@/store/ui";
import { Sidebar } from "@/components/sidebar";

export function MobileSidebar() {
  const { mobileDrawerOpen, setMobileDrawerOpen } = useUIStore();

  return (
    <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
      <SheetContent
        side="left"
        className="p-0 w-64"
        style={{ background: "var(--bg-0)", border: "none" }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Menú de navegación</SheetTitle>
        </SheetHeader>
        <div className="h-full">
          <Sidebar />
        </div>
      </SheetContent>
    </Sheet>
  );
}
