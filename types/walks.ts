export type WalkStatus = "confirmed" | "pending";

export type WalkStage = "waiting" | "in_progress" | "returning" | "completed";

export type WalkDurationOption = {
  minutes: number;
  label: string;
  price: number;
};

export type WalkTimeSlot = {
  id: string;
  label: string;
  dayLabel: string;
};

export type Caregiver = {
  id: string;
  name: string;
  role: string;
  rating: string;
  distance: string;
  priceLabel: string;
  phone: string;
  availability: string;
  tags: string[];
  timeSlots: WalkTimeSlot[];
  durations: WalkDurationOption[];
};

export type UpcomingWalk = {
  id: string;
  caregiverId: string;
  caregiverName: string;
  caregiverPhone: string;
  petId: string;
  petName: string;
  time: string;
  durationMinutes: number;
  durationLabel: string;
  price: number;
  status: WalkStatus;
  bookedAt: string;
};

export type BookWalkPayload = {
  caregiverId: string;
  caregiverName: string;
  petId: string;
  petName: string;
  timeSlotId: string;
  timeLabel: string;
  dayLabel: string;
  durationMinutes: number;
  durationLabel: string;
  price: number;
};
