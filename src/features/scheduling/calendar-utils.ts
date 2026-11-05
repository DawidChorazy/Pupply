export type TimeRange = { startsAt: string; endsAt: string };
export type BookableTime = { slotId: string; startsAt: string; endsAt: string };
export type CommonBookableTime = { time: string; bookings: BookableTime[] };

export const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const pad = (value: number) => String(value).padStart(2, "0");

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function calendarWindow(month: string): { from: string; to: string } {
  const first = localDate(`${month}-01`);
  // Fetch one civil month, including DST transitions; the API enforces a 62-day
  // ceiling, and navigation loads further months explicitly.
  return { from: first.toISOString(), to: new Date(first.getFullYear(), first.getMonth() + 1, 1).toISOString() };
}

// Construct local dates rather than parsing YYYY-MM-DD as UTC. Calendar arithmetic
// uses civil days so repeating hours remain the same across daylight-saving changes.
export function localDate(key: string, minutes = 0): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
}

export function addDays(key: string, count: number): string {
  const date = localDate(key, 12 * 60);
  date.setDate(date.getDate() + count);
  return dateKey(date);
}

export function timeLabel(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

export function dayLabel(key: string): string {
  return localDate(key).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
}

export function intersectsDay(range: TimeRange, key: string): boolean {
  return Date.parse(range.startsAt) < localDate(addDays(key, 1)).getTime()
    && Date.parse(range.endsAt) > localDate(key).getTime();
}

export function freeRanges<T extends TimeRange>(slot: T, bookings: TimeRange[], now = new Date()): T[] {
  const result: T[] = [];
  let cursor = Math.max(Date.parse(slot.startsAt), now.getTime());
  const end = Date.parse(slot.endsAt);
  const append = (until: number) => {
    if (until > cursor) result.push({ ...slot, startsAt: new Date(cursor).toISOString(), endsAt: new Date(until).toISOString() });
  };
  for (const booking of [...bookings].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
    const start = Date.parse(booking.startsAt), finish = Date.parse(booking.endsAt);
    if (start >= end) break;
    if (finish <= cursor) continue;
    append(start);
    cursor = Math.max(cursor, finish);
  }
  append(end);
  return result;
}

export function bookableTimes(
  slots: (TimeRange & { id: string })[], day: string, durationMinutes: number, now = new Date()
): BookableTime[] {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return [];
  const dayStart = localDate(day).getTime(), dayEnd = localDate(addDays(day, 1)).getTime();
  const result = new Map<string, BookableTime>();
  for (const slot of slots) {
    const start = new Date(Math.max(Date.parse(slot.startsAt), dayStart, now.getTime() + 1));
    start.setSeconds(0, 0);
    if (start.getTime() < Math.max(Date.parse(slot.startsAt), dayStart, now.getTime() + 1)) start.setMinutes(start.getMinutes() + 1);
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
    for (let time = start.getTime(); time < dayEnd && time + durationMinutes * 60_000 <= Date.parse(slot.endsAt); time += 15 * 60_000) {
      const startsAt = new Date(time).toISOString();
      result.set(startsAt, { slotId: slot.id, startsAt, endsAt: new Date(time + durationMinutes * 60_000).toISOString() });
    }
  }
  return [...result.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function scheduleDates(day: string, weekdays: number[], weeks: number): string[] {
  return Array.from({ length: weeks * 7 }, (_, index) => addDays(day, index))
    .filter(key => weekdays.includes((localDate(key).getDay() + 6) % 7));
}

export function commonBookableTimes(
  slots: (TimeRange & { id: string })[], days: string[], durationMinutes: number, now = new Date()
): CommonBookableTime[] {
  const sortedDays = [...new Set(days)].sort();
  if (!sortedDays.length) return [];
  const byDay = sortedDays.map(day => {
    const choices = new Map<string, BookableTime>();
    for (const time of bookableTimes(slots, day, durationMinutes, now)) {
      const key = formatTime(time.startsAt);
      if (!choices.has(key)) choices.set(key, time);
    }
    return choices;
  });
  return [...byDay[0]].flatMap(([time]) => {
    if (!byDay.every(choices => choices.has(time))) return [];
    const bookings = byDay.map(choices => choices.get(time)!);
    // A 24-hour visit spanning a clock change can overlap the next day's visit,
    // even with equal wall-clock start times. Don't offer an unbookable series.
    if (bookings.some((booking, index) => index > 0 && Date.parse(booking.startsAt) < Date.parse(bookings[index - 1].endsAt))) return [];
    return [{ time, bookings }];
  });
}

export function bookingPrice(priceCents: number, baseMinutes: number, durationMinutes: number): number {
  return Math.round(priceCents * durationMinutes / baseMinutes);
}

export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return hours ? `${hours} godz.${remainder ? ` ${remainder} min` : ""}` : `${minutes} min`;
}

export function buildSchedule(
  days: string[], start: number, end: number, pause?: { start: number; end: number }, now = new Date()
): TimeRange[] {
  if (start >= end) throw new Error("Koniec pracy musi być później niż początek.");
  if (pause && (pause.start <= start || pause.end >= end || pause.start >= pause.end)) {
    throw new Error("Przerwa musi mieścić się w godzinach pracy i mieć koniec późniejszy niż początek.");
  }
  if (!days.length) throw new Error("Wybierz co najmniej jeden dzień tygodnia.");
  const ranges = pause ? [[start, pause.start], [pause.end, end]] : [[start, end]];
  return days.flatMap(day => ranges.map(([from, to]) => {
    const startsAt = localDate(day, from), endsAt = localDate(day, to);
    if (startsAt.getHours() * 60 + startsAt.getMinutes() !== from || (to !== 1440 && endsAt.getHours() * 60 + endsAt.getMinutes() !== to)) {
      throw new Error("Wybrane godziny wypadają podczas zmiany czasu. Wybierz inną godzinę.");
    }
    if (startsAt <= now) throw new Error("Wybierz przyszły dzień lub późniejszą godzinę rozpoczęcia.");
    return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
  }));
}
