import { AccountRole } from "@prisma/client";

import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { clinicVerificationSummary, updateClinicDetails } from "./clinic-verification.service";
import { updateClinicProfileSchema } from "../validation/profile.schemas";
import { z } from "zod";
import { assertPhotoExists, getPetPhotoUrl } from "./storage.service";

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
    birthDate: account.userProfile.birthDate,
    photoKey: account.userProfile.photoKey,
    photoUrl: await getPetPhotoUrl(account.userProfile.photoKey)
  };
}

export async function updateUserProfile(
  accountId: string,
  role: AccountRole,
  input: { fullName?: string; phone?: string; birthDate?: string | null; photoKey?: string | null }
) {
  requireRole(role, "USER");
  const profile = await prisma.userProfile.findUnique({ where: { accountId } });
  if (!profile) throw new AppError(404, "User profile was not found", "PROFILE_NOT_FOUND");
  if (input.photoKey) await assertPhotoExists(accountId, input.photoKey, "users");
  await prisma.userProfile.update({
    where: { accountId },
    data: {
      fullName: input.fullName,
      phone: input.phone,
      photoKey: input.photoKey,
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
    phone: account.clinicProfile.phone,
    address: account.clinicProfile.address,
    registrationNumber: account.clinicProfile.registrationNumber,
    verification: clinicVerificationSummary(account.clinicProfile,
      Boolean(account.emailVerifiedAt && !account.blockedAt && !account.deactivatedAt))
  };
}

export async function updateClinicProfile(
  accountId: string,
  role: AccountRole,
  input: z.infer<typeof updateClinicProfileSchema>
) {
  await updateClinicDetails(accountId, role, input);
  return getClinicProfile(accountId, role);
}
