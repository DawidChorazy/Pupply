const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseUrl = process.env.PUPPLY_WEB_URL || "http://localhost:8081";
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    colorScheme: "dark"
  });
  let hasPet = false,
    claimed = false,
    failClaim = true,
    rankingFail = false,
    questsFail = false,
    expired = false;
  const quests = () => ({
    userPoints: claimed ? 50 : 0,
    quests: [
      {
        id: "first-pet",
        title: "Pierwszy pupil",
        description: "Dodaj pupila do swojego konta.",
        points: 50,
        target: 1,
        progress: hasPet ? 1 : 0,
        status: claimed ? "claimed" : hasPet ? "available" : "locked",
        icon: "paw"
      },
      {
        id: "profile-complete",
        title: "Pełny profil pupila",
        description:
          "Uzupełnij imię, wiek, rasę, wagę i kontakt do weterynarza u jednego pupila.",
        points: 75,
        target: 5,
        progress: hasPet ? 1 : 0,
        status: "locked",
        icon: "dog-service"
      },
      {
        id: "first-walk",
        title: "Pierwszy zakończony spacer",
        description: "Zakończ spacer zarezerwowany w aplikacji.",
        points: 90,
        target: 1,
        progress: 0,
        status: "locked",
        icon: "walk"
      },
      {
        id: "regular-care",
        title: "Regularna opieka",
        description: "Zrealizuj 5 rezerwacji opieki nad swoimi pupilami.",
        points: 300,
        target: 5,
        progress: 0,
        status: "locked",
        icon: "calendar-star"
      }
    ]
  });
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "test");
    localStorage.setItem("refresh_token", "refresh");
    localStorage.setItem("account_id", "u1");
  });
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    let status = 200,
      body = {};
    if (expired) status = 401;
    else if (path === "/api/gamification/quests") {
      body = quests();
      if (questsFail) status = 503;
    } else if (path.endsWith("/claim")) {
      if (failClaim) status = 503;
      else {
        claimed = true;
        body = quests();
      }
    } else if (path === "/api/gamification/leaderboard") {
      if (rankingFail) status = 503;
      body = {
        leaderboard: [
          {
            id: "other",
            name: "Jan K.",
            points: 125,
            rank: 1,
            isCurrentUser: false
          }
        ],
        currentUser: {
          id: "u1",
          name: "Anna N.",
          points: claimed ? 50 : 0,
          rank: 52,
          isCurrentUser: true
        }
      };
    } else if (path.endsWith("/documents")) {
      body = { documents: [] };
    } else if (path === "/api/pets" && req.method() === "POST") {
      hasPet = true;
      body = { pet: { id: "p1", accountId: "u1", ...req.postDataJSON() } };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body)
    });
  });
  await page.goto(`${baseUrl}/mainScreen/QuestsScreen`);
  await page.getByText("0 pkt", { exact: true }).waitFor();
  assert.equal(await page.getByText("Odbierz", { exact: true }).count(), 0);
  await page.getByText("Dodaj pupila", { exact: true }).click();
  await page.getByPlaceholder("Imię", { exact: true }).fill("Luna");
  await page.getByText("Samica", { exact: true }).click();
  await page.getByText("Zapisz zwierzaka", { exact: true }).click();
  await page.getByText("Zwierzak został dodany", { exact: true }).waitFor();
  await page.goBack();
  await page.getByText("Odbierz", { exact: true }).click();
  await page
    .getByText("Nie udało się odebrać punktów.", { exact: false })
    .waitFor();
  failClaim = false;
  await page.getByText("Odbierz", { exact: true }).click();
  await page.getByText("50 pkt", { exact: true }).waitFor();
  await page.getByText("Odebrane", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("50 pkt", { exact: true }).waitFor();
  await page.screenshot({ path: "/tmp/pupply-quests.png", fullPage: true });
  await page.getByText("Ranking", { exact: true }).click();
  await page.getByText("Miejsce: 52", { exact: true }).waitFor();
  await page.getByText("Jan K.", { exact: true }).waitFor();
  await page.screenshot({ path: "/tmp/pupply-ranking.png", fullPage: true });
  rankingFail = true;
  await page.reload();
  await page
    .getByText("Nie udało się pobrać rankingu.", { exact: false })
    .waitFor();
  assert.equal(await page.getByText("0 pkt", { exact: true }).count(), 0);
  rankingFail = false;
  await page.getByText("Ponów", { exact: true }).click();
  await page.getByText("Miejsce: 52", { exact: true }).waitFor();
  questsFail = true;
  await page.getByText("Questy", { exact: true }).click();
  await page
    .getByText("Nie udało się pobrać zadań.", { exact: false })
    .waitFor();
  questsFail = false;
  await page.getByText("Spróbuj ponownie", { exact: true }).click();
  await page.getByText("Odebrane", { exact: true }).waitFor();
  expired = true;
  await page.reload();
  await page.waitForURL(`${baseUrl}/`);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("auth_token")),
    null
  );
  await browser.close();
  console.log(
    "PASS: live progress after adding pet, claim error/retry, persisted points, ranking position, loading failures/retry and expired session."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
