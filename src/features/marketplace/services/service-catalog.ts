import type { SitterServiceType } from "@/features/marketplace/types/marketplace";

export const SERVICE_LABELS: Record<SitterServiceType, string> = {
  DOG_WALK: "Spacer",
  DROP_IN: "Wizyta domowa",
  DAY_CARE: "Opieka u opiekuna"
};

export const SERVICE_DESCRIPTIONS: Record<SitterServiceType, string> = {
  DOG_WALK: "Spacer ze zwierzakiem w okolicy.",
  DROP_IN: "Opiekun przychodzi do domu właściciela. Długość wizyty ustalacie przy rezerwacji.",
  DAY_CARE: "Właściciel przywozi zwierzaka do domu opiekuna i odbiera go po opiece."
};
