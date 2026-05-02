import { api } from "./client";
import type {
  CreateKnowledgeDocumentInput,
  CreateKnowledgeDocumentResponse,
  IngestPdfInput,
  IngestUrlInput,
  KnowledgeDocument,
} from "./contract";

interface ListEnvelope {
  documents: KnowledgeDocument[];
}

export async function listKnowledgeDocuments(
  tenantId: string
): Promise<KnowledgeDocument[]> {
  const res = await api.get<ListEnvelope>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/knowledge/documents`
  );
  return res.documents ?? [];
}

export async function createKnowledgeDocument(
  tenantId: string,
  body: CreateKnowledgeDocumentInput
): Promise<CreateKnowledgeDocumentResponse> {
  return api.post<CreateKnowledgeDocumentResponse>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/knowledge/documents`,
    body
  );
}

export async function ingestKnowledgeUrl(
  tenantId: string,
  body: IngestUrlInput
): Promise<CreateKnowledgeDocumentResponse> {
  return api.post<CreateKnowledgeDocumentResponse>(
    `/api/admin/tenants/${encodeURIComponent(
      tenantId
    )}/knowledge/documents/ingest-url`,
    body
  );
}

export async function ingestKnowledgePdf(
  tenantId: string,
  body: IngestPdfInput
): Promise<CreateKnowledgeDocumentResponse> {
  return api.post<CreateKnowledgeDocumentResponse>(
    `/api/admin/tenants/${encodeURIComponent(
      tenantId
    )}/knowledge/documents/ingest-pdf`,
    body
  );
}

export async function deleteKnowledgeDocument(
  tenantId: string,
  documentId: string
): Promise<void> {
  await api.delete(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/knowledge/documents/${encodeURIComponent(
      documentId
    )}`
  );
}

// Lee un File como base64 (sin el data URL prefix). Lo usa el form de PDF
// para mandar al endpoint ingest-pdf vía JSON.
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("file read failed"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
