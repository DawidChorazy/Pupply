export function assertTestDatabase(databaseUrl: string | undefined, nodeEnv = process.env.NODE_ENV) {
  let name = "";
  try { name = new URL(databaseUrl ?? "").pathname.slice(1); } catch { /* fail closed */ }
  if (nodeEnv !== "test" || !/^(test|[a-z0-9_]+_test)$/i.test(name)) {
    throw new Error("Destructive tests require NODE_ENV=test and an explicitly configured database named 'test' or ending with '_test'.");
  }
}
