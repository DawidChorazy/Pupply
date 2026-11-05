const { chromium } = require("playwright");
const assert = require("node:assert/strict");
process.env.TZ = "Europe/Warsaw";
const baseUrl = process.env.PUPPLY_WEB_URL || "http://localhost:8081";
const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(0, 0, 0, 0);
const iso = (day, minutes) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60).toISOString();
const label = day => `${day.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })} ${day.getFullYear()}`;
const service = { id: "service1", sitterProfileId: "sitter1", type: "DOG_WALK", durationMinutes: 30, priceCents: 3000, currency: "PLN", isActive: true };
const initial = { id: "slot1", sitterProfileId: "sitter1", startsAt: iso(date, 540), endsAt: iso(date, 720), bookings: [
  { id: "b1", startsAt: iso(date, 600), endsAt: iso(date, 660), status: "ACCEPTED", pet: { name: "Figa" }, sitterService: { type: "DOG_WALK" } }
] };
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Warsaw" });
    page.setDefaultTimeout(20_000);
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    let slots = [structuredClone(initial)], failBatch = true, missing = false, conflictBooking = true, batchCalls = 0, payload, failBookingBatch = true, bookedBatch = [];
    const batches = [];
    let dropResponse = false, singleWrites = 0;
    const singleKeys = [], operationResults = new Map();
    await page.addInitScript(() => {
      localStorage.setItem("auth_token", "test"); localStorage.setItem("refresh_token", "test-refresh"); localStorage.setItem("account_id", "u1");
    });
    await page.route("**/api/**", async route => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname;
      let status = 200, body = {};
      if (path === "/api/sitters/me") {
        status = missing ? 404 : 200;
        body = { profile: { id: "sitter1", accountId: "u1", bio: "Opiekun z doświadczeniem w opiece nad psami", city: "Warszawa", region: "mazowieckie", latitude: 52.23, longitude: 21.01, serviceRadiusKm: 10, isActive: true, services: [service], availability: slots } };
      } else if (path === "/api/sitters/me/schedule") {
        status = missing ? 404 : 200;
        const from = Date.parse(url.searchParams.get("from")), to = Date.parse(url.searchParams.get("to"));
        body = { slots: slots.filter(slot => Date.parse(slot.startsAt) < to && Date.parse(slot.endsAt) > from), nextCursor: null };
      } else if (path === "/api/sitters/me/availability/batch") {
        batchCalls++; payload = req.postDataJSON();
        if (failBatch) { status = 503; body = { message: "Nie udało się zapisać grafiku." }; }
        else { const added = payload.slots.map((slot, i) => ({ ...slot, id: `new${batchCalls}-${i}`, sitterProfileId: "sitter1", bookings: [] })); slots.push(...added); batches.push(added); status = 201; body = { slots: added }; }
      } else if (path.startsWith("/api/sitters/me/availability/") && req.method() === "PATCH") {
        const id = path.split("/").at(-1), input = req.postDataJSON(), slot = slots.find(slot => slot.id === id);
        if (slot.bookings.some(b => Date.parse(b.startsAt) < Date.parse(input.startsAt) || Date.parse(b.endsAt) > Date.parse(input.endsAt))) { status = 409; body = { message: "Nowe godziny muszą obejmować wszystkie zapisane wizyty." }; }
        else { Object.assign(slot, input); body = { slot }; }
      } else if (path.startsWith("/api/sitters/me/availability/") && req.method() === "DELETE") {
        slots = slots.filter(slot => slot.id !== path.split("/").at(-1));
        await route.fulfill({ status: 204 }); return;
      } else if (path === "/api/sitters/sitter1/availability") {
        body = { service, availability: conflictBooking ? [
          { ...initial, bookings: undefined, endsAt: iso(date, 600) }, { ...initial, bookings: undefined, startsAt: iso(date, 660) }
        ] : [{ ...initial, bookings: undefined, startsAt: iso(date, 660) }] };
        const next = new Date(date); next.setDate(next.getDate() + 1);
        body.availability.push({ id: "next-slot", sitterProfileId: "sitter1", startsAt: iso(next, 570), endsAt: iso(next, 720) });
        const from = Date.parse(url.searchParams.get("from")), to = Date.parse(url.searchParams.get("to"));
        body.availability = body.availability.filter(slot => Date.parse(slot.startsAt) < to && Date.parse(slot.endsAt) > from);
        body.nextCursor = null;
      } else if (path === "/api/pets") body = { pets: [{ id: "p1", name: "Figa", gender: "FEMALE" }] };
      else if (path === "/api/bookings/batch" && req.method() === "POST") {
        payload = req.postDataJSON();
        if (failBookingBatch) { failBookingBatch = false; status = 409; body = { error: "SLOT_ALREADY_BOOKED", message: "Termin zajęty" }; }
        else { bookedBatch = payload.slots; status = 201; body = { bookings: payload.slots, totalPriceCents: payload.expectedPriceCents * payload.slots.length }; }
      } else if (path.startsWith("/api/bookings/operations/")) {
        const saved = operationResults.get(path.split("/").at(-1));
        if (saved) body = { bookings: [saved.booking], totalPriceCents: 3000 };
        else { status = 404; body = { error: "BOOKING_OPERATION_NOT_FOUND" }; }
      } else if (path === "/api/bookings" && req.method() === "POST") {
        payload = req.postDataJSON();
        const key = req.headers()["idempotency-key"];
        assert.match(key, /^[0-9a-f]{32}$/);
        singleKeys.push(key);
        if (operationResults.has(key)) { status = 201; body = operationResults.get(key); }
        else if (conflictBooking) { conflictBooking = false; status = 409; body = { error: "SLOT_ALREADY_BOOKED", message: "Termin zajęty" }; }
        else {
          singleWrites++; status = 201; body = { booking: { id: `booked-${singleWrites}`, ...payload } };
          operationResults.set(key, body);
          if (dropResponse) { dropResponse = false; await route.abort("connectionreset"); return; }
        }
      } else if (path === "/api/bookings") body = { items: [], pagination: { page: 1, pageSize: 20, total: 0 } };
      else if (path === "/api/notifications/unread-count") body = { count: 0 };
      else if (path === "/api/gamification/quests") body = { quests: [], userPoints: 0 };
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    });
    const selectDay = async day => {
      // Navigate in both directions, including across a year boundary.
      const target = day.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
      await page.getByRole("heading").first().waitFor();
      for (let n = 0; n < 15; n++) {
        const current = await page.getByRole("heading").first().innerText();
        if (current.toLowerCase() === target.toLowerCase()) break;
        const month = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleDateString("pl-PL", { month: "long" })).findIndex(name => current.toLowerCase().startsWith(name));
        const currentMonth = Number(current.match(/\d{4}/)[0]) * 12 + month;
        const targetMonth = day.getFullYear() * 12 + day.getMonth();
        await page.getByRole("button", { name: targetMonth < currentMonth ? "Poprzedni miesiąc" : "Następny miesiąc", exact: true }).click();
        await page.getByRole("heading", { name: current, exact: true }).waitFor({ state: "hidden" });
      }
      await page.getByRole("button", { name: label(day), exact: false }).click();
    };
    await page.goto(`${baseUrl}/marketplace/schedule`);
    await page.getByText("Twój grafik", { exact: true }).waitFor();
    await selectDay(date);
    await page.getByRole("button", { name: "Rezerwacja Figa, 10:00–11:00", exact: true }).waitFor();
    await page.getByText("Wolne: 09:00–10:00, 11:00–12:00", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Usuń godziny 09:00–12:00", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Edytuj godziny 09:00–12:00", exact: true }).click();
    await page.getByRole("button", { name: "Koniec pracy: 12:00", exact: true }).click();
    await page.getByRole("button", { name: "10:30", exact: true }).click();
    await page.getByRole("button", { name: "Zapisz godziny", exact: true }).click();
    await page.getByText("Nowe godziny muszą obejmować wszystkie zapisane wizyty.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Anuluj edycję", exact: true }).click();
    const next = new Date(date); next.setDate(next.getDate() + 1);
    await selectDay(next);
    await page.getByText("Cały dzień 09:00–17:00", { exact: true }).click();
    await page.getByRole("switch", { name: "Dodaj przerwę", exact: true }).click();
    await page.getByRole("switch", { name: "Powtarzaj grafik", exact: true }).click();
    await page.getByRole("button", { name: "Dodaj grafik · 10 dni", exact: true }).click();
    await page.getByText("Nie udało się zapisać grafiku.", { exact: true }).waitFor();
    assert.equal(slots.length, 1);
    failBatch = false;
    await page.getByRole("button", { name: "Dodaj grafik · 10 dni", exact: true }).click();
    await page.getByText("Zapisano grafik:", { exact: false }).waitFor();
    assert.equal(batches[0].length, 20);
    for (const slot of batches[0]) {
      assert.ok([9, 13].includes(new Date(slot.startsAt).getHours()));
      assert.ok([12, 17].includes(new Date(slot.endsAt).getHours()));
    }
    await page.getByRole("button", { name: "Dodaj grafik · 10 dni", exact: true }).click();
    await page.getByText("nakłada się na zapisane godziny", { exact: false }).waitFor();
    assert.equal(batchCalls, 2);
    await page.getByRole("switch", { name: "Powtarzaj grafik", exact: true }).click();
    await page.getByRole("button", { name: "Wyczyść wybór", exact: true }).click();
    const extra1 = new Date(date); extra1.setDate(extra1.getDate() + 20);
    const extra2 = new Date(date); extra2.setDate(extra2.getDate() + 23);
    await selectDay(extra1); await selectDay(extra2);
    assert.equal(await page.getByRole("button", { name: label(extra1), exact: false }).getAttribute("aria-pressed"), "true");
    assert.equal(await page.getByRole("button", { name: label(extra2), exact: false }).getAttribute("aria-pressed"), "true");
    await page.getByText("Rano 08:00–12:00", { exact: true }).click();
    await page.getByRole("button", { name: "Dodaj grafik · 2 dni", exact: true }).click();
    await page.getByText("Zapisano grafik: 2 dni", { exact: false }).waitFor();
    assert.equal(batches[1].length, 2);
    assert.equal(batches[1][0].startsAt, iso(extra1, 480));
    assert.equal(batches[1][1].startsAt, iso(extra2, 480));
    await selectDay(extra1);
    assert.equal(await page.getByRole("button", { name: label(extra1), exact: false }).getAttribute("aria-pressed"), "false");
    await page.getByRole("button", { name: "Dodaj grafik · 1 dzień", exact: true }).waitFor();
    await page.reload();
    await selectDay(date);
    assert.ok(await page.getByRole("button", { name: "Rezerwacja Figa", exact: false }).count());
    await page.screenshot({ path: "/tmp/pupply-calendar-mobile.png" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: "/tmp/pupply-calendar-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    await page.goto(`${baseUrl}/marketplace/book?sitterId=sitter1&sitterServiceId=service1&sitterName=Anna`);
    await page.getByRole("button", { name: "Termin 09:30–10:00", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Termin 10:00–10:30", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Termin 09:45–10:15", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Wyślij prośbę o rezerwację", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Termin 09:30–10:00", exact: true }).click();
    await page.getByRole("button", { name: "Wyślij prośbę o rezerwację", exact: true }).click();
    await page.getByText("Kalendarz został odświeżony", { exact: false }).waitFor();
    assert.equal(payload.startsAt, iso(date, 570)); assert.equal(payload.availabilitySlotId, "slot1");
    assert.equal(await page.getByRole("button", { name: "Termin 09:30–10:00", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Termin 11:00–11:30", exact: true }).click();
    await page.screenshot({ path: "/tmp/pupply-booking-calendar-mobile.png" });
    await page.getByRole("button", { name: "Wyślij prośbę o rezerwację", exact: true }).click();
    await page.waitForURL("**/marketplace/bookings");
    assert.equal(payload.startsAt, iso(date, 660));
    assert.equal(payload.durationMinutes, 30); assert.equal(payload.expectedPriceCents, 3000);
    await page.goto(`${baseUrl}/marketplace/book?sitterId=sitter1&sitterServiceId=service1&sitterName=Anna`);
    await page.getByRole("button", { name: "Czas opieki: 1 godz.", exact: true }).click();
    await selectDay(next);
    await page.getByText("Łącznie: 120.00 zł", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Termin 09:30–10:30", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Termin 11:00–12:00", exact: true }).click();
    await page.getByRole("button", { name: "Wyślij prośbę o rezerwację", exact: true }).click();
    await page.getByText("Nie zapisano nowych rezerwacji", { exact: false }).waitFor();
    assert.equal(bookedBatch.length, 0);
    assert.equal(payload.durationMinutes, 60); assert.equal(payload.expectedPriceCents, 6000);
    assert.equal(payload.slots.length, 2);
    assert.equal(await page.getByRole("button", { name: "Wyślij prośbę o rezerwację", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Termin 11:00–12:00", exact: true }).click();
    await page.screenshot({ path: "/tmp/pupply-multiday-booking-mobile.png" });
    await page.getByRole("button", { name: "Wyślij prośbę o rezerwację", exact: true }).click();
    await page.waitForURL("**/marketplace/bookings");
    assert.equal(bookedBatch.length, 2);
    assert.equal(bookedBatch[0].startsAt, iso(date, 660)); assert.equal(bookedBatch[1].startsAt, iso(next, 660));
    // Lost response: retry sends the same operation key and does not write twice.
    await page.goto(`${baseUrl}/marketplace/book?sitterId=sitter1&sitterServiceId=service1&sitterName=Anna`);
    await page.getByRole("button", { name: "Termin 11:00–11:30", exact: true }).click();
    dropResponse = true;
    const beforeRetry = singleWrites;
    await page.getByRole("button", { name: "Wyślij prośbę o rezerwację", exact: true }).click();
    await page.getByText("Nie udało się utworzyć rezerwacji", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Wyślij prośbę o rezerwację", exact: true }).click();
    await page.waitForURL("**/marketplace/bookings");
    assert.equal(singleKeys.at(-1), singleKeys.at(-2)); assert.equal(singleWrites, beforeRetry + 1);
    // Reload after a lost response recovers the committed operation from the API.
    await page.goto(`${baseUrl}/marketplace/book?sitterId=sitter1&sitterServiceId=service1&sitterName=Anna`);
    await page.getByRole("button", { name: "Termin 11:30–12:00", exact: true }).click();
    dropResponse = true;
    const beforeReload = singleWrites;
    await page.getByRole("button", { name: "Wyślij prośbę o rezerwację", exact: true }).click();
    await page.getByText("Nie udało się utworzyć rezerwacji", { exact: true }).waitFor();
    await page.reload(); await page.waitForURL("**/marketplace/bookings");
    assert.equal(singleWrites, beforeReload + 1);
    // Cancelled visits no longer hide the remove action in the owner's calendar.
    slots[0].bookings[0].status = "CANCELLED";
    await page.goto(`${baseUrl}/marketplace/schedule`);
    await selectDay(date);
    await page.getByRole("button", { name: "Usuń godziny 09:00–12:00", exact: true }).click();
    await page.getByRole("button", { name: "Usuń przedział", exact: true }).click();
    await page.getByText("Te godziny nie są już dostępne", { exact: false }).waitFor();
    missing = true;
    await page.goto(`${baseUrl}/marketplace/schedule`);
    await page.getByRole("button", { name: "Utwórz profil opiekuna", exact: true }).waitFor();
    assert.deepEqual(pageErrors, []);
    console.log("Calendar browser checks passed: protected visits, time picker, weekly schedule with breaks, failed save/retry, overlap, reload, mobile/desktop, exact booking time, proportional pricing, multiple selected dates, extended duration, atomic batch conflicts, monthly API loading, cancelled visits, response-loss retries and recovery after reload.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
