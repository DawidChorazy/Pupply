import { API_ENDPOINTS } from "@/constants/api";
import { CreatePetPayload, PetResponse, PetsResponse, UpdatePetPayload } from "@/types/pets";

import { apiRequest } from "./api-client";

export function createPet(payload: CreatePetPayload, accessToken: string) {
  return apiRequest<PetResponse>(API_ENDPOINTS.pets.create, {
    method: "POST",
    token: accessToken,
    body: JSON.stringify(payload)
  });
}

export function listPets(accessToken: string) {
  return apiRequest<PetsResponse>(API_ENDPOINTS.pets.list, {
    method: "GET",
    token: accessToken
  });
}

export function getPet(petId: string, accessToken: string) {
  return apiRequest<PetResponse>(API_ENDPOINTS.pets.detail(petId), {
    method: "GET",
    token: accessToken
  });
}

export function updatePet(petId: string, payload: UpdatePetPayload, accessToken: string) {
  return apiRequest<PetResponse>(API_ENDPOINTS.pets.detail(petId), {
    method: "PATCH",
    token: accessToken,
    body: JSON.stringify(payload)
  });
}

export function deletePet(petId: string, accessToken: string) {
  return apiRequest<void>(API_ENDPOINTS.pets.detail(petId), {
    method: "DELETE",
    token: accessToken
  });
}
