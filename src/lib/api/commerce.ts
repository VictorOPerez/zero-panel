import { api } from "./client";

export interface Product {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  stock: number | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "fulfilled"
  | "cancelled"
  | "refunded";

export interface Order {
  id: string;
  contact_id: string | null;
  conversation_id: string | null;
  status: OrderStatus;
  total_cents: number;
  currency: string;
  client_name: string | null;
  client_phone: string | null;
  shipping_address: string | null;
  notes: string | null;
  payment_link_id: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  sku: string | null;
  name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  currency: string;
}

export function listProducts(
  tenantId: string,
  query: { search?: string; limit?: number; offset?: number } = {}
): Promise<{ ok: true; products: Product[]; total: number }> {
  return api.get(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/products`,
    { query }
  );
}

export function createProduct(
  tenantId: string,
  body: {
    sku?: string | null;
    name: string;
    description?: string | null;
    price_cents: number;
    currency?: string;
    stock?: number | null;
    image_url?: string | null;
    active?: boolean;
  }
): Promise<{ ok: true; product: Product }> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/products`,
    body
  );
}

export function updateProduct(
  tenantId: string,
  productId: string,
  body: Partial<{
    sku: string | null;
    name: string;
    description: string | null;
    price_cents: number;
    currency: string;
    stock: number | null;
    image_url: string | null;
    active: boolean;
  }>
): Promise<{ ok: true; product: Product }> {
  return api.patch(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/products/${encodeURIComponent(productId)}`,
    body
  );
}

export function deleteProduct(
  tenantId: string,
  productId: string
): Promise<{ ok: true }> {
  return api.delete(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/products/${encodeURIComponent(productId)}`
  );
}

export function listOrders(
  tenantId: string,
  query: { status?: OrderStatus; limit?: number } = {}
): Promise<{ ok: true; orders: Order[] }> {
  return api.get(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/orders`,
    { query }
  );
}

export function getOrder(
  tenantId: string,
  orderId: string
): Promise<{ ok: true; order: Order; items: OrderItem[] }> {
  return api.get(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/orders/${encodeURIComponent(orderId)}`
  );
}

export function updateOrderStatus(
  tenantId: string,
  orderId: string,
  body: { status: OrderStatus; notes?: string }
): Promise<{ ok: true; order: Order }> {
  return api.patch(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/orders/${encodeURIComponent(orderId)}`,
    body
  );
}
