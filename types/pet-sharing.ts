import type { Pet } from "./pets";

export type PetShare = {
  id: string;
  label: string | null;
  includeDocuments: boolean;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type SharedPetCard = {
  pet: Pick<Pet, "name" | "age" | "breed" | "weight" | "gender" | "photoUrl" | "illnesses" | "allergies" | "vaccines" | "vet" | "notes">;
  includeDocuments: boolean;
  documents: { id: string; name: string; sizeBytes: number; expiresAt: string | null }[];
  expiresAt: string;
};
