import { CreatePetPayload, Pet } from "@/types/pets";
import { Platform } from "react-native";

const STORAGE_KEY = "local_pets";
const LOCAL_ACCOUNT_ID = "local-dev-user";

let memoryPets: Pet[] = [];

function hasWebStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export async function loadLocalPets(): Promise<Pet[]> {
  try {
    if (Platform.OS === "web" && hasWebStorage()) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Pet[]) : [];
      memoryPets = parsed;
      return parsed;
    }

    return memoryPets;
  } catch {
    return memoryPets;
  }
}

export async function saveLocalPets(pets: Pet[]): Promise<void> {
  memoryPets = pets;

  if (Platform.OS === "web" && hasWebStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pets));
  }
}

export function createLocalPet(payload: CreatePetPayload): Pet {
  const now = new Date().toISOString();

  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    accountId: LOCAL_ACCOUNT_ID,
    name: payload.name,
    age: payload.age ?? null,
    breed: payload.breed ?? null,
    weight: payload.weight ?? null,
    gender: payload.gender,
    photoUrl: payload.photoUrl ?? null,
    illnesses: payload.illnesses ?? null,
    allergies: payload.allergies ?? null,
    vaccines: payload.vaccines ?? null,
    vet: payload.vet ?? null,
    notes: payload.notes ?? null,
    createdAt: now,
    updatedAt: now
  };
}

export function updateLocalPet(pet: Pet, payload: CreatePetPayload): Pet {
  return {
    ...pet,
    name: payload.name,
    age: payload.age ?? null,
    breed: payload.breed ?? null,
    weight: payload.weight ?? null,
    gender: payload.gender,
    photoUrl: payload.photoUrl ?? null,
    illnesses: payload.illnesses ?? null,
    allergies: payload.allergies ?? null,
    vaccines: payload.vaccines ?? null,
    vet: payload.vet ?? null,
    notes: payload.notes ?? null,
    updatedAt: new Date().toISOString()
  };
}
