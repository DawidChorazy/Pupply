import { z } from "zod";

const optionalNumber = (schema: z.ZodType<number>) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    schema.optional()
  );

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );

export const createPetSchema = z.object({
  name: z.string().trim().min(1).max(80),
  age: optionalNumber(z.coerce.number().int().min(0).max(60)),
  breed: optionalText(80),
  size: z.enum(["SMALL", "MEDIUM", "LARGE"]).optional(),
  temperament: optionalText(1000),
  mobilityRestrictions: z.string().trim().max(2000).optional(),
  careInstructions: z.string().trim().max(2000).optional(),
  photoKeys: z.array(z.string().trim().min(1).max(500)).max(8).refine(keys => new Set(keys).size === keys.length, "Zdjęcia nie mogą się powtarzać").optional(),
  weight: optionalNumber(z.coerce.number().min(0).max(200)),
  gender: z.enum(["MALE", "FEMALE"]),
  photoKey: optionalText(500),
  illnesses: optionalText(10_000),
  allergies: optionalText(5_000),
  vaccines: optionalText(500),
  vet: optionalText(200),
  notes: optionalText(1000)
});

export const updatePetSchema = createPetSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Update payload is empty"
  });
