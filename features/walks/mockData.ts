export type UpcomingWalk = {
  id: string;
  caregiverName: string;
  petName: string;
  time: string;
  status: "confirmed" | "pending";
};

export const upcomingWalks: UpcomingWalk[] = [
  {
    id: "walk-1",
    caregiverName: "Anna Kowalska",
    petName: "Bąbel",
    time: "Dzisiaj, 18:30",
    status: "confirmed"
  }
];
