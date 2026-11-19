import { AccountRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        accountId: string;
        role: AccountRole;
        sessionId?: string;
        version?: number;
      };
    }
  }
}

export {};
