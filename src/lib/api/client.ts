/**
 * Fetch client tipado para el backend Admin Panel API.
 *
 * - Todas las respuestas siguen el envelope { ok, ... } / { ok:false, error, code? }.
 * - Inyecta Authorization: Bearer <token> leyendo el Zustand store de auth.
 * - En 401 limpia sesión y redirige a /login (salvo en las páginas de auth).
 */

import type { ApiErrorCode, ApiErrorEnvelope } from "./contract";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3000";

export class ApiError extends Error {
  status: number;
  code?: ApiErrorCode;
  payload: ApiErrorEnvelope;

  constructor(status: number, payload: ApiErrorEnvelope) {
    super(payload.error || `API ${status}`);
    this.status = status;
    this.code = payload.code;
    this.payload = payload;
  }

  is(code: ApiErrorCode): boolean {
    return this.code === code;
  }
}

// Storage keys
const TOKEN_KEY = "zero.token";
const USER_KEY = "zero.user";
const PERMS_KEY = "zero.permissions";
const TENANT_KEY = "zero.activeTenant";

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(PERMS_KEY);
  window.localStorage.removeItem(TENANT_KEY);
}

export const sessionStorage = {
  keys: { TOKEN: TOKEN_KEY, USER: USER_KEY, PERMS: PERMS_KEY, TENANT: TENANT_KEY },
  readToken,
  clearSession,
};

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Si true, no envía Authorization aunque haya token. */
  skipAuth?: boolean;
  /** Si true, no redirige en 401. */
  silentAuth?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiFetch<T extends object = Record<string, unknown>>(
  path: string,
  opts: ApiFetchOptions = {}
): Promise<T> {
  const url = new URL(path, BASE_URL);

  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers = new Headers(opts.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (opts.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!opts.skipAuth) {
    const token = readToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url.toString(), {
    ...opts,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  // Intentar parsear JSON; si falla, envolver como error genérico.
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = null;
    }
  }

  if (!res.ok || (json && json.ok === false)) {
    const payload: ApiErrorEnvelope = json && json.ok === false
      ? (json as unknown as ApiErrorEnvelope)
      : { ok: false, error: json?.error as string ?? res.statusText ?? `HTTP ${res.status}` };

    if (res.status === 401 && !opts.silentAuth && typeof window !== "undefined") {
      clearSession();
      const onAuthPage = window.location.pathname.startsWith("/login")
        || window.location.pathname.startsWith("/register");
      if (!onAuthPage) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/login?next=${next}`);
      }
    }

    // 403 + code=email_not_verified: el backend bloquea todo el admin para
    // usuarios con mail sin confirmar. Limpiamos sesión y mandamos al login
    // con el flag "pending" para que vea el banner y pueda reenviar el mail.
    if (
      res.status === 403 &&
      payload.code === "email_not_verified" &&
      !opts.silentAuth &&
      typeof window !== "undefined"
    ) {
      clearSession();
      const onAuthPage = window.location.pathname.startsWith("/login")
        || window.location.pathname.startsWith("/register");
      if (!onAuthPage) {
        window.location.assign("/login?verified=pending");
      }
    }

    throw new ApiError(res.status, payload);
  }

  // Backend envuelve respuestas con ok:true en { ok, data: {...} }
  // (hook preSerialization en admin.ts). Desenvolvemos acá para que los
  // callers vean los campos al tope como indican los tipos (LoginResponse, etc.).
  if (json && json.ok === true && "data" in json && json.data && typeof json.data === "object") {
    return json.data as T;
  }
  return (json ?? {}) as T;
}

export const api = {
  get: <T extends object>(path: string, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "GET" }),
  post: <T extends object>(path: string, body?: unknown, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "POST", body }),
  patch: <T extends object>(path: string, body?: unknown, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "PATCH", body }),
  put: <T extends object>(path: string, body?: unknown, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "PUT", body }),
  delete: <T extends object>(path: string, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "DELETE" }),
};
