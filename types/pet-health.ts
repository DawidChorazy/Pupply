export interface PetIllnessRecord {
  id: string;
  name: string;
  date: string;
  description: string;
  medications?: string;
}

type StoredIllnesses = { version: 1; items: PetIllnessRecord[] };
type StoredAllergies = { version: 1; items: string[] };

function isIllness(value: unknown): value is PetIllnessRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PetIllnessRecord>;
  return typeof item.id === "string" && typeof item.name === "string" && typeof item.date === "string" && typeof item.description === "string";
}

export function parsePetIllnesses(value: string | null | undefined): PetIllnessRecord[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as Partial<StoredIllnesses>;
    if (parsed.version === 1 && Array.isArray(parsed.items)) return parsed.items.filter(isIllness);
  } catch {
    // Starsze profile przechowywały całą historię jako zwykły tekst.
  }
  return [{ id: "legacy-illness", name: "Historia chorób", date: "", description: value.trim() }];
}

export function serializePetIllnesses(items: PetIllnessRecord[]) {
  return JSON.stringify({ version: 1, items } satisfies StoredIllnesses);
}

export function parsePetAllergies(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as Partial<StoredAllergies>;
    if (parsed.version === 1 && Array.isArray(parsed.items)) {
      return parsed.items.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
    }
  } catch {
    // Obsługa danych zapisanych przed wprowadzeniem przypinek.
  }
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

export function serializePetAllergies(items: string[]) {
  return JSON.stringify({ version: 1, items } satisfies StoredAllergies);
}
