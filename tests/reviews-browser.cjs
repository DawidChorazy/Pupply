const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { chromium } = require("playwright");
const { PrismaClient } = require("../backend/node_modules/@prisma/client");
const { assertTestDatabase } = require("../backend/dist/utils/test-database");

assertTestDatabase(process.env.DATABASE_URL);
const base = process.env.PUPPLY_WEB_URL || "http://localhost:8081";
const api = process.env.PUPPLY_REVIEW_TEST_API_URL || "http://127.0.0.1:4001/api";
assert.equal(new URL(api).port, "4001", "Use an isolated test API.");
const db = new PrismaClient(), ids = [];
const visibleText = (page, text) => page.getByText(text, { exact: true }).filter({ visible: true });
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"],
    ...(process.env.PUPPLY_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PUPPLY_CHROMIUM_EXECUTABLE } : {}) });
  const errors = [];
  try {
    async function register(fullName) {
      const password = "Strong@Test1";
      const response = await fetch(`${api}/auth/register/user`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `${randomUUID()}@review-browser.test`, fullName, phone: "+48123456789", password, confirmPassword: password }) });
      assert.equal(response.status, 201);
      const auth = await response.json(); ids.push(auth.account.id);
      await db.account.update({ where: { id: auth.account.id }, data: { emailVerifiedAt: new Date() } });
      return auth;
    }
    const owner = await register("Anna Kowalska"), sitter = await register("Piotr Spacerowicz"), stranger = await register("Obca Osoba");
    const profile = await db.sitterProfile.create({ data: { accountId: sitter.account.id, city: "Warszawa", latitude: 52, longitude: 21,
      bio: "Spacery w spokojnym tempie i stały kontakt z właścicielem.", services: { create: { type: "DOG_WALK", durationMinutes: 30, priceCents: 3000 } } }, include: { services: true } });
    const now = Date.now();
    const slot = await db.availabilitySlot.create({ data: { sitterProfileId: profile.id, startsAt: new Date(now - 3 * 3_600_000), endsAt: new Date(now - 30 * 60_000) } });
    await db.availabilitySlot.create({ data: { sitterProfileId: profile.id, startsAt: new Date(now + 86_400_000), endsAt: new Date(now + 90_000_000) } });
    const pet = await db.pet.create({ data: { accountId: owner.account.id, name: "Prywatny pupil", gender: "FEMALE" } });
    const booking = () => db.booking.create({ data: { ownerAccountId: owner.account.id, sitterAccountId: sitter.account.id, petId: pet.id,
      sitterServiceId: profile.services[0].id, availabilitySlotId: slot.id, status: "COMPLETED", priceCents: 3000,
      startsAt: new Date(now - 2 * 3_600_000), endsAt: new Date(now - 3_600_000), expiresAt: new Date(now - 3_600_000) } });
    const first = await booking();
    let lostResponseBooking;
    async function pageFor(auth) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      if (auth) await context.addInitScript(auth => {
        localStorage.setItem("auth_token", auth.accessToken); localStorage.setItem("refresh_token", auth.refreshToken); localStorage.setItem("account_id", auth.account.id);
      }, auth);
      await context.route("**/api/**", async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname === "/api/locations/search") return route.fulfill({ json: { items: [{ id: "warsaw", city: "Warszawa", region: "mazowieckie", county: "Warszawa", latitude: 52, longitude: 21 }] } });
        if (req.method() === "POST" && url.pathname === `/api/bookings/${lostResponseBooking}/review`) {
          lostResponseBooking = undefined;
          const response = await route.fetch({ url: `${api}${url.pathname.slice(4)}${url.search}` });
          assert.equal(response.status(), 201);
          return route.abort("failed"); // Commit succeeded, but its response never reached the owner.
        }
        return route.continue({ url: `${api}${url.pathname.slice(4)}${url.search}` });
      });
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      page.on("pageerror", error => errors.push(error.message));
      return page;
    }
    const page = await pageFor(owner);
    await page.goto(`${base}/marketplace/bookings`);
    await page.getByRole("button", { name: "Oceń spacerowicza", exact: true }).click();
    await visibleText(page, "Ocena spacerowicza").waitFor();
    const publish = page.getByRole("button", { name: "Opublikuj ocenę", exact: true });
    assert.equal(await publish.isDisabled(), true);
    for (const [label, score] of [["Punktualność", 5], ["Kontakt", 4], ["Jakość spaceru", 3]]) {
      await page.getByRole("button", { name: `${label}: ${score} z 5`, exact: true }).click();
    }
    await page.getByLabel("Opinia publiczna", { exact: true }).fill("Dobry kontakt, pies wrócił zadowolony.");
    await visibleText(page, "Średnia: 4,00/5").waitFor();
    await publish.click();
    await visibleText(page, "Opublikowano ocenę spacerowicza.").waitFor();
    assert.equal(await db.sitterReview.count({ where: { bookingId: first.id } }), 1);
    await page.reload(); await visibleText(page, "Zapisana ocena").waitFor();
    assert.equal(await publish.count(), 0);
    await page.screenshot({ path: "/tmp/pupply-review-mobile.png", fullPage: true });
    await page.goto(`${base}/marketplace/bookings`);
    await visibleText(page, "Twoja ocena").waitFor();
    assert.equal(await page.getByRole("button", { name: "Oceń spacerowicza", exact: true }).count(), 0);

    const second = await booking(); lostResponseBooking = second.id;
    await page.goto(`${base}/marketplace/review?bookingId=${second.id}`);
    for (const label of ["Punktualność", "Kontakt", "Jakość spaceru"]) await page.getByRole("button", { name: `${label}: 4 z 5`, exact: true }).click();
    await page.getByLabel("Opinia publiczna", { exact: true }).fill("Drugi spacer też udany.");
    await publish.click();
    await visibleText(page, "Nie udało się potwierdzić zapisu. Możesz bezpiecznie ponowić publikację.").waitFor();
    assert.equal(await page.getByLabel("Opinia publiczna", { exact: true }).inputValue(), "Drugi spacer też udany.");
    await publish.click(); await visibleText(page, "Opublikowano ocenę spacerowicza.").waitFor();
    assert.equal(await db.sitterReview.count({ where: { bookingId: second.id } }), 1);

    const anonymous = await pageFor();
    await anonymous.goto(`${base}/marketplace/reviews?sitterId=${profile.id}`);
    await visibleText(anonymous, "4,00/5 · Opinie: 2").waitFor();
    await visibleText(anonymous, "Anna K.").first().waitFor();
    await visibleText(anonymous, "Dobry kontakt, pies wrócił zadowolony.").waitFor();
    const text = await anonymous.locator("body").innerText();
    for (const privateValue of [first.id, owner.account.id, "Prywatny pupil", "Anna Kowalska", "review-browser.test"]) assert.equal(text.includes(privateValue), false);
    await anonymous.screenshot({ path: "/tmp/pupply-reviews-public.png", fullPage: true });
    await anonymous.goto(`${base}/marketplace/sitters`);
    await anonymous.getByLabel("Miejscowość", { exact: true }).fill("Warszawa");
    await anonymous.getByRole("button", { name: "Warszawa, województwo mazowieckie, Warszawa", exact: true }).click();
    await anonymous.getByRole("button", { name: "Od 4,5 ★", exact: true }).click();
    await visibleText(anonymous, "Szukaj opiekunów").click(); await visibleText(anonymous, "Brak wyników").waitFor();
    await anonymous.getByRole("button", { name: "Od 4 ★", exact: true }).click();
    await visibleText(anonymous, "Szukaj opiekunów").click();
    await anonymous.getByRole("button", { name: "Opinie o Piotr Spacerowicz", exact: true }).click();
    await visibleText(anonymous, "4,00/5 · Opinie: 2").waitFor();

    const outsider = await pageFor(stranger);
    await outsider.goto(`${base}/marketplace/review?bookingId=${first.id}`);
    await outsider.getByRole("alert").waitFor();
    assert.equal(await outsider.getByRole("button", { name: "Opublikuj ocenę", exact: true }).count(), 0);
    const walker = await pageFor(sitter);
    await walker.goto(`${base}/marketplace/bookings`); await visibleText(walker, "Ocena właściciela").first().waitFor();
    assert.equal(await walker.getByRole("button", { name: "Oceń spacerowicza", exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log("Review browser checks passed: completed booking entry, required criteria, publication, reload, saved booking, lost response/retry, public reviews, privacy, search filter and stranger/sitter restrictions.");
  } finally {
    await browser.close();
    await db.booking.deleteMany({ where: { ownerAccountId: { in: ids } } });
    await db.account.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
