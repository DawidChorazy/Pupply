import { apiRequest, authenticatedApiRequest } from "./api-client";
import type { PetShare, SharedPetCard } from "@/types/pet-sharing";

const sharesPath = (petId: string) => `/pets/${encodeURIComponent(petId)}/shares`;

export async function listPetShares(petId: string) {
  return (await authenticatedApiRequest<{ shares: PetShare[] }>(sharesPath(petId))).shares;
}

export function createPetShare(petId: string, input: { label: string; includeDocuments: boolean }) {
  return authenticatedApiRequest<{ share: PetShare; url: string }>(sharesPath(petId), { method: "POST", body: JSON.stringify(input) });
}

export function revokePetShare(petId: string, shareId: string) {
  return authenticatedApiRequest<void>(`${sharesPath(petId)}/${encodeURIComponent(shareId)}`, { method: "DELETE" });
}

// The fragment stays in the recipient's browser; the capability travels only in a header.
const publicOptions = (token: string, signal?: AbortSignal): RequestInit => ({
  headers: { "X-Pet-Share-Token": token }, cache: "no-store", referrerPolicy: "no-referrer", signal
});

export function getSharedPetCard(token: string, signal?: AbortSignal) {
  return apiRequest<SharedPetCard>("/shared-pets/card", publicOptions(token, signal));
}

export async function getSharedDocumentUrl(token: string, documentId: string) {
  return (await apiRequest<{ url: string }>(`/shared-pets/documents/${encodeURIComponent(documentId)}/download`, publicOptions(token))).url;
}
