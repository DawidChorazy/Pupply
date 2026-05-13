import { Router } from "express";

import { requireAuth } from "../middleware/require-auth";
import { createPet, getPet, listPets, updatePet } from "../services/pets.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { createPetSchema, updatePetSchema } from "../validation/pets.schemas";

const petsRouter = Router();

petsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
    }

    const payload = createPetSchema.parse(req.body);
    const pet = await createPet(req.auth.accountId, req.auth.role, payload);

    res.status(201).json({
      pet
    });
  })
);

petsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
    }

    const pets = await listPets(req.auth.accountId, req.auth.role);

    res.status(200).json({
      pets
    });
  })
);

petsRouter.get(
  "/:petId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
    }

    const pet = await getPet(req.auth.accountId, req.auth.role, req.params.petId);

    res.status(200).json({
      pet
    });
  })
);

petsRouter.patch(
  "/:petId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
    }

    const payload = updatePetSchema.parse(req.body);
    const pet = await updatePet(req.auth.accountId, req.auth.role, req.params.petId, payload);

    res.status(200).json({
      pet
    });
  })
);

export { petsRouter };
