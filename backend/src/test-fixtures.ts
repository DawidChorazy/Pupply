import { randomUUID } from "node:crypto";

// Only integration fixtures: no object is uploaded or made public.
export const completePetFixture = () => ({
  breed: "Mieszaniec", size: "MEDIUM" as const, temperament: "Spokojny", vaccines: "Szczepienia aktualne",
  photoUrl: "https://example.invalid/pet.jpg",
  documents: { create: { name: "Testowe szczepienia", objectKey: `fixtures/${randomUUID()}.pdf`, sizeBytes: 10,
    purpose: "VACCINATION" as const, uploadedAt: new Date() } }
});
