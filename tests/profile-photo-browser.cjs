const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { chromium } = require("playwright");
const { PrismaClient } = require("../backend/node_modules/@prisma/client");
const { assertTestDatabase } = require("../backend/dist/utils/test-database");

assertTestDatabase(process.env.DATABASE_URL);
const base = process.env.PUPPLY_WEB_URL || "http://localhost:8081";
const api = process.env.PUPPLY_PHOTO_TEST_API_URL || "http://127.0.0.1:4001/api";
assert.equal(new URL(api).port, "4001", "Use an isolated test API.");
const db = new PrismaClient();
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"],
    ...(process.env.PUPPLY_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PUPPLY_CHROMIUM_EXECUTABLE } : {}) });
  let accountId;
  try {
    const password = "Strong@Test1";
    const registration = await fetch(`${api}/auth/register/user`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `${randomUUID()}@photo-browser.test`, fullName: "Anna ze zdjęciem", phone: "+48123456789", password, confirmPassword: password }) });
    assert.equal(registration.status, 201);
    const auth = await registration.json(); accountId = auth.account.id;
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(20000);
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(auth => { localStorage.setItem("auth_token", auth.accessToken); localStorage.setItem("refresh_token", auth.refreshToken); localStorage.setItem("account_id", auth.account.id); }, auth);
    let failSave = false, uploads = 0;
    await page.route("**/api/**", async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.pathname === "/api/users/me" && req.method() === "PATCH" && failSave) {
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Testowy błąd zapisu zdjęcia" }) });
      }
      if (url.pathname === "/api/uploads/profile-photo") uploads++;
      return route.continue({ url: `${api}${url.pathname.slice(4)}${url.search}` });
    });
    await page.goto(`${base}/account/profile`);
    await page.getByText("Anna ze zdjęciem", { exact: true }).first().waitFor();
    const png = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement("canvas"); canvas.width = 160; canvas.height = 120;
      const context = canvas.getContext("2d"); context.fillStyle = "#D35400"; context.fillRect(0, 0, 160, 120);
      return canvas.toDataURL("image/png").split(",")[1];
    }), "base64");
    async function choose(name) {
      const choosing = page.waitForEvent("filechooser");
      await page.getByRole("button", { name, exact: true }).click();
      const picker = await choosing;
      await picker.setFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
    }
    await choose("Dodaj zdjęcie");
    await page.getByText("Zapisano zdjęcie profilowe.", { exact: true }).waitFor();
    await page.getByLabel("Zdjęcie profilowe", { exact: true }).waitFor();
    const profile = await db.userProfile.findUniqueOrThrow({ where: { accountId } });
    assert.ok(profile.photoKey.startsWith(`users/${accountId}/`));
    assert.equal(await db.sitterProfile.count({ where: { accountId } }), 0, "A sitter offer must not be required to save an avatar.");
    assert.equal(uploads, 1);
    await page.reload();
    await page.getByLabel("Zdjęcie profilowe", { exact: true }).waitFor();
    assert.equal((await db.userProfile.findUniqueOrThrow({ where: { accountId } })).photoKey, profile.photoKey);
    assert.equal(uploads, 1);
    failSave = true;
    await choose("Zmień zdjęcie");
    await page.getByText("Testowy błąd zapisu zdjęcia", { exact: true }).waitFor();
    await page.getByLabel("Zdjęcie profilowe", { exact: true }).waitFor();
    assert.equal((await db.userProfile.findUniqueOrThrow({ where: { accountId } })).photoKey, profile.photoKey);
    failSave = false;
    await choose("Zmień zdjęcie");
    await page.getByText("Zapisano zdjęcie profilowe.", { exact: true }).waitFor();
    const changed = await db.userProfile.findUniqueOrThrow({ where: { accountId } });
    assert.notEqual(changed.photoKey, profile.photoKey);
    await page.screenshot({ path: "/tmp/pupply-profile-photo.png", fullPage: true });
    await page.getByRole("button", { name: "Usuń", exact: true }).click();
    await page.getByText("Usunięto zdjęcie profilowe.", { exact: true }).waitFor();
    assert.equal((await db.userProfile.findUniqueOrThrow({ where: { accountId } })).photoKey, null);
    await page.reload();
    await page.getByRole("button", { name: "Dodaj zdjęcie", exact: true }).waitFor();
    assert.equal(await page.getByLabel("Zdjęcie profilowe", { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log("Profile photo browser checks passed: real file selection, upload, automatic save, reload, failure recovery, replacement and removal.");
  } finally {
    await browser.close();
    if (accountId) await db.account.deleteMany({ where: { id: accountId } });
    await db.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
