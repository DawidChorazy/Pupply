import { API_ENDPOINTS } from "@/constants/api";

import { ApiError, authenticatedApiRequest } from "./api-client";

type SupportedImageType = "image/jpeg" | "image/png" | "image/webp";

export async function uploadPetPhoto(uri: string, contentType: SupportedImageType) {
  const imageResponse = await fetch(uri);
  if (!imageResponse.ok) throw new ApiError("Nie udało się odczytać zdjęcia", 400, "IMAGE_READ_FAILED");
  const blob = await imageResponse.blob();

  const upload = await authenticatedApiRequest<{
    uploadUrl: string;
    photoKey: string;
    expiresIn: number;
  }>(API_ENDPOINTS.uploads.petPhoto, {
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
