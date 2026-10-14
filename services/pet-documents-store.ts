import type { PetDocument } from "@/types/pet-document";

const documentsByPet = new Map<string, PetDocument[]>();

export function savePetDocuments(petId: string, documents: PetDocument[]){
    documentsByPet.set(petId, [...documents])
}

export function getPetDocuments(petId: string): PetDocument[]{
    return documentsByPet.get(petId) ?? [];
}