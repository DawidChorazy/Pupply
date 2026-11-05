const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { chromium } = require("playwright");
const { PrismaClient } = require("../backend/node_modules/@prisma/client");
const { assertTestDatabase } = require("../backend/dist/utils/test-database");

assertTestDatabase(process.env.DATABASE_URL);
const base = process.env.PUPPLY_WEB_URL || "http://localhost:8081";
const api = process.env.PUPPLY_CHAT_TEST_API_URL || "http://127.0.0.1:4001/api";
assert.equal(new URL(api).port, "4001", "Use the dedicated test API, not the development server.");
const db = new PrismaClient(), ids = [];
const password = "Strong@Test1";
async function http(path, token, method = "GET", input) {
  const response = await fetch(`${api}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}) });
  const result = response.status === 204 ? null : await response.json();
  assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(result)}`);
  return result;
}
async function user(fullName) {
  const auth = await http("/auth/register/user", null, "POST", { email: `${randomUUID()}@chat-browser.test`, fullName, phone: "+48123456789", password, confirmPassword: password });
  ids.push(auth.account.id);
  await db.account.update({ where: { id: auth.account.id }, data: { emailVerifiedAt: new Date() } });
  return auth;
}
async function eventually(assertion, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (true) { try { return await assertion(); } catch (error) { if (Date.now() >= deadline) throw error; await new Promise(resolve => setTimeout(resolve, 200)); } }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"],
    ...(process.env.PUPPLY_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PUPPLY_CHROMIUM_EXECUTABLE } : {}) });
  const errors = [];
  let diagnosticPage;
  try {
    const a = await user("Anna Właścicielka"), b = await user("Bartek Opiekun"), c = await user("Celina Obca");
    const sitter = await http("/sitters/me", b.accessToken, "POST", { bio: "Doświadczony opiekun zwierząt do testów czatu.", city: "Warszawa", latitude: 52, longitude: 21,
      serviceRadiusKm: 25, services: [{ type: "DOG_WALK", durationMinutes: 30, priceCents: 3000 }] });
    async function pageFor(auth) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.addInitScript(auth => {
        localStorage.setItem("auth_token", auth.accessToken); localStorage.setItem("refresh_token", auth.refreshToken); localStorage.setItem("account_id", auth.account.id);
        Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
      }, auth);
      // The application keeps its configured API URL; every request in these
      // isolated browser contexts is redirected to the disposable test API.
      await context.route("**/api/**", route => {
        const url = new URL(route.request().url());
        return route.continue({ url: `${api}${url.pathname.slice(4)}${url.search}` });
      });
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      page.setDefaultTimeout(20000);
      return page;
    }
    const owner = await pageFor(a), sitterPage = await pageFor(b), stranger = await pageFor(c);
    diagnosticPage = sitterPage;
    await owner.goto(`${base}/marketplace/chat?sitterProfileId=${sitter.profile.id}`);
    await owner.bringToFront();
    await owner.getByText("Bartek Opiekun", { exact: true }).waitFor();
    assert.ok(await owner.getByRole("button", { name: "Wyślij wiadomość", exact: true }).isDisabled());
    await owner.getByLabel("Wiadomość", { exact: true }).fill("Pierwszy wiersz");
    await owner.getByLabel("Wiadomość", { exact: true }).press("Shift+Enter");
    assert.ok((await owner.getByLabel("Wiadomość", { exact: true }).inputValue()).includes("\n"));
    assert.equal(await db.chatMessage.count({ where: { senderAccountId: a.account.id } }), 0);
    await owner.getByLabel("Wiadomość", { exact: true }).fill("Czy możemy umówić spacer?");
    await owner.getByRole("button", { name: "Wyślij wiadomość", exact: true }).click();
    await eventually(async () => assert.equal(await db.chatMessage.count({ where: { senderAccountId: a.account.id } }), 1));
    const conversation = await db.conversation.findFirstOrThrow({ where: { OR: [{ firstAccountId: a.account.id }, { secondAccountId: a.account.id }] } });

    await sitterPage.goto(`${base}/home`); await sitterPage.bringToFront();
    await sitterPage.getByRole("button", { name: "Moje rozmowy, 1 nieprzeczytanych wiadomości", exact: true }).click();
    await sitterPage.getByRole("button", { name: /Rozmowa z Anna Właścicielka/ }).click();
    await sitterPage.getByText("Czy możemy umówić spacer?", { exact: true }).filter({ visible: true }).waitFor();
    await eventually(async () => assert.equal((await http("/conversations/unread-count", b.accessToken)).count, 0));
    await sitterPage.getByLabel("Wiadomość", { exact: true }).fill("Tak, chętnie!");
    await sitterPage.getByRole("button", { name: "Wyślij wiadomość", exact: true }).click();
    await owner.bringToFront();
    await owner.getByText("Tak, chętnie!", { exact: true }).waitFor();
    await owner.reload();
    await owner.getByText("Czy możemy umówić spacer?", { exact: true }).waitFor();
    await owner.getByText("Tak, chętnie!", { exact: true }).waitFor();

    // Commit on the server, lose its response, then explicitly retry the same UUID.
    let loseResponse = true, pauseReads = true;
    await owner.route(`**/api/conversations/${conversation.id}/messages*`, async route => {
      const req = route.request();
      if (req.method() === "GET" && pauseReads) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Chwilowa przerwa testowa" }) });
      if (req.method() === "POST" && loseResponse) {
        loseResponse = false;
        const url = new URL(req.url());
        const result = await route.fetch({ url: `${api}${url.pathname.slice(4)}${url.search}` });
        assert.equal(result.status(), 201);
        return route.abort("failed");
      }
      return route.fallback();
    });
    await owner.getByLabel("Wiadomość", { exact: true }).fill("Wiadomość po utracie odpowiedzi");
    await owner.getByRole("button", { name: "Wyślij wiadomość", exact: true }).click();
    await owner.getByRole("button", { name: "Ponów wysłanie wiadomości", exact: true }).click();
    await eventually(async () => assert.equal(await owner.getByRole("button", { name: "Ponów wysłanie wiadomości", exact: true }).count(), 0));
    pauseReads = false;
    assert.equal(await db.chatMessage.count({ where: { conversationId: conversation.id, text: "Wiadomość po utracie odpowiedzi" } }), 1);
    await owner.unroute(`**/api/conversations/${conversation.id}/messages*`);
    assert.equal(await owner.getByText("Wiadomość po utracie odpowiedzi", { exact: true }).count(), 1);
    const input = await owner.getByLabel("Wiadomość", { exact: true }).boundingBox();
    assert.ok(input.width > 200, "Composer must use the mobile viewport width.");
    await owner.screenshot({ path: "/tmp/pupply-chat-mobile.png", fullPage: true });

    await sitterPage.goto(`${base}/notifications`); await sitterPage.bringToFront();
    await sitterPage.getByText("Masz nową wiadomość w czacie.", { exact: true }).first().click();
    await sitterPage.waitForURL(url => url.pathname === "/marketplace/chat" && url.searchParams.get("conversationId") === conversation.id);
    await sitterPage.getByText("Wiadomość po utracie odpowiedzi", { exact: true }).filter({ visible: true }).waitFor();

    // Populate history through the real service without hitting the HTTP rate limit.
    const { sendMessage } = require("../backend/dist/services/chat.service");
    for (let i = 1; i <= 55; i++) await sendMessage(a.account.id, "USER", conversation.id, { clientMessageId: randomUUID(), text: `Historia ${String(i).padStart(3, "0")}` });
    await sitterPage.reload();
    await sitterPage.getByText("Historia 055", { exact: true }).waitFor();
    assert.equal(await sitterPage.getByText("Historia 001", { exact: true }).count(), 0);
    await sitterPage.getByRole("button", { name: "Wczytaj starsze wiadomości", exact: true }).click();
    await sitterPage.getByText("Historia 001", { exact: true }).waitFor();
    await sitterPage.getByText("Historia 001", { exact: true }).scrollIntoViewIfNeeded();
    await sitterPage.waitForTimeout(300);

    await http(`/conversations/${conversation.id}/messages`, a.accessToken, "POST", { clientMessageId: randomUUID(), text: "Nowa podczas czytania starszej historii" });
    await sitterPage.getByRole("button", { name: "Przejdź do nowych wiadomości", exact: true }).waitFor();
    assert.equal((await http("/conversations/unread-count", b.accessToken)).count, 1);
    await sitterPage.getByRole("button", { name: "Przejdź do nowych wiadomości", exact: true }).click();
    await eventually(async () => assert.equal((await http("/conversations/unread-count", b.accessToken)).count, 0));

    await stranger.goto(`${base}/marketplace/chat?conversationId=${conversation.id}`); await stranger.bringToFront();
    await stranger.getByText("Nie znaleziono rozmowy.", { exact: true }).waitFor();
    assert.equal(await stranger.getByText("Historia 055", { exact: true }).count(), 0);

    await owner.bringToFront();
    await db.account.update({ where: { id: b.account.id }, data: { blockedAt: new Date() } });
    await owner.getByText(/Wysyłanie jest niedostępne/).waitFor();
    assert.equal(await owner.getByLabel("Wiadomość", { exact: true }).isEditable(), false);
    await owner.goto(`${base}/account/profile`);
    await owner.getByText("Wyloguj się", { exact: true }).click();
    await owner.waitForURL(url => url.pathname === "/");
    assert.equal(await owner.evaluate(() => localStorage.getItem("auth_token")), null);
    assert.equal(await owner.getByText("Historia 055", { exact: true }).filter({ visible: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log("Chat browser checks passed: two accounts, inbox/unread, persistence, safe retry, notification routing, history, mobile layout and stranger isolation.");
  } catch (error) {
    if (diagnosticPage && !diagnosticPage.isClosed()) {
      await diagnosticPage.screenshot({ path: "/tmp/pupply-chat-failure.png", fullPage: true }).catch(() => {});
      console.log(await diagnosticPage.evaluate(() => ({ visibility: document.visibilityState, url: location.pathname,
        scrolls: [...document.querySelectorAll("div")].filter(el => getComputedStyle(el).overflowY === "auto" && el.scrollHeight > el.clientHeight)
          .map(el => ({ top: el.scrollTop, height: el.scrollHeight, viewport: el.clientHeight })) })));
    }
    throw error;
  } finally {
    await browser.close();
    await db.account.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
