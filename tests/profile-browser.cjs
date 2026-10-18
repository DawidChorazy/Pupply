const { Buffer } = require("node:buffer");
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseUrl = process.env.PUPPLY_WEB_URL || "http://localhost:8081";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let profile = {
    id: "u1",
    email: "anna@example.test",
    fullName: "Anna Kowalska",
    phone: "+48123456789",
    birthDate: "2000-02-29T00:00:00Z",
    emailVerifiedAt: null
  };
  let pets = [];
  const documentsByPet = new Map();
  let nextDocument = 0;
  let petsFail = false,
    profileFail = false,
    saveFail = false,
    expired = false;
  const patches = [];
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "test");
    localStorage.setItem("refresh_token", "refresh");
    localStorage.setItem("account_id", "u1");
  });
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    let body = {},
      status = 200;
    if (expired) {
      status = 401;
    } else if (path === "/api/auth/login") {
      body = {
        accessToken: "second",
        refreshToken: "second-refresh",
        account: { id: "u2", role: "USER", email: profile.email }
      };
    } else if (path === "/api/users/me") {
      if (profileFail) status = 503;
      else if (req.method() === "PATCH") {
        if (saveFail) status = 503;
        else {
          const patch = req.postDataJSON();
          patches.push(patch);
          profile = { ...profile, ...patch };
        }
      }
      body = { profile };
    } else if (path === "/api/pets") {
      status = petsFail ? 503 : 200;
      if (req.method() === "POST") {
        const pet = {
          id: "created",
          accountId: "u1",
          age: null,
          breed: null,
          weight: null,
          photoUrl: null,
          illnesses: null,
          allergies: null,
          vaccines: null,
          vet: null,
          notes: null,
          ...req.postDataJSON()
        };
        pets.push(pet);
        body = { pet };
      } else body = { pets };
    } else if (/^\/api\/pets\/[^/]+\/documents/.test(path)) {
      const parts = path.split("/");
      const petId = parts[3], documentId = parts[5];
      const documents = documentsByPet.get(petId) || [];
      if (documentId === "upload" && req.method() === "POST") {
        const input = req.postDataJSON();
        const document = { id: `doc-${++nextDocument}`, petId, ...input, expiresAt: null, reminderDaysBefore: 7, uploadedAt: null };
        documents.push(document); documentsByPet.set(petId, documents);
        status = 201; body = { document, uploadUrl: `${baseUrl}/api/test-pdf-upload` };
      } else if (documentId && req.method() === "PATCH") {
        const document = documents.find(item => item.id === documentId);
        Object.assign(document, req.postDataJSON(), { uploadedAt: new Date().toISOString() });
        body = { document };
      } else if (documentId && req.method() === "DELETE") {
        documentsByPet.set(petId, documents.filter(item => item.id !== documentId)); status = 204;
      } else body = { documents: documents.filter(item => item.uploadedAt) };
    } else if (path.startsWith("/api/pets/")) {
      const id = path.split("/").pop();
      if (req.method() === "DELETE") {
        pets = pets.filter((p) => p.id !== id);
        status = 204;
      } else {
        if (req.method() === "PATCH")
          pets = pets.map((p) =>
            p.id === id ? { ...p, ...req.postDataJSON() } : p
          );
        body = { pet: pets.find((p) => p.id === id) };
      }
    } else if (path === "/api/auth/logout") {
      return route.abort();
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: status === 204 ? "" : JSON.stringify(body)
    });
  });
  await page.goto(`${baseUrl}/mainScreen/ProfileScreen`);
  await page
    .getByText("anna@example.test", { exact: true })
    .waitFor({ timeout: 120000 });
  await page.getByText("Dodaj pierwszego zwierzaka", { exact: true }).waitFor();
  await page.getByText("Edytuj dane", { exact: true }).click();
  await page.getByLabel("Telefon", { exact: true }).fill("bad");
  await page.getByText("Zapisz", { exact: true }).click();
  await page.getByText("Telefon musi zawierać", { exact: false }).waitFor();
  await page.getByLabel("Telefon", { exact: true }).fill("+48987654321");
  await page
    .getByLabel("Data urodzenia (RRRR-MM-DD)", { exact: true })
    .fill("");
  saveFail = true;
  await page.getByText("Zapisz", { exact: true }).click();
  await page
    .getByText("Nie udało się zapisać danych.", { exact: false })
    .waitFor();
  assert.equal(
    await page.getByLabel("Telefon", { exact: true }).inputValue(),
    "+48987654321"
  );
  saveFail = false;
  await page.getByText("Zapisz", { exact: true }).click();
  await page.getByText("Zapisano dane konta.", { exact: true }).waitFor();
  assert.equal(patches[0].birthDate, null);
  await page.getByText("Edytuj dane", { exact: true }).click();
  await page.getByLabel("Imię i nazwisko", { exact: true }).fill("Zmiana");
  await page.getByText("Anuluj", { exact: true }).click();
  assert.equal(patches.length, 1);
  await page.getByText("Dodaj pierwszego zwierzaka", { exact: true }).click();
  await page.getByPlaceholder("Imię", { exact: true }).fill("Burek");
  await page.getByText("Samiec", { exact: true }).click();
  await page.getByText("Zapisz zwierzaka", { exact: true }).click();
  await page.getByText("Zwierzak został dodany", { exact: true }).waitFor();
  await page.goBack();
  await page.getByText("Burek", { exact: true }).waitFor();
  await page.getByText("Liczba pupili: 1", { exact: true }).waitFor();
  await page.screenshot({
    path: "/tmp/pupply-profile-mobile.png",
    fullPage: true
  });
  pets.push({ ...pets[0], id: "p2", name: "Luna", gender: "FEMALE" });
  await page.reload();
  await page.getByText("Liczba pupili: 2", { exact: true }).waitFor();
  await page.getByText("Burek", { exact: true }).click();
  await page.getByText("Edytuj", { exact: true }).waitFor();
  assert.equal(await page.getByText("Usuń pupila", { exact: true }).count(), 0);
  assert.equal(await page.getByPlaceholder("Imię", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Dodaj PDF", { exact: true }).count(), 0);
  await page.getByText("Edytuj", { exact: true }).click();
  await page.getByPlaceholder("Imię", { exact: true }).fill("Niezapisana zmiana");
  await page.getByText("Anuluj", { exact: true }).click();
  assert.equal(await page.getByText("Niezapisana zmiana", { exact: true }).count(), 0);
  assert.equal(await page.getByPlaceholder("Imię", { exact: true }).count(), 0);
  await page.getByText("Edytuj", { exact: true }).click();
  await page.getByPlaceholder("Imię", { exact: true }).fill("Burek II");
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText("Dodaj PDF", { exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "wyniki-badania.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await page.getByText("wyniki-badania.pdf - Otwórz PDF", { exact: true }).waitFor();
  await page.getByPlaceholder("Ważny do DD.MM.YYYY").fill("31.02.2027");
  await page.getByText("Zapisz zmiany", { exact: true }).click();
  await page.getByText("ma nieprawidłową datę", { exact: false }).waitFor();
  await page.getByPlaceholder("Ważny do DD.MM.YYYY").fill("31.12.2027");
  await page.getByText("Zapisz zmiany", { exact: true }).click();
  await page.getByText("Zapisano zmiany", { exact: true }).waitFor();
  await page.goBack();
  await page.getByText("Burek II", { exact: true }).waitFor();
  await page.getByText("Burek II", { exact: true }).click();
  await page.getByText("wyniki-badania.pdf - Otwórz PDF", { exact: true }).waitFor();
  await page.getByText("Edytuj", { exact: true }).click();
  assert.equal(await page.getByPlaceholder("Ważny do DD.MM.YYYY").inputValue(), "31.12.2027");
  await page.getByText("Usuń pupila", { exact: true }).waitFor();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByText("Usuń pupila", { exact: true }).click();
  assert.equal(pets.length, 2);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByText("Usuń pupila", { exact: true }).click();
  await page.getByText("Liczba pupili: 1", { exact: true }).waitFor();
  assert.equal(pets.length, 1);
  petsFail = true;
  await page.reload();
  await page
    .getByText("Nie udało się pobrać pupili.", { exact: false })
    .waitFor();
  assert.equal(
    await page.getByText("Liczba pupili:", { exact: false }).count(),
    0
  );
  petsFail = false;
  await page.getByText("Spróbuj ponownie", { exact: true }).click();
  await page.getByText("Luna", { exact: true }).waitFor();
  profileFail = true;
  await page.reload();
  await page
    .getByText("Nie udało się pobrać danych konta.", { exact: false })
    .waitFor();
  await page.getByText("Luna", { exact: true }).waitFor();
  profileFail = false;
  await page.getByText("Spróbuj ponownie", { exact: true }).click();
  await page.getByText("anna@example.test", { exact: true }).waitFor();
  await page.getByText("Wyloguj się", { exact: true }).click();
  await page.waitForURL(`${baseUrl}/`);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("auth_token")),
    null
  );
  console.log(
    "PASS: empty/one/many pets, edit validation, failed save preserves input, clear birth date, cancel edit, delete cancel/confirm, independent API failures/retry, logout while offline."
  );
  profile = {
    ...profile,
    id: "u2",
    email: "jan@example.test",
    fullName: "Jan Nowak"
  };
  pets = [];
  await page
    .getByPlaceholder("Wpisz adres email", { exact: true })
    .filter({ visible: true })
    .fill("jan@example.test");
  await page
    .getByPlaceholder("Wpisz hasło", { exact: true })
    .filter({ visible: true })
    .fill("example-password");
  await page
    .getByText("Zaloguj się", { exact: true })
    .filter({ visible: true })
    .click();
  await page.waitForURL("**/mainScreen/MainScreen");
  await page.getByText("Profil", { exact: true }).click();
  await page.getByText("jan@example.test", { exact: true }).waitFor();
  await page.getByText("Dodaj pierwszego zwierzaka", { exact: true }).waitFor();
  assert.equal(await page.getByText("Luna", { exact: true }).count(), 0);
  expired = true;
  await page.reload();
  await page.waitForURL(`${baseUrl}/`);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("auth_token")),
    null
  );
  console.log(
    "PASS: second account does not inherit pets; expired session redirects to login."
  );
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
