/**
 * Candado de features por plan (lado UI). DEBE quedar en sync con el backend
 * (`src/core/booking/entitlements.ts`): Esencial = agenda + responder; Pro y
 * Escala = todo. Plan desconocido / vacío / legacy → SIN candado (acceso
 * completo), igual que el backend, para no bloquear a tenants existentes.
 *
 * Esto es SOLO visual/upsell. El bloqueo real (que el bot no use la feature)
 * lo hace el backend filtrando los dominios del SDK.
 */

export type GatedFeature = "crm" | "followups" | "products" | "orders";

/** Plan mínimo que incluye cada feature. */
const FEATURE_MIN_PLAN: Record<GatedFeature, "esencial" | "pro"> = {
  crm: "pro",
  followups: "pro",
  products: "pro",
  orders: "pro",
};

const PLAN_RANK: Record<string, number> = { esencial: 1, pro: 2, escala: 3 };

/**
 * ¿La feature está bloqueada para el plan actual?
 * - Sin plan / desconocido / legacy → false (acceso completo, igual que backend).
 * - Plan conocido con rango menor al mínimo de la feature → true.
 */
export function isFeatureLocked(
  plan: string | undefined | null,
  feature: GatedFeature
): boolean {
  const min = FEATURE_MIN_PLAN[feature];
  if (!min) return false;
  const rank = PLAN_RANK[String(plan ?? "").trim().toLowerCase()];
  if (!rank) return false; // plan no reconocido → no bloquear
  return rank < PLAN_RANK[min];
}

/** Nombre lindo del plan mínimo (para el copy "Disponible en Pro"). */
export function minPlanLabel(feature: GatedFeature): string {
  const min = FEATURE_MIN_PLAN[feature];
  return min.charAt(0).toUpperCase() + min.slice(1);
}
