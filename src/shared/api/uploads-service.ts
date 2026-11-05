import { API_ENDPOINTS } from "@/shared/api/config";

import { ApiError, authenticatedApiRequest } from "@/shared/api/api-client";

type SupportedImageType = "image/jpeg" | "image/png" | "image/webp";

async function uploadPhoto(uri: string, contentType: SupportedImageType, endpoint: string, signal?: AbortSignal) {
  const imageResponse = await fetch(uri, { signal });
  if (!imageResponse.ok) throw new ApiError("Nie udało się odczytać zdjęcia", 400, "IMAGE_READ_FAILED");
  const blob = await imageResponse.blob();

  const upload = await authenticatedApiRequest<{
    uploadUrl: string;
    photoKey: string;
    expiresIn: number;
  }>(endpoint, {
    signal,
    method: "POST",
    body: JSON.stringify({ contentType, sizeBytes: blob.size })
  });

  const putResponse = await fetch(upload.uploadUrl, {
    signal,
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!putResponse.ok) throw new ApiError("Nie udało się wysłać zdjęcia", putResponse.status, "UPLOAD_FAILED");
  return upload.photoKey;
}

export function uploadPetPhoto(uri: string, contentType: SupportedImageType) {
  return uploadPhoto(uri, contentType, API_ENDPOINTS.uploads.petPhoto);
}

export function uploadSitterPhoto(uri: string, contentType: SupportedImageType) {
  return uploadPhoto(uri, contentType, "/uploads/sitter-photo");
}

export function uploadProfilePhoto(uri: string, signal?: AbortSignal) {
  return uploadPhoto(uri, "image/jpeg", "/uploads/profile-photo", signal);
}
