import { AccountRole } from "@prisma/client";

import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

function requireRole(actual: AccountRole, expected: AccountRole) {
  if (actual !== expected) throw new AppError(403, "Account role cannot access this endpoint", "FORBIDDEN");
}

export async function getUserProfile(accountId: string, role: AccountRole) {
  requireRole(role, "USER");
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { userProfile: true }
  });
  if (!account?.userProfile) throw new AppError(404, "User profile was not found", "PROFILE_NOT_FOUND");
  return {
    id: account.userProfile.id,
    email: account.email,
    emailVerifiedAt: account.emailVerifiedAt,
    fullName: account.userProfile.fullName,
    phone: account.userProfile.phone,
    birthDate: account.userProfile.birthDate
  };
}

export async function updateUserProfile(
  accountId: string,
  role: AccountRole,
  input: { fullName?: string; phone?: string; birthDate?: string | null }
) {
  requireRole(role, "USER");
  const profile = await prisma.userProfile.findUnique({ where: { accountId } });
  if (!profile) throw new AppError(404, "User profile was not found", "PROFILE_NOT_FOUND");
  await prisma.userProfile.update({
    where: { accountId },
    data: {
      fullName: input.fullName,
      phone: input.phone,
      birthDate: input.birthDate === null ? null : input.birthDate ? new Date(`${input.birthDate}T00:00:00.000Z`) : undefined
    }
  });
  return getUserProfile(accountId, role);
}

export async function getClinicProfile(accountId: string, role: AccountRole) {
  requireRole(role, "CLINIC");
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { clinicProfile: true }
  });
  if (!account?.clinicProfile) throw new AppError(404, "Clinic profile was not found", "PROFILE_NOT_FOUND");
  return {
    id: account.clinicProfile.id,
    email: account.email,
    emailVerifiedAt: account.emailVerifiedAt,
    clinicName: account.clinicProfile.clinicName,
    nip: account.clinicProfile.nip,
    phone: account.clinicProfile.phone
  };
}

export async function updateClinicProfile(
  accountId: string,
  role: AccountRole,
  input: { clinicName?: string; phone?: string }
) {
  requireRole(role, "CLINIC");
  const profile = await prisma.clinicProfile.findUnique({ where: { accountId } });
  if (!profile) throw new AppError(404, "Clinic profile was not found", "PROFILE_NOT_FOUND");
  await prisma.clinicProfile.update({ where: { accountId }, data: input });
  return getClinicProfile(accountId, role);
}
