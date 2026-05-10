import { AccountRole } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";

import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  createRefreshTokenId,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../utils/tokens";

export interface RegisterUserInput {
  fullName: string;
  email: string;
  phone: string;
  birthDate?: string;
  password: string;
}

export interface RegisterClinicInput {
  clinicName: string;
  nip: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface GoogleLoginInput {
  idToken: string;
}

export interface RefreshInput {
  refreshToken: string;
}

type AccountWithProfiles = {
  id: string;
  email: string;
  role: AccountRole;
  userProfile: {
    id: string;
    fullName: string;
    phone: string;
    birthDate: Date | null;
  } | null;
  clinicProfile: {
    id: string;
    clinicName: string;
    nip: string;
    phone: string;
  } | null;
};

const googleOAuthClient = new OAuth2Client();

function mapAccount(account: AccountWithProfiles) {
  return {
    id: account.id,
    email: account.email,
    role: account.role,
    profile:
      account.role === "USER"
        ? account.userProfile
          ? {
              id: account.userProfile.id,
              fullName: account.userProfile.fullName,
              phone: account.userProfile.phone,
              birthDate: account.userProfile.birthDate
            }
          : null
        : account.clinicProfile
          ? {
              id: account.clinicProfile.id,
              clinicName: account.clinicProfile.clinicName,
              nip: account.clinicProfile.nip,
              phone: account.clinicProfile.phone
            }
          : null
  };
}

async function issueTokenPair(accountId: string, role: AccountRole) {
  const accessToken = signAccessToken(accountId, role);
  const refreshTokenId = createRefreshTokenId();
  const refreshToken = signRefreshToken(accountId, role, refreshTokenId);

  await prisma.refreshToken.create({
    data: {
      id: refreshTokenId,
      accountId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
    }
  });

  return {
    accessToken,
    refreshToken
  };
}

export async function registerUser(input: RegisterUserInput) {
  const existingAccount = await prisma.account.findUnique({
    where: {
      email: input.email
    }
  });

  if (existingAccount) {
    throw new AppError(409, "Email is already in use", "EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);
  const birthDate = input.birthDate ? new Date(input.birthDate) : undefined;

  const account = await prisma.account.create({
    data: {
      email: input.email,
      passwordHash,
      role: "USER",
      userProfile: {
        create: {
          fullName: input.fullName,
          phone: input.phone,
          birthDate
        }
      }
    },
    include: {
      userProfile: true,
      clinicProfile: true
    }
  });

  const tokens = await issueTokenPair(account.id, account.role);

  return {
    ...tokens,
    account: mapAccount(account)
  };
}

export async function registerClinic(input: RegisterClinicInput) {
  const existingEmail = await prisma.account.findUnique({
    where: {
      email: input.email
    }
  });

  if (existingEmail) {
    throw new AppError(409, "Email is already in use", "EMAIL_TAKEN");
  }

  const existingClinic = await prisma.clinicProfile.findUnique({
    where: {
      nip: input.nip
    }
  });

  if (existingClinic) {
    throw new AppError(409, "Clinic with this NIP already exists", "NIP_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);

  const account = await prisma.account.create({
    data: {
      email: input.email,
      passwordHash,
      role: "CLINIC",
      clinicProfile: {
        create: {
          clinicName: input.clinicName,
          nip: input.nip,
          phone: input.phone
        }
      }
    },
    include: {
      userProfile: true,
      clinicProfile: true
    }
  });

  const tokens = await issueTokenPair(account.id, account.role);

  return {
    ...tokens,
    account: mapAccount(account)
  };
}

export async function login(input: LoginInput) {
  const account = await prisma.account.findUnique({
    where: {
      email: input.email
    },
    include: {
      userProfile: true,
      clinicProfile: true
    }
  });

  if (!account) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  if (!account.passwordHash) {
    throw new AppError(401, "Use Google to sign in to this account", "GOOGLE_ACCOUNT");
  }

  const passwordIsValid = await verifyPassword(input.password, account.passwordHash);

  if (!passwordIsValid) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const tokens = await issueTokenPair(account.id, account.role);

  return {
    ...tokens,
    account: mapAccount(account)
  };
}

export async function loginWithGoogle(input: GoogleLoginInput) {
  if (env.GOOGLE_CLIENT_IDS.length === 0) {
    throw new AppError(500, "Google login is not configured", "GOOGLE_AUTH_NOT_CONFIGURED");
  }

  const ticket = await googleOAuthClient.verifyIdToken({
    idToken: input.idToken,
    audience: env.GOOGLE_CLIENT_IDS
  }).catch(() => {
    throw new AppError(401, "Google token is invalid", "GOOGLE_INVALID_TOKEN");
  });

  const payload = ticket.getPayload();
  const googleId = payload?.sub;
  const email = payload?.email?.toLowerCase();

  if (!googleId || !email) {
    throw new AppError(401, "Google account did not include required identity data", "GOOGLE_INVALID_TOKEN");
  }

  if (!payload.email_verified) {
    throw new AppError(401, "Google email address is not verified", "GOOGLE_EMAIL_NOT_VERIFIED");
  }

  const existingGoogleAccount = await prisma.account.findUnique({
    where: {
      googleId
    },
    include: {
      userProfile: true,
      clinicProfile: true
    }
  });

  if (existingGoogleAccount) {
    const tokens = await issueTokenPair(existingGoogleAccount.id, existingGoogleAccount.role);

    return {
      ...tokens,
      account: mapAccount(existingGoogleAccount)
    };
  }

  const existingEmailAccount = await prisma.account.findUnique({
    where: {
      email
    },
    include: {
      userProfile: true,
      clinicProfile: true
    }
  });

  if (existingEmailAccount) {
    if (existingEmailAccount.googleId && existingEmailAccount.googleId !== googleId) {
      throw new AppError(409, "This email is already linked to another Google account", "GOOGLE_ACCOUNT_CONFLICT");
    }

    const linkedAccount = await prisma.account.update({
      where: {
        id: existingEmailAccount.id
      },
      data: {
        googleId
      },
      include: {
        userProfile: true,
        clinicProfile: true
      }
    });

    const tokens = await issueTokenPair(linkedAccount.id, linkedAccount.role);

    return {
      ...tokens,
      account: mapAccount(linkedAccount)
    };
  }

  const account = await prisma.account.create({
    data: {
      email,
      googleId,
      passwordHash: null,
      role: "USER",
      userProfile: {
        create: {
          fullName: payload.name ?? email,
          phone: ""
        }
      }
    },
    include: {
      userProfile: true,
      clinicProfile: true
    }
  });

  const tokens = await issueTokenPair(account.id, account.role);

  return {
    ...tokens,
    account: mapAccount(account)
  };
}

export async function refreshSession(input: RefreshInput) {
  const payload = verifyRefreshToken(input.refreshToken);

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: {
      id: payload.tokenId
    },
    include: {
      account: {
        include: {
          userProfile: true,
          clinicProfile: true
        }
      }
    }
  });

  if (!tokenRecord || tokenRecord.revokedAt) {
    throw new AppError(401, "Refresh token is invalid", "INVALID_REFRESH_TOKEN");
  }

  if (tokenRecord.expiresAt.getTime() < Date.now()) {
    throw new AppError(401, "Refresh token expired", "EXPIRED_REFRESH_TOKEN");
  }

  if (tokenRecord.accountId !== payload.accountId) {
    throw new AppError(401, "Refresh token is invalid", "INVALID_REFRESH_TOKEN");
  }

  const incomingTokenHash = hashToken(input.refreshToken);

  if (incomingTokenHash !== tokenRecord.tokenHash) {
    await prisma.refreshToken.update({
      where: {
        id: tokenRecord.id
      },
      data: {
        revokedAt: new Date()
      }
    });

    throw new AppError(401, "Refresh token is invalid", "INVALID_REFRESH_TOKEN");
  }

  await prisma.refreshToken.update({
    where: {
      id: tokenRecord.id
    },
    data: {
      revokedAt: new Date()
    }
  });

  const tokens = await issueTokenPair(tokenRecord.account.id, tokenRecord.account.role);

  return {
    ...tokens,
    account: mapAccount(tokenRecord.account)
  };
}

export async function getCurrentUserProfile(accountId: string) {
  const account = await prisma.account.findUnique({
    where: {
      id: accountId
    },
    include: {
      userProfile: true
    }
  });

  if (!account) {
    throw new AppError(404, "Account was not found", "ACCOUNT_NOT_FOUND");
  }

  if (account.role !== "USER") {
    throw new AppError(403, "Only user accounts can access this endpoint", "FORBIDDEN");
  }

  if (!account.userProfile) {
    throw new AppError(404, "User profile was not found", "PROFILE_NOT_FOUND");
  }

  return {
    id: account.userProfile.id,
    email: account.email,
    fullName: account.userProfile.fullName,
    phone: account.userProfile.phone,
    birthDate: account.userProfile.birthDate
  };
}
