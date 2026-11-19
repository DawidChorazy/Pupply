import { prisma } from "../config/prisma";
import "../config/env";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run admin:grant -- account@example.com");
  const account = await prisma.account.findUnique({ where: { email } });
  if (!account || !account.emailVerifiedAt || account.blockedAt || account.deactivatedAt) throw new Error("An active account with a verified email is required");
  await prisma.$transaction([
    prisma.account.update({ where: { id: account.id }, data: { role: "ADMIN", authVersion: { increment: 1 } } }),
    prisma.refreshToken.updateMany({ where: { accountId: account.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.auditLog.create({ data: { actorAccountId: "operator-cli", targetAccountId: account.id, action: "ADMIN_GRANTED" } })
  ]);
  console.log("Administrator role assigned. Log in again to obtain a new session.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
