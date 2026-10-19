const { test } = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
process.env.TZ = "Europe/Warsaw";
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("features/scheduling/calendar-utils.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, { exports: exportsObject, Date, Set, Map });
const { dateKey, localDate, addDays, buildSchedule, scheduleDates, freeRanges, bookableTimes, commonBookableTimes, bookingPrice, intersectsDay } = exportsObject;
const now = new Date("2026-10-19T06:00:00Z");
const range = (day, start, end) => ({ startsAt: localDate(day, start).toISOString(), endsAt: localDate(day, end).toISOString() });

test("calendar days stay local across month, year and DST boundaries", () => {
  assert.equal(dateKey(localDate("2026-10-25")), "2026-10-25");
  assert.equal(addDays("2026-10-24", 2), "2026-10-26");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
});

test("repeat hours and breaks remain at 09:00 across the October clock change", () => {
  const days = scheduleDates("2026-10-23", [0, 4], 2);
  assert.deepEqual(Array.from(days), ["2026-10-23", "2026-10-26", "2026-10-30", "2026-11-02"]);
  const slots = buildSchedule(days, 540, 1020, { start: 720, end: 780 }, now);
  assert.equal(slots.length, 8);
  assert.equal(slots[0].startsAt, "2026-10-23T07:00:00.000Z");
  assert.equal(slots[2].startsAt, "2026-10-26T08:00:00.000Z");
  for (const day of days) {
    const pair = slots.filter(slot => dateKey(new Date(slot.startsAt)) === day);
    assert.equal(new Date(pair[0].endsAt).getHours(), 12);
    assert.equal(new Date(pair[1].startsAt).getHours(), 13);
  }
});

test("invalid hours, breaks, empty repeats, past starts and nonexistent DST hours are rejected", () => {
  for (const input of [
    () => buildSchedule([], 540, 1020, undefined, now),
    () => buildSchedule(["2026-10-20"], 1020, 540, undefined, now),
    () => buildSchedule(["2026-10-20"], 540, 1020, { start: 480, end: 780 }, now),
    () => buildSchedule(["2026-10-20"], 540, 1020, { start: 780, end: 720 }, now),
    () => buildSchedule(["2026-10-18"], 540, 1020, undefined, now),
    () => buildSchedule(["2027-03-28"], 150, 240, undefined, now)
  ]) assert.throws(input);
});

test("free hours exclude appointments and elapsed time without mutating the source", () => {
  const slot = { id: "s1", ...range("2026-10-20", 540, 1020) };
  const appointments = [range("2026-10-20", 780, 840), range("2026-10-20", 600, 660)];
  const free = freeRanges(slot, appointments, now);
  assert.deepEqual(Array.from(free, r => [new Date(r.startsAt).getHours(), new Date(r.endsAt).getHours()]), [[9, 10], [11, 13], [14, 17]]);
  assert.equal(slot.startsAt, localDate("2026-10-20", 540).toISOString());
  assert.equal(freeRanges(slot, appointments, localDate("2026-10-20", 1021)).length, 0);
});

test("booking choices use 15 minute steps and fit the entire service into one free interval", () => {
  const slots = [
    { id: "s1", ...range("2026-10-20", 540, 600) },
    { id: "s1", ...range("2026-10-20", 660, 720) }
  ];
  const times = bookableTimes(slots, "2026-10-20", 45, now);
  assert.deepEqual(Array.from(times, time => new Date(time.startsAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })), ["09:00", "09:15", "11:00", "11:15"]);
  assert.equal(bookableTimes(slots, "2026-10-21", 30, now).length, 0);
  assert.equal(bookableTimes(slots, "2026-10-20", 90, now).length, 0);
  const afterStart = bookableTimes(slots, "2026-10-20", 30, localDate("2026-10-20", 547));
  assert.equal(new Date(afterStart[0].startsAt).getMinutes(), 15);
});

test("midnight ends the correct day; multi-day ranges retain bookable overnight visits", () => {
  const slot = { id: "night", ...range("2026-10-20", 1380, 1500) };
  assert.equal(intersectsDay(slot, "2026-10-20"), true);
  assert.equal(intersectsDay(slot, "2026-10-21"), true);
  assert.equal(bookableTimes([slot], "2026-10-21", 60, now).length, 1);
  const midnight = range("2026-10-20", 540, 1440);
  assert.equal(intersectsDay(midnight, "2026-10-21"), false);
});

test("multiple days share only hours that fit the full requested duration on every date", () => {
  const slots = [
    { id: "day1", ...range("2026-10-23", 540, 720) },
    { id: "day2", ...range("2026-10-26", 600, 690) }
  ];
  const common = commonBookableTimes(slots, ["2026-10-26", "2026-10-23", "2026-10-23"], 60, now);
  assert.deepEqual(Array.from(common, choice => choice.time), ["10:00", "10:15", "10:30"]);
  assert.deepEqual(Array.from(common[0].bookings, booking => booking.slotId), ["day1", "day2"]);
  assert.equal(common[0].bookings[0].startsAt, "2026-10-23T08:00:00.000Z");
  assert.equal(common[0].bookings[1].startsAt, "2026-10-26T09:00:00.000Z");
  assert.equal(commonBookableTimes(slots, ["2026-10-23", "2026-10-26"], 120, now).length, 0);
  assert.equal(commonBookableTimes(slots, [], 30, now).length, 0);
});

test("longer care scales the selected offer's rate and rounds once to cents", () => {
  assert.equal(bookingPrice(3000, 30, 60), 6000);
  assert.equal(bookingPrice(3000, 30, 90), 9000);
  assert.equal(bookingPrice(1001, 30, 45), 1502);
  assert.equal(bookingPrice(0, 30, 120), 0);
});

test("multi-day care never overlaps itself across the spring clock change", () => {
  const slot = { id: "long", startsAt: localDate("2027-03-27").toISOString(), endsAt: localDate("2027-03-30").toISOString() };
  const times = commonBookableTimes([slot], ["2027-03-27", "2027-03-28"], 1440, now);
  assert.equal(times.some(choice => choice.time === "09:00"), false);
});
