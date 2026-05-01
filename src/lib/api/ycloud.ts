import { api } from "./client";

export interface YCloudOnboardBody {
  channel_id: string;
  phone_number: string;
  waba_id?: string;
}

export interface YCloudOnboardResponse {
  ok: true;
  whatsapp: {
    connected: true;
    provider: "ycloud";
    channel_id: string;
    phone_number: string;
    waba_id?: string;
  };
}

export function onboardYCloud(
  tenantId: string,
  body: YCloudOnboardBody
): Promise<YCloudOnboardResponse> {
  return api.post<YCloudOnboardResponse>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/ycloud/onboard`,
    body
  );
}

export function disconnectYCloud(tenantId: string): Promise<{ ok: true }> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/ycloud/disconnect`,
    {}
  );
}
