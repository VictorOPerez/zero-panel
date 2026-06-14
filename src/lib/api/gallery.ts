import { api } from "./client";

export interface GalleryItem {
  id: string;
  url: string;
  description: string;
  note: string | null;
  tags: string | null;
  service_name: string | null;
  created_at: string;
}

const base = (tenantId: string) =>
  `/api/admin/tenants/${encodeURIComponent(tenantId)}/gallery`;

export function listGalleryItems(
  tenantId: string
): Promise<{ ok: true; items: GalleryItem[]; cloudinary_ready: boolean }> {
  return api.get(base(tenantId));
}

export function uploadGalleryItem(
  tenantId: string,
  body: {
    content_base64: string;
    mime: string;
    note?: string | null;
    service?: string | null;
    tags?: string | null;
  }
): Promise<{ ok: true; item: GalleryItem }> {
  return api.post(base(tenantId), body);
}

export function updateGalleryItem(
  tenantId: string,
  itemId: string,
  body: Partial<{ note: string | null; service: string | null; tags: string | null }>
): Promise<{ ok: true; item: GalleryItem }> {
  return api.patch(`${base(tenantId)}/${encodeURIComponent(itemId)}`, body);
}

export function deleteGalleryItem(
  tenantId: string,
  itemId: string
): Promise<{ ok: true; deleted: number }> {
  return api.delete(`${base(tenantId)}/${encodeURIComponent(itemId)}`);
}
