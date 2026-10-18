import { AccountRole, Pet, PetGender } from "@prisma/client";

import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { assertPhotoExists, deletePetPhoto, getPetPhotoUrl } from "./storage.service";

export interface CreatePetInput {
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

export interface UpdatePetInput {
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

function ensureUserRole(role: AccountRole) {
  if (role !== "USER") {
    throw new AppError(403, "Only users can manage pets", "FORBIDDEN");
  }
}

async function mapPet(pet: Pet) {
  return {
    ...pet,
    photoUrl: pet.photoKey ? await getPetPhotoUrl(pet.photoKey) : pet.photoUrl
  };
}

export async function createPet(accountId: string, role: AccountRole, input: CreatePetInput) {
  ensureUserRole(role);

  if (input.photoKey) await assertPhotoExists(accountId, input.photoKey);

  const pet = await prisma.pet.create({
    data: {
      accountId,
      ...input
    }
  });
  return mapPet(pet);
}

export async function listPets(accountId: string, role: AccountRole) {
  ensureUserRole(role);

  const pets = await prisma.pet.findMany({
    where: {
      accountId
    },
    orderBy: {
      createdAt: "desc"
    }
  });
  return Promise.all(pets.map(mapPet));
}

export async function getPet(accountId: string, role: AccountRole, petId: string) {
  ensureUserRole(role);

  const pet = await prisma.pet.findFirst({
    where: {
      id: petId,
      accountId
    }
  });

  if (!pet) {
    throw new AppError(404, "Pet not found", "PET_NOT_FOUND");
  }

  return mapPet(pet);
}

export async function updatePet(
  accountId: string,
  role: AccountRole,
  petId: string,
  input: UpdatePetInput
) {
  ensureUserRole(role);

  const pet = await prisma.pet.findFirst({
    where: {
      id: petId,
      accountId
    }
  });

  if (!pet) {
    throw new AppError(404, "Pet not found", "PET_NOT_FOUND");
  }

  if (input.photoKey) await assertPhotoExists(accountId, input.photoKey);

  const updatedPet = await prisma.pet.update({
    where: {
      id: pet.id
    },
    data: input
  });

  if (input.photoKey && pet.photoKey && input.photoKey !== pet.photoKey) {
    await deletePetPhoto(pet.photoKey).catch(() => undefined);
  }

  return mapPet(updatedPet);
}

export async function deletePet(accountId: string, role: AccountRole, petId: string) {
  ensureUserRole(role);
  const pet = await prisma.pet.findFirst({
    where: { id: petId, accountId },
    include: { _count: { select: { bookings: true } } }
  });
  if (!pet) throw new AppError(404, "Pet not found", "PET_NOT_FOUND");
  if (pet._count.bookings > 0) {
    throw new AppError(409, "Pet with booking history cannot be deleted", "PET_HAS_BOOKINGS");
  }
  await prisma.pet.delete({ where: { id: pet.id } });
  await deletePetPhoto(pet.photoKey).catch(() => undefined);
}
