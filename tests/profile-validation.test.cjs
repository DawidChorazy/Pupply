const { test } = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
function load(path, globals = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText;
  vm.runInNewContext(js, { exports, Date, Set, ...globals });
  return exports;
}
const { validateProfileForm } = load("features/profile/validation.ts");
const valid = {
  fullName: "Anna Kowalska",
  phone: "+48123456789",
  birthDate: "2000-02-29"
};
const now = new Date("2026-10-14T12:00:00Z");
test("valid profile, optional date and trimmed inputs", () => {
  assert.equal(validateProfileForm(valid, now), "");
  assert.equal(validateProfileForm({ ...valid, birthDate: "" }, now), "");
  assert.equal(
    validateProfileForm(
      { ...valid, fullName: " Anna ", phone: " 123456789 " },
      now
    ),
    ""
  );
});
test("invalid and future birth dates", () => {
  for (const birthDate of [
    "2001-02-29",
    "2000-02-30",
    "2026-13-01",
    "14.10.2000",
    "2026-10-15"
  ]) {
    assert.notEqual(
      validateProfileForm({ ...valid, birthDate }, now),
      "",
      birthDate
    );
  }
  assert.equal(
    validateProfileForm({ ...valid, birthDate: "2026-10-14" }, now),
    ""
  );
});
test("name and phone bounds match the API", () => {
  for (const fullName of ["", "A", "a".repeat(121)])
    assert.notEqual(validateProfileForm({ ...valid, fullName }, now), "");
  for (const phone of [
    "12345678",
    "1".repeat(16),
    "+48 abcdefg",
    "++48123456789"
  ])
    assert.notEqual(validateProfileForm({ ...valid, phone }, now), "");
});
test("session changes invalidate captured revision and notify only active subscriptions", () => {
  const session = load("services/session-events.ts");
  const captured = session.getSessionRevision();
  let calls = 0;
  const unsubscribe = session.subscribeSessionChanged(() => calls++);
  session.notifySessionChanged();
  assert.notEqual(session.getSessionRevision(), captured);
  assert.equal(calls, 1);
  unsubscribe();
  session.notifySessionChanged();
  assert.equal(calls, 1);
});

function clientHarness(fetch) {
  const session = load("services/session-events.ts");
  const saved = [];
  const client = load("services/api-client.ts", {
    Headers,
    Response,
    fetch,
    require: (name) =>
      name.includes("session-events")
        ? session
        : name.includes("constants/api")
          ? { API_BASE_URL: "http://api.test" }
          : {
              getRefreshToken: async () => "refresh",
              saveAuthTokens: async (...args) => saved.push(args),
              clearAuthTokens: async () => session.notifySessionChanged()
            }
  });
  return { client, session, saved };
}
test("DELETE accepts an empty 204 even with JSON content type", async () => {
  const { client } = clientHarness(
    async () =>
      new Response(null, {
        status: 204,
        headers: { "content-type": "application/json" }
      })
  );
  assert.equal(
    await client.apiRequest("/pets/1", { method: "DELETE", token: "old" }),
    null
  );
});
test("late account data cannot be returned after logout", async () => {
  let respond;
  const { client, session } = clientHarness(
    () =>
      new Promise((resolve) => {
        respond = resolve;
      })
  );
  const request = client.apiRequest("/users/me", { token: "old" });
  session.notifySessionChanged();
  respond(
    new Response(JSON.stringify({ profile: { fullName: "Old account" } }), {
      headers: { "content-type": "application/json" }
    })
  );
  await assert.rejects(request, (error) => error.status === 401);
});
test("late refresh cannot restore a cleared session", async () => {
  let respond;
  let started;
  const refreshing = new Promise((resolve) => {
    started = resolve;
  });
  const { client, session, saved } = clientHarness(async (url) => {
    if (url.endsWith("/auth/refresh")) {
      started();
      return new Promise((resolve) => {
        respond = resolve;
      });
    }
    return new Response("{}", {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  });
  const request = client.apiRequest("/users/me", { token: "old" });
  await refreshing;
  session.notifySessionChanged();
  respond(
    new Response(
      JSON.stringify({
        accessToken: "new",
        refreshToken: "new-refresh",
        account: { id: "old-account" }
      }),
      { headers: { "content-type": "application/json" } }
    )
  );
  await assert.rejects(request, (error) => error.status === 401);
  assert.equal(saved.length, 0);
});
