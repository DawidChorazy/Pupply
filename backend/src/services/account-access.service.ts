import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

export async function requireVerifiedEmail(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { emailVerifiedAt: true } });
  if (!account?.emailVerifiedAt) throw new AppError(403, "Potwierdź adres e-mail przed korzystaniem z rezerwacji i oferowaniem opieki.", "EMAIL_NOT_VERIFIED");
}
