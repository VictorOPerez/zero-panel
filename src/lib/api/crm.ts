import { api } from "./client";

export type ContactStage =
  | "lead"
  | "opportunity"
  | "customer"
  | "inactive"
  | "lost";

export interface Contact {
  id: string;
  tenant_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  stage: ContactStage;
  source: string | null;
  tags: string[];
  total_bookings: number;
  total_paid_cents: number;
  first_seen_at: string;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactNote {
  id: string;
  author: "bot" | "admin";
  author_id: string | null;
  text: string;
  created_at: string;
}

export interface StageHistoryEntry {
  id: string;
  from_stage: ContactStage | null;
  to_stage: ContactStage;
  changed_by: "bot" | "admin" | "auto";
  changed_at: string;
  reason: string | null;
}

export function listContacts(
  tenantId: string,
  query: {
    stage?: ContactStage;
    tag?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ ok: true; contacts: Contact[]; total: number }> {
  return api.get(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/crm/contacts`,
    { query }
  );
}

export function getContact(
  tenantId: string,
  contactId: string
): Promise<{
  ok: true;
  contact: Contact;
  notes: ContactNote[];
  history: StageHistoryEntry[];
}> {
  return api.get(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/crm/contacts/${encodeURIComponent(contactId)}`
  );
}

export function createContact(
  tenantId: string,
  body: {
    phone: string;
    name?: string;
    email?: string;
    stage?: ContactStage;
  }
): Promise<{ ok: true; contact: Contact }> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/crm/contacts`,
    body
  );
}

export function updateStage(
  tenantId: string,
  contactId: string,
  body: { stage: ContactStage; reason?: string }
): Promise<{ ok: true; contact: Contact; changed: boolean }> {
  return api.patch(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/crm/contacts/${encodeURIComponent(contactId)}/stage`,
    body
  );
}

export function deleteContact(
  tenantId: string,
  contactId: string
): Promise<{ ok: true }> {
  return api.delete(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/crm/contacts/${encodeURIComponent(contactId)}`
  );
}

export function addNote(
  tenantId: string,
  contactId: string,
  text: string
): Promise<{ ok: true; note: ContactNote }> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/crm/contacts/${encodeURIComponent(contactId)}/notes`,
    { text }
  );
}

export function deleteNote(
  tenantId: string,
  contactId: string,
  noteId: string
): Promise<{ ok: true }> {
  return api.delete(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/crm/contacts/${encodeURIComponent(contactId)}/notes/${encodeURIComponent(noteId)}`
  );
}

export function addTag(
  tenantId: string,
  contactId: string,
  tag: string
): Promise<{ ok: true; added: boolean; tag: string }> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/crm/contacts/${encodeURIComponent(contactId)}/tags`,
    { tag }
  );
}

export function removeTag(
  tenantId: string,
  contactId: string,
  tag: string
): Promise<{ ok: true; removed: boolean }> {
  return api.delete(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/crm/contacts/${encodeURIComponent(contactId)}/tags`,
    { body: { tag } } as any
  );
}

export function listTags(
  tenantId: string
): Promise<{ ok: true; tags: Array<{ tag: string; count: number }> }> {
  return api.get(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/crm/tags`
  );
}

export function importCsv(
  tenantId: string,
  csv: string
): Promise<{
  ok: true;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}> {
  return api.post(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/crm/import-csv`,
    { csv }
  );
}
