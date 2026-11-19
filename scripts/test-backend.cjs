const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const backend = path.join(root, "backend");
const smoke = process.argv.length === 3 && process.argv[2] === "--smoke";
const suffix = crypto.randomBytes(5).toString("hex"), password = crypto.randomBytes(24).toString("hex");
const containers = [], names = { db: `petify-test-db-${suffix}`, storage: `petify-test-storage-${suffix}` };
const engine = process.env.CONTAINER_ENGINE || ["docker", "podman"].find(bin => spawnSync(bin, ["info"], { stdio: "ignore", timeout: 10_000 }).status === 0);
let child;
function capture(args) {
  const result = spawnSync(engine, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "Nie udało się uruchomić infrastruktury testowej.");
  return result.stdout.trim();
}
function run(bin, args, env) {
  return new Promise((resolve, reject) => {
    child = spawn(bin, args, { cwd: backend, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => { child = null; code === 0 && !signal ? resolve() : reject(new Error("Polecenie testowe nie zakończyło się poprawnie.")); });
  });
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { interrupted = true; child?.kill("SIGTERM"); });
(async () => {
  if (!engine) throw new Error("Testy wymagają działającego Dockera lub Podmana.");
  try {
    capture(["image", "inspect", "pupply-minio:local"]);
  } catch {
    await run(engine, ["build", "-t", "pupply-minio:local", path.join(root, "ops/minio")], process.env);
  }
  try {
    console.log("Uruchamianie osobnej, tymczasowej bazy i storage do testów…");
    for (const [name, args] of [[names.db, ["-p", "127.0.0.1::5432", "-e", "POSTGRES_DB=petify_release_test", "-e", "POSTGRES_USER=postgres", "-e", `POSTGRES_PASSWORD=${password}`, "docker.io/library/postgres:16-alpine"]],
      [names.storage, ["-p", "127.0.0.1::9000", "-e", "MINIO_ROOT_USER=petify_test", "-e", `MINIO_ROOT_PASSWORD=${password}`, "pupply-minio:local", "server", "/data"]]]) {
      capture(["run", "-d", "--rm", "--name", name, ...args]); containers.push(name);
    }
    const port = (name, internal) => Number(capture(["port", name, internal]).split(":").at(-1));
    const databasePort = port(names.db, "5432"), storageUrl = `http://127.0.0.1:${port(names.storage, "9000")}`;
    let ready = false;
    for (let attempt = 0; attempt < 60 && !interrupted; attempt++) {
      try {
        capture(["exec", names.db, "pg_isready", "-U", "postgres", "-d", "petify_release_test"]);
        if ((await fetch(`${storageUrl}/minio/health/live`, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; }
      } catch { /* Containers are still starting. */ }
      await sleep(500);
    }
    if (!ready || interrupted) throw new Error("Przerwano testy lub infrastruktura nie zgłosiła gotowości.");
    capture(["exec", names.storage, "sh", "-c", 'mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" && mc mb local/petify-test && mc anonymous set download local/petify-test && mc mb local/petify-test-documents && mc anonymous set none local/petify-test-documents']);
    const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${databasePort}/petify_release_test`,
      JWT_ACCESS_SECRET: crypto.randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"),
      AUTH_RATE_LIMIT_MAX: "1000", CORS_ORIGIN: "*", PUSH_ENABLED: "false", SMTP_HOST: "", PAYU_ENABLED: "false", PAYU_POS_ID: "", PAYU_CLIENT_SECRET: "", PAYU_SECOND_KEY: "",
      S3_ENDPOINT: storageUrl, S3_PUBLIC_ENDPOINT: storageUrl, S3_REGION: "us-east-1", S3_BUCKET: "petify-test", S3_DOCUMENT_BUCKET: "petify-test-documents",
      S3_ACCESS_KEY_ID: "petify_test", S3_SECRET_ACCESS_KEY: password, S3_FORCE_PATH_STYLE: "true", S3_PUBLIC_BASE_URL: `${storageUrl}/petify-test` };
    await run("npm", ["run", "prisma:generate"], env);
    await run(path.join(backend, "node_modules/.bin/prisma"), ["migrate", "deploy"], env);
    if (interrupted) throw new Error("Przerwano testy.");
    if (smoke) {
      const mail = `petify-test-mail-${suffix}`;
      capture(["run", "-d", "--rm", "--name", mail, "-p", "127.0.0.1::1025", "-p", "127.0.0.1::8025", "docker.io/axllent/mailpit:v1.31.4"]);
      containers.push(mail);
      await run("npm", ["run", "build"], env);
      await run(process.execPath, [path.join(backend, "smoke/marketplace.cjs")], {
        ...env, SMTP_HOST: "127.0.0.1", SMTP_PORT: String(port(mail, "1025")), SMTP_SECURE: "false",
        SMTP_USER: "", SMTP_PASSWORD: "", MAILPIT_URL: `http://127.0.0.1:${port(mail, "8025")}`,
        APP_PUBLIC_URL: "http://127.0.0.1:8081"
      });
    } else {
      await run("npm", ["test", "--", ...process.argv.slice(2)], env);
    }
  } finally {
    for (const name of containers.reverse()) spawnSync(engine, ["stop", "-t", "2", name], { stdio: "ignore" });
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
