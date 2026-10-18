import { authenticatedApiRequest } from "./api-client";
import type { PetDocument } from "@/types/pet-document";

type StoredDocument = { id: string; petId: string; name: string; sizeBytes: number; expiresAt: string | null; reminderDaysBefore: number };
const path = (petId: string) => `/pets/${encodeURIComponent(petId)}/documents`;
const toLocal = (document: StoredDocument): PetDocument => ({
  id: document.id, serverId: document.id, petId: document.petId, uri: "", name: document.name,
  lastModified: 0, size: document.sizeBytes, mimeType: "application/pdf",
  expiresAt: document.expiresAt ? document.expiresAt.slice(0, 10).split("-").reverse().join(".") : "",
  reminderDaysBefore: document.reminderDaysBefore
});
const toDate = (value: string) => value ? value.split(".").reverse().join("-") : null;

export async function getPetDocuments(petId: string): Promise<PetDocument[]> {
  const response = await authenticatedApiRequest<{ documents: StoredDocument[] }>(path(petId));
  return response.documents.map(toLocal);
}

export async function savePetDocuments(petId: string, documents: PetDocument[]): Promise<PetDocument[]> {
  const existing = await getPetDocuments(petId);
  const saved: PetDocument[] = [];
  for (const document of documents) {
    if (!document.serverId) {
      const file = await fetch(document.uri);
      if (!file.ok) throw new Error("Nie udało się odczytać pliku PDF");
      const bytes = await file.blob();
      const upload = await authenticatedApiRequest<{ document: StoredDocument; uploadUrl: string }>(`${path(petId)}/upload`, {
        method: "POST", body: JSON.stringify({ name: document.name, sizeBytes: bytes.size })
      });
      const result = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: bytes });
      if (!result.ok) throw new Error("Nie udało się wysłać pliku PDF");
      // Retain the server ID in the draft so retries do not create duplicate uploads.
      document.serverId = upload.document.id;
      document.petId = petId;
    }
    const response = await authenticatedApiRequest<{ document: StoredDocument }>(`${path(petId)}/${encodeURIComponent(document.serverId)}`, {
      method: "PATCH", body: JSON.stringify({ expiresAt: toDate(document.expiresAt), reminderDaysBefore: document.reminderDaysBefore })
    });
    saved.push(toLocal(response.document));
  }
  for (const old of existing) if (!documents.some(document => document.serverId === old.serverId)) {
    await authenticatedApiRequest<void>(`${path(petId)}/${encodeURIComponent(old.serverId!)}`, { method: "DELETE" });
  }
  return saved;
}

export async function getPetDocumentDownloadUrl(document: PetDocument) {
  if (!document.serverId || !document.petId) return document.uri;
  const response = await authenticatedApiRequest<{ url: string }>(`${path(document.petId)}/${encodeURIComponent(document.serverId)}/download`);
  return response.url;
}
