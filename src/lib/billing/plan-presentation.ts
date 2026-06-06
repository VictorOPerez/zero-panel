import type { BillingPlan } from "@/lib/api/contract";

/**
 * Presentación canónica de los planes (Esencial / Pro / Escala + A medida).
 *
 * La grilla SIEMPRE se ve completa y persuasiva, aunque el backend todavía no
 * exponga los planes vía /api/billing/plans (ventana entre deploy del panel y
 * la config de Stripe en Railway). Cuando el backend devuelve un plan con el
 * mismo `id`, usamos su `price_id` real para habilitar el checkout y, si trae,
 * su precio/descripción/features.
 *
 * Mantener los `id` en sync con los slugs de STRIPE_PRICE_<ID> del backend:
 *   esencial → STRIPE_PRICE_ESENCIAL, pro → STRIPE_PRICE_PRO, escala → STRIPE_PRICE_ESCALA
 */

// TODO: reemplazar por el WhatsApp/email real de ventas.
export const SALES_CONTACT_HREF =
  "mailto:viktoroperez@gmail.com?subject=Quiero%20un%20plan%20a%20medida%20de%20Zero";

export interface TierPresentation {
  id: string;
  name: string;
  /** Precio mensual a mostrar. `null` = "A medida" (sin precio). */
  monthlyUsd: number | null;
  /** Línea corta de capacidad, ej "~800 conversaciones/mes". */
  capacity: string;
  /** Frase de para-quién, debajo del nombre. */
  tagline: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
  /** true = no es self-service, abre contacto de ventas. */
  contact?: boolean;
}

export const PLAN_TIERS: TierPresentation[] = [
  {
    id: "esencial",
    name: "Esencial",
    monthlyUsd: 149,
    capacity: "~300 conversaciones/mes",
    tagline: "Para empezar a no perder ni un cliente.",
    features: [
      "Agenda citas sola, 24/7",
      "Responde dudas y preguntas frecuentes",
      "Captura y guarda cada lead",
      "Bilingüe automático (ES / EN)",
      "Intervención humana: escribís y el bot se pausa",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyUsd: 299,
    capacity: "~800 conversaciones/mes",
    tagline: "El bot completo para negocios que venden.",
    highlight: true,
    badge: "Recomendado",
    features: [
      "Todo lo de Esencial",
      "Cobros con link de pago (Stripe)",
      "CRM y pipeline de clientes",
      "Catálogo de productos y ventas",
      "Seguimientos automáticos",
      "Entiende notas de voz e imágenes",
      "Resumen diario del negocio por WhatsApp",
    ],
  },
  {
    id: "escala",
    name: "Escala",
    monthlyUsd: 499,
    capacity: "~2.000 conversaciones/mes",
    tagline: "Para alto volumen y varias sucursales.",
    features: [
      "Todo lo de Pro",
      "Alto volumen de conversaciones",
      "Soporte prioritario",
      "Multi-sucursal",
    ],
  },
  {
    id: "amedida",
    name: "A medida",
    monthlyUsd: null,
    capacity: "Volumen y funciones a tu necesidad",
    tagline: "Configuración personalizada y onboarding dedicado.",
    contact: true,
    features: [
      "Todo lo de Escala, sin límites fijos",
      "Configuración personalizada (pago único)",
      "Integraciones a tu medida",
      "Onboarding y acompañamiento dedicado",
    ],
  },
];

export interface ResolvedTier extends TierPresentation {
  priceId: string | null;
  canCheckout: boolean;
}

/**
 * Cruza la presentación canónica con los planes reales del backend.
 * - priceId: del backend (por id) → habilita checkout.
 * - monthlyUsd/features: si el backend los trae, ganan; si no, los canónicos.
 */
export function resolveTiers(backendPlans: BillingPlan[] = []): ResolvedTier[] {
  const byId = new Map(backendPlans.map((p) => [p.id, p]));
  return PLAN_TIERS.map((tier) => {
    const bp = byId.get(tier.id);
    return {
      ...tier,
      monthlyUsd:
        tier.contact ? null : bp?.monthly_price_usd ?? tier.monthlyUsd,
      features:
        bp?.features && bp.features.length > 0 ? bp.features : tier.features,
      priceId: bp?.price_id ?? null,
      canCheckout: !tier.contact && !!bp?.price_id,
    };
  });
}
