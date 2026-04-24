"use client";

import { create } from "zustand";
import type { AuthUser, Permission } from "@/lib/api/contract";
import { sessionStorage as zeroSession } from "@/lib/api/client";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  permissions: Permission[];
  activeTenantId: string | null;
  hydrated: boolean;

  hydrate: () => void;
  setSession: (args: { token: string; user: AuthUser; permissions?: Permission[] }) => void;
  setPermissions: (perms: Permission[]) => void;
  setActiveTenant: (id: string | null) => void;
  logout: () => void;
  hasPermission: (p: Permission) => boolean;
}

function safeReadJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  permissions: [],
  activeTenantId: null,
  hydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem(zeroSession.keys.TOKEN);
    const user = safeReadJSON<AuthUser>(zeroSession.keys.USER);
    const permissions = safeReadJSON<Permission[]>(zeroSession.keys.PERMS) ?? [];
    const activeTenantId = window.localStorage.getItem(zeroSession.keys.TENANT);
    set({ token, user, permissions, activeTenantId, hydrated: true });
  },

  setSession: ({ token, user, permissions }) => {
    // Descartamos el tenant activo si no pertenece al nuevo user — evita que
    // una sesión previa deje cacheado un tenant_id ajeno y todas las calls
    // admin vuelvan 403.
    const currentActive = get().activeTenantId;
    const userTenants = user.tenant_ids ?? [];
    const nextActive =
      currentActive && userTenants.includes(currentActive)
        ? currentActive
        : userTenants.length === 1
          ? userTenants[0]
          : null;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(zeroSession.keys.TOKEN, token);
      window.localStorage.setItem(zeroSession.keys.USER, JSON.stringify(user));
      if (permissions) {
        window.localStorage.setItem(zeroSession.keys.PERMS, JSON.stringify(permissions));
      }
      if (nextActive) {
        window.localStorage.setItem(zeroSession.keys.TENANT, nextActive);
      } else {
        window.localStorage.removeItem(zeroSession.keys.TENANT);
      }
    }
    set((s) => ({
      token,
      user,
      permissions: permissions ?? s.permissions,
      activeTenantId: nextActive,
    }));
  },

  setPermissions: (perms) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(zeroSession.keys.PERMS, JSON.stringify(perms));
    }
    set({ permissions: perms });
  },

  setActiveTenant: (id) => {
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(zeroSession.keys.TENANT, id);
      else window.localStorage.removeItem(zeroSession.keys.TENANT);
    }
    set({ activeTenantId: id });
  },

  logout: () => {
    zeroSession.clearSession();
    set({ token: null, user: null, permissions: [], activeTenantId: null });
  },

  hasPermission: (p) => {
    const { user, permissions } = get();
    if (!user) return false;
    if (user.role === "super_admin") return true;
    return permissions.includes(p);
  },
}));
