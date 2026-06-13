import { api } from "./client";
import type {
  AvailableNumber,
  BuyNumberInput,
  TenantNumber,
} from "./contract";

interface ListEnvelope {
  numbers: TenantNumber[];
}
interface SingleEnvelope {
  number: TenantNumber;
}
interface SearchEnvelope {
  items: AvailableNumber[];
}

export interface NumbersAvailability {
  sellable: boolean;
  reason: string | null;
  message: string | null;
}

// ¿Se pueden vender números ahora mismo? El bloqueo REAL es server-side (corta
// antes de cobrar); esto es para reflejarlo en la UI (deshabilitar el botón +
// mostrar el mensaje) en vez de dejar que el usuario pague por algo que no
// podemos entregar.
export async function getNumbersAvailability(
  tenantId: string
): Promise<NumbersAvailability> {
  const res = await api.get<{
    ok: boolean;
    sellable: boolean;
    reason: string | null;
    message: string | null;
  }>(`/api/admin/tenants/${encodeURIComponent(tenantId)}/numbers/availability`);
  return {
    sellable: !!res.sellable,
    reason: res.reason ?? null,
    message: res.message ?? null,
  };
}

export async function listTenantNumbers(tenantId: string): Promise<TenantNumber[]> {
  const res = await api.get<ListEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/numbers`
  );
  return res.numbers ?? [];
}

export async function searchAvailableNumbers(
  tenantId: string,
  params: { country: string; areaCode?: string; limit?: number }
): Promise<AvailableNumber[]> {
  const res = await api.get<SearchEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/numbers/search`,
    {
      query: {
        country: params.country,
        area_code: params.areaCode || undefined,
        limit: params.limit || undefined,
      },
    }
  );
  return res.items ?? [];
}

// Inicia la compra: el backend devuelve la URL de Stripe Checkout. El panel
// redirige al usuario; el número se aprovisiona recién cuando el pago se
// confirma (webhook). success_url/cancel_url los pasa el panel (su propio origin).
export async function startNumberCheckout(
  tenantId: string,
  body: BuyNumberInput & { success_url?: string; cancel_url?: string }
): Promise<{ checkout_url: string }> {
  const res = await api.post<{ checkout_url: string }>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/numbers`,
    body
  );
  return { checkout_url: res.checkout_url };
}

export async function updateNumberForward(
  tenantId: string,
  numberId: string,
  forwardToPhone: string | null
): Promise<TenantNumber> {
  const res = await api.patch<SingleEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(
      tenantId
    )}/numbers/${encodeURIComponent(numberId)}/forward`,
    { forward_to_phone: forwardToPhone }
  );
  return res.number;
}

// El cliente confirma que terminó la verificación en WhatsApp Manager →
// el número pasa a "active".
export async function markNumberConnected(
  tenantId: string,
  numberId: string
): Promise<TenantNumber> {
  const res = await api.patch<SingleEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(
      tenantId
    )}/numbers/${encodeURIComponent(numberId)}/connected`,
    {}
  );
  return res.number;
}

export async function releaseTenantNumber(
  tenantId: string,
  numberId: string
): Promise<void> {
  await api.delete(
    `/api/admin/tenants/${encodeURIComponent(
      tenantId
    )}/numbers/${encodeURIComponent(numberId)}`
  );
}
