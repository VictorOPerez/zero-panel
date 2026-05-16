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

export async function buyTenantNumber(
  tenantId: string,
  body: BuyNumberInput
): Promise<TenantNumber> {
  const res = await api.post<SingleEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/numbers`,
    body
  );
  return res.number;
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
