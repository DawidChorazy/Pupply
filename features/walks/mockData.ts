import { Caregiver } from "@/types/walks";

export const caregivers: Caregiver[] = [
  {
    id: "care-1",
    name: "Anna Kowalska",
    role: "Petsitterka i spacery",
    rating: "4.9",
    distance: "1.2 km",
    priceLabel: "od 35 zł",
    phone: "+48 512 345 678",
    availability: "Dzisiaj 16:00–20:00",
    tags: ["małe psy", "leki", "weekendy"],
    timeSlots: [
      { id: "care-1-16", label: "16:00", dayLabel: "Dzisiaj" },
      { id: "care-1-17", label: "17:00", dayLabel: "Dzisiaj" },
      { id: "care-1-18", label: "18:00", dayLabel: "Dzisiaj" },
      { id: "care-1-19", label: "19:00", dayLabel: "Dzisiaj" },
      { id: "care-1-20", label: "20:00", dayLabel: "Dzisiaj" }
    ],
    durations: [
      { minutes: 30, label: "30 min", price: 35 },
      { minutes: 45, label: "45 min", price: 50 },
      { minutes: 60, label: "60 min", price: 65 }
    ]
  },
  {
    id: "care-2",
    name: "Michał Nowak",
    role: "Aktywne spacery",
    rating: "4.8",
    distance: "2.4 km",
    priceLabel: "od 40 zł",
    phone: "+48 601 234 567",
    availability: "Jutro 9:00–14:00",
    tags: ["duże psy", "bieganie", "socjalizacja"],
    timeSlots: [
      { id: "care-2-09", label: "09:00", dayLabel: "Jutro" },
      { id: "care-2-10", label: "10:00", dayLabel: "Jutro" },
      { id: "care-2-11", label: "11:00", dayLabel: "Jutro" },
      { id: "care-2-12", label: "12:00", dayLabel: "Jutro" },
      { id: "care-2-13", label: "13:00", dayLabel: "Jutro" },
      { id: "care-2-14", label: "14:00", dayLabel: "Jutro" }
    ],
    durations: [
      { minutes: 30, label: "30 min", price: 40 },
      { minutes: 45, label: "45 min", price: 55 },
      { minutes: 60, label: "60 min", price: 70 }
    ]
  },
  {
    id: "care-3",
    name: "Kasia Zielińska",
    role: "Opieka dzienna",
    rating: "5.0",
    distance: "3.1 km",
    priceLabel: "od 55 zł",
    phone: "+48 789 456 123",
    availability: "W tygodniu po 15:00",
    tags: ["szczeniaki", "koty", "transport"],
    timeSlots: [
      { id: "care-3-15", label: "15:00", dayLabel: "Poniedziałek" },
      { id: "care-3-16", label: "16:00", dayLabel: "Poniedziałek" },
      { id: "care-3-17", label: "17:00", dayLabel: "Poniedziałek" },
      { id: "care-3-18", label: "18:00", dayLabel: "Poniedziałek" },
      { id: "care-3-19", label: "19:00", dayLabel: "Poniedziałek" }
    ],
    durations: [
      { minutes: 30, label: "30 min", price: 55 },
      { minutes: 60, label: "60 min", price: 90 },
      { minutes: 90, label: "90 min", price: 120 }
    ]
  }
];

export function getCaregiverById(caregiverId?: string) {
  return caregivers.find((caregiver) => caregiver.id === caregiverId);
}
