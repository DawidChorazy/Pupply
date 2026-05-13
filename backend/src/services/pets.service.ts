import { AccountRole, PetGender } from "@prisma/client";

import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

export interface CreatePetInput {
  name: string;
  age?: number;
  breed?: string;
  weight?: number;
  gender: PetGender;
  photoUrl?: string;
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
  photoUrl?: string;
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

export async function createPet(accountId: string, role: AccountRole, input: CreatePetInput) {
  ensureUserRole(role);

  return prisma.pet.create({
    data: {
      accountId,
      ...input
    }
  });
}

export async function listPets(accountId: string, role: AccountRole) {
  ensureUserRole(role);

  return prisma.pet.findMany({
    where: {
      accountId
    },
    orderBy: {
      createdAt: "desc"
    }
  });
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

  return pet;
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

  return prisma.pet.update({
    where: {
      id: pet.id
    },
    data: input
  });
}
