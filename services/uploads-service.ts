import { API_ENDPOINTS } from "@/constants/api";

import { ApiError, authenticatedApiRequest } from "./api-client";

type SupportedImageType = "image/jpeg" | "image/png" | "image/webp";

async function uploadPhoto(uri: string, contentType: SupportedImageType, endpoint: string) {
  const imageResponse = await fetch(uri);
  if (!imageResponse.ok) throw new ApiError("Nie udało się odczytać zdjęcia", 400, "IMAGE_READ_FAILED");
  const blob = await imageResponse.blob();

  const upload = await authenticatedApiRequest<{
    uploadUrl: string;
    photoKey: string;
    expiresIn: number;
  }>(endpoint, {
    method: "POST",
    body: JSON.stringify({ contentType, sizeBytes: blob.size })
  });

  const putResponse = await fetch(upload.uploadUrl, {
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
