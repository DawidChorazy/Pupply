import { Prisma } from "@prisma/client";
import { AppError } from "./app-error";

export function isTransactionContention(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (
    error.code === "P2034"
    || (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code)))
  );
}

export async function retryTransaction<T>(run: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await run(); }
    catch (error) {
      if (!isTransactionContention(error)) throw error;
      if (attempt + 1 >= attempts) throw new AppError(503, "Serwer jest chwilowo zajęty. Ponów tę samą rezerwację.", "BOOKING_BUSY");
      await new Promise(resolve => setTimeout(resolve, 15 * 2 ** attempt + Math.floor(Math.random() * 20)));
    }
  }
}
