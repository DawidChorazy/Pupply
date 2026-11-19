import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { startMaintenance } from "./services/maintenance.service";
import { startPaymentMaintenance } from "./services/payment.service";

const stopMaintenance = startMaintenance();
const stopPayments = startPaymentMaintenance();

const server = app.listen(env.PORT, () => {
  console.log(`Pupply backend listening on port ${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);

  server.close(async () => {
    await stopMaintenance();
    await stopPayments();
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
