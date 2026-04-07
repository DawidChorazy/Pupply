import { AccountRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        accountId: string;
        role: AccountRole;
      };
    }
  }
}

export {};
