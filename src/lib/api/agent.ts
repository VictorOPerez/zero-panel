/**
 * Agent config API stubs.
 * PAUSE before adding endpoints not listed here.
 */

import type { AgentConfig } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// GET /agent/config
export async function getAgentConfig(): Promise<AgentConfig> {
  return apiFetch<AgentConfig>("/agent/config");
}

// PUT /agent/config — save draft
export async function saveAgentConfig(config: Partial<AgentConfig>): Promise<AgentConfig> {
  return apiFetch<AgentConfig>("/agent/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

// POST /agent/publish — publish draft as new version
export async function publishAgentConfig(): Promise<{ version: number }> {
  return apiFetch<{ version: number }>("/agent/publish", { method: "POST" });
}

// POST /agent/playground — test message against draft config
export async function playgroundMessage(text: string): Promise<{
  reply: string;
  toolsUsed: Array<{ name: string; durationMs: number }>;
  escalated: boolean;
  escalationRule?: string;
}> {
  return apiFetch("/agent/playground", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
