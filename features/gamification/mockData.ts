import { MaterialCommunityIcons } from "@expo/vector-icons";

export type LeaderboardUser = {
  id: string;
  name: string;
  points: number;
  badge: string;
};

export type QuestStatus = "available" | "claimed" | "locked";

export type Quest = {
  id: string;
  title: string;
  description: string;
  points: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  status: QuestStatus;
};

export const baseLeaderboard: LeaderboardUser[] = [
  { id: "u-1", name: "Kasia i Bąbel", points: 1480, badge: "Mistrz spacerów" },
  { id: "u-2", name: "Michał i Luna", points: 1320, badge: "Aktywny opiekun" },
  { id: "u-3", name: "Ola i Pixel", points: 1190, badge: "Zdrowy pupil" },
  { id: "current-user", name: "Ty", points: 860, badge: "Dobry start" },
  { id: "u-4", name: "Bartek i Figa", points: 740, badge: "Weekendowy spacerowicz" }
];

export const initialQuests: Quest[] = [
  {
    id: "vet-checkup",
    title: "Badanie u weterynarza",
    description: "Dodaj informację o kontroli zdrowia pupila.",
    points: 120,
    icon: "stethoscope",
    status: "available"
  },
  {
    id: "vaccination-book",
    title: "Książeczka szczepień",
    description: "Dodaj PDF z książeczką lub potwierdzeniem szczepień.",
    points: 180,
    icon: "file-pdf-box",
    status: "available"
  },
  {
    id: "first-walk",
    title: "Pierwszy umówiony spacer",
    description: "Umów spacer z opiekunem z listy.",
    points: 90,
    icon: "walk",
    status: "available"
  },
  {
    id: "profile-complete",
    title: "Pełny profil pupila",
    description: "Uzupełnij wagę, rasę, alergie i kontakt do weterynarza.",
    points: 75,
    icon: "dog-service",
    status: "claimed"
  },
  {
    id: "monthly-care",
    title: "Miesiąc regularnej opieki",
    description: "Zdobądź punkty za regularne dbanie o zdrowie i spacery.",
    points: 300,
    icon: "calendar-star",
    status: "locked"
  }
];
