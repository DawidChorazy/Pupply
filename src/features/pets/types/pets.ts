export type PetGender = "MALE" | "FEMALE";

export interface CreatePetPayload {
  name: string;
  age?: number;
  breed?: string;
  weight?: number;
  gender: PetGender;
  photoKey?: string;
  illnesses?: string;
  allergies?: string;
  vaccines?: string;
  vet?: string;
  notes?: string;
}

export interface UpdatePetPayload {
  name?: string;
  age?: number;
  breed?: string;
  weight?: number;
  gender?: PetGender;
  photoKey?: string;
  illnesses?: string;
  allergies?: string;
  vaccines?: string;
  vet?: string;
  notes?: string;
}

export interface Pet {
  id: string;
  accountId: string;
  name: string;
  age: number | null;
  breed: string | null;
  weight: number | null;
  gender: PetGender;
  photoUrl: string | null;
  photoKey: string | null;
  illnesses: string | null;
  allergies: string | null;
  vaccines: string | null;
  vet: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PetResponse {
  pet: Pet;
}

export interface PetsResponse {
  pets: Pet[];
}
