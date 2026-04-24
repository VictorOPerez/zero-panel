import type { BillingPlan } from "@/lib/api/contract";

/**
 * Plan por defecto mostrado como ficha informativa cuando el backend todavía
 * no expone planes vía /api/billing/plans (ej. STRIPE_PRICE_BASICO sin setear).
 *
 * El botón "Elegir plan" queda deshabilitado con nota "Próximamente" hasta
 * que el backend devuelva un `price_id` real. Esto mantiene la UI llena y
 * persuasiva durante la ventana entre el deploy del panel y la configuración
 * de Stripe en Railway.
 */
export const DEFAULT_PLAN: Required<
  Pick<BillingPlan, "id" | "name" | "price_id" | "monthly_price_usd" | "token_limit">
> & { description: string; features: string[] } = {
  id: "basico",
  name: "Básico",
  price_id: "",
  monthly_price_usd: 59,
  token_limit: 3_000_000,
  description: "Automatizá tu atención 24/7 y multiplicá las reservas.",
  features: [
    "Bot IA 24/7 que reserva turnos solo en tu Google Calendar",
    "Intervención humana directa: respondé desde tu WhatsApp y el bot se auto-pausa",
    "Bilingüe automático (ES / EN) — detecta el idioma del cliente",
    "Panel completo: inbox, reservas, solicitudes, persona del bot",
    "Catálogo de servicios propio (el bot sabe qué ofrecés y cuánto dura)",
    "Alertas al instante cuando el bot necesita que intervengas",
    "Soporte por email con respuesta el mismo día hábil",
    "Sin permanencia — cancelás cuando quieras",
  ],
};

/**
 * Une las features reales del backend con las default. Si el backend trae
 * features propias las usa en lugar; si no, fallback a las hardcodeadas —
 * así la card del plan nunca se ve vacía.
 */
export function resolvePlanDisplay(plan: BillingPlan | undefined) {
  const source = plan ?? DEFAULT_PLAN;
  const features =
    plan?.features && plan.features.length > 0
      ? plan.features
      : DEFAULT_PLAN.features;
  return {
    id: source.id,
    name: source.name ?? DEFAULT_PLAN.name,
    price_id: source.price_id ?? "",
    monthly_price_usd: plan?.monthly_price_usd ?? DEFAULT_PLAN.monthly_price_usd,
    token_limit: plan?.token_limit ?? DEFAULT_PLAN.token_limit,
    description: plan?.description ?? DEFAULT_PLAN.description,
    features,
    canCheckout: !!plan?.price_id,
  };
}
