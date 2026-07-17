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
