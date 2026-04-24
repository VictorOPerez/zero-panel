import { api } from "./client";
import type {
  AuthUser,
  LoginResponse,
  MeResponse,
  SignupResponse,
} from "./contract";

export function login(body: { email: string; password: string }): Promise<LoginResponse> {
  return api.post<LoginResponse>("/api/auth/login", body, { skipAuth: true });
}

export function signup(body: {
  business_name: string;
  email: string;
  password: string;
  timezone?: string;
  locale?: string;
}): Promise<SignupResponse> {
  return api.post<SignupResponse>("/api/auth/signup", body, { skipAuth: true });
}

export function requestEmailVerification(email: string): Promise<{ ok: true; message: string }> {
  return api.post<{ ok: true; message: string }>("/api/auth/verify-email/request", { email }, { skipAuth: true });
}

export function confirmEmailVerification(token: string): Promise<{ ok: true; user_id: string; verified: true }> {
  return api.get<{ ok: true; user_id: string; verified: true }>(
    `/api/auth/verify-email/confirm`,
    { query: { token }, skipAuth: true }
  );
}

export function emailVerificationStatus(): Promise<{ ok: true; verified: boolean }> {
  return api.get<{ ok: true; verified: boolean }>("/api/auth/verify-email/status");
}

export function me(): Promise<MeResponse> {
  return api.get<MeResponse>("/api/auth/me");
}

export function bootstrapFirstAdmin(body: {
  email: string;
  password: string;
}): Promise<{ ok: true; user: AuthUser; token: string; expires_in: number }> {
  return api.post("/api/auth/bootstrap", body, { skipAuth: true });
}
