const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.env.PUPPLY_WEB_URL || "http://localhost:8081";

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const owner = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const recipient = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const pet = { id: "pet-fixture", accountId: "owner-fixture", name: "Figa", gender: "FEMALE", breed: "Kundelek", age: 4, weight: 12, photoUrl: null, illnesses: JSON.stringify({ version: 1, items: [{ id: "i1", name: "Zapalenie ucha", date: "10.10.2026", description: "Kontrola za tydzień", medications: "Krople" }] }), allergies: "Kurczak", vaccines: "Wścieklizna", vet: "Przychodnia Testowa", notes: "Spacer w szelkach" };
  let shares = [], nextId = 0, publicReads = 0, downloads = 0;
  const tokens = new Map();
  const fixtureDoc = { id: "doc-fixture", name: "Szczepienia.pdf", sizeBytes: 40, expiresAt: null };

  const mock = async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
    let status = 200, body = {};
    if (path.startsWith("/api/shared-pets/")) {
      assert.equal(req.headers().authorization, undefined, "Public view must not send account credentials");
      assert.equal(url.search, "", "Share token must not enter the API URL");
      assert.equal(req.headers().referer, undefined, "Public requests must not disclose the recipient URL");
      const token = req.headers()["x-pet-share-token"];
      const share = shares.find(s => tokens.get(s.id) === token && !s.revokedAt);
      if (!share) { status = 404; body = { message: "SHARE_UNAVAILABLE" }; }
      else if (path === "/api/shared-pets/card") {
        publicReads++;
        const { id, accountId, ...publicPet } = pet;
        body = { pet: publicPet, includeDocuments: share.includeDocuments, documents: share.includeDocuments ? [fixtureDoc] : [], expiresAt: share.expiresAt };
      } else if (path === `/api/shared-pets/documents/${fixtureDoc.id}/download` && share.includeDocuments) {
        downloads++; body = { url: `${base}/sharing-fixture.pdf`, expiresIn: 60 };
      } else status = 404;
    } else {
      assert.equal(req.headers().authorization, "Bearer fixture-access", "Owner APIs require their own login");
      if (path === `/api/pets/${pet.id}`) body = { pet };
      else if (path === `/api/pets/${pet.id}/documents`) body = { documents: [] };
      else if (path === `/api/pets/${pet.id}/shares`) {
        if (method === "POST") {
          const input = req.postDataJSON();
          const id = `s${++nextId}`;
          const share = { id, label: input.label || null, includeDocuments: input.includeDocuments, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), revokedAt: null };
          const token = String(nextId).padStart(43, "a");
          tokens.set(id, token); shares.unshift(share);
          status = 201; body = { share, url: `${base}/shared-pet#token=${token}` };
        } else body = { shares };
      } else if (path.startsWith(`/api/pets/${pet.id}/shares/`) && method === "DELETE") {
        shares.find(s => s.id === path.split("/").at(-1)).revokedAt = new Date().toISOString(); status = 204;
      } else { status = 404; body = { message: `Unexpected fixture API: ${path}` }; }
    }
    await route.fulfill({ status, contentType: "application/json", body: status === 204 ? "" : JSON.stringify(body) });
  };
  await owner.addInitScript(() => {
    localStorage.setItem("auth_token", "fixture-access");
    localStorage.setItem("refresh_token", "fixture-refresh");
    localStorage.setItem("account_id", "owner-fixture");
  });
  await owner.route("**/api/**", mock);
  await recipient.route("**/api/**", mock);
  await recipient.route("**/sharing-fixture.pdf", route => route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4\nfixture\n%%EOF" }));
  const page = await owner.newPage(), shared = await recipient.newPage();
  for (const p of [page, shared]) p.on("pageerror", e => errors.push(e.message));
  try {
    await page.goto(`${base}/mainScreen/pets/${pet.id}`);
    await page.getByRole("button", { name: "Udostępnij kartę pupila", exact: true }).click();
    await page.getByLabel("Nazwa udostępnienia").fill("Opiekunka na weekend");
    assert.equal(await page.getByRole("switch", { name: "Dołącz dokumenty PDF" }).isChecked(), false);
    await page.getByRole("button", { name: "Utwórz link ważny 7 dni" }).click();
    const firstUrl = await page.getByLabel("Link do karty pupila").inputValue();
    assert.ok(firstUrl.includes("/shared-pet#token="));
    assert.equal(shares[0].includeDocuments, false);
    await page.bringToFront();
    await page.getByRole("button", { name: "Kopiuj link", exact: true }).click();
    await page.getByText("Skopiowano link do karty pupila.", { exact: true }).waitFor();

    await shared.goto(firstUrl);
    await shared.getByText("Spacer w szelkach", { exact: true }).waitFor();
    await shared.getByText("Zapalenie ucha · 10.10.2026", { exact: true }).waitFor();
    await shared.getByText("Leki: Krople", { exact: true }).waitFor();
    await shared.getByText("Właściciel nie udostępnił dokumentów.", { exact: true }).waitFor();
    assert.equal(await shared.getByRole("button", { name: "Edytuj", exact: true }).count(), 0);
    assert.equal(await shared.evaluate(() => localStorage.getItem("auth_token")), null);
    assert.equal(await shared.locator('meta[name="referrer"]').getAttribute("content"), "no-referrer");
    assert.ok((await shared.locator('meta[name="robots"]').getAttribute("content")).includes("noindex"));
    await shared.screenshot({ path: process.env.PUPPLY_SCREENSHOT_PATH || "/tmp/pupply-shared-pet-mobile.png", fullPage: true });

    // Opt in explicitly; a separate link does not change the earlier link's scope.
    await page.getByRole("switch", { name: "Dołącz dokumenty PDF" }).click();
    await page.getByLabel("Nazwa udostępnienia").fill("Weterynarz");
    await page.getByRole("button", { name: "Utwórz link ważny 7 dni" }).click();
    await page.getByText("Weterynarz", { exact: true }).waitFor();
    const secondUrl = await page.getByLabel("Link do karty pupila").inputValue();
    assert.notEqual(firstUrl, secondUrl);
    await shared.goto(secondUrl);
    const popup = shared.waitForEvent("popup");
    const downloaded = shared.waitForResponse(r => r.url().includes(`/documents/${fixtureDoc.id}/download`));
    await shared.getByRole("button", { name: "Otwórz PDF: Szczepienia.pdf", exact: true }).click();
    await downloaded;
    await (await popup).close();
    assert.equal(downloads, 1);
    await shared.bringToFront();
    await shared.clock.install();
    await page.getByRole("button", { name: "Cofnij dostęp: Weterynarz", exact: true }).click();
    await page.getByText("Cofnięto dostęp. Ten link już nie działa.", { exact: true }).waitFor();
    await shared.clock.runFor(31_000);
    await shared.getByText("Ten link jest nieprawidłowy, wygasł lub został cofnięty.", { exact: true }).waitFor();
    assert.equal(await shared.getByText("Spacer w szelkach", { exact: true }).count(), 0);
    await shared.goto(firstUrl);
    await shared.getByText("Spacer w szelkach", { exact: true }).waitFor();
    await shared.getByText("Właściciel nie udostępnił dokumentów.", { exact: true }).waitFor();
    await shared.goto(`${base}/shared-pet`);
    await shared.getByText("Ten link jest nieprawidłowy, wygasł lub został cofnięty.", { exact: true }).waitFor();
    assert.ok(publicReads >= 3);
    assert.deepEqual(errors, []);
    console.log("Pet sharing browser checks passed: owner controls, copy, anonymous read-only view, health, optional PDFs, independent scopes, revocation, invalid links and privacy headers.");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
