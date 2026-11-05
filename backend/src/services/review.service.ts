import { AccountRole, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { getPetPhotoUrl } from "./storage.service";
import { createReviewSchema, listReviewsSchema } from "../validation/review.schemas";

const round = (value: number) => Math.round(value * 100) / 100;
export const emptyReviewSummary = () => ({ reviewCount: 0, averageRating: null as number | null,
  averagePunctuality: null as number | null, averageCommunication: null as number | null, averageQuality: null as number | null,
  completedWalkCount: 0 });

export async function reviewSummaries(accountIds: string[]) {
  const summaries = new Map(accountIds.map(id => [id, emptyReviewSummary()]));
  if (!accountIds.length) return summaries;
  const [ratings, walks] = await Promise.all([
    prisma.sitterReview.groupBy({ by: ["sitterAccountId"], where: { sitterAccountId: { in: accountIds } },
      _sum: { punctuality: true, communication: true, quality: true }, _count: { _all: true } }),
    prisma.booking.groupBy({ by: ["sitterAccountId"], where: { sitterAccountId: { in: accountIds }, status: "COMPLETED", endsAt: { lte: new Date() }, sitterService: { type: "DOG_WALK" } }, _count: { _all: true } })
  ]);
  for (const row of ratings) {
    const count = row._count._all, sum = row._sum;
    Object.assign(summaries.get(row.sitterAccountId)!, { reviewCount: count,
      averageRating: round(((sum.punctuality ?? 0) + (sum.communication ?? 0) + (sum.quality ?? 0)) / (3 * count)),
      averagePunctuality: round((sum.punctuality ?? 0) / count), averageCommunication: round((sum.communication ?? 0) / count),
      averageQuality: round((sum.quality ?? 0) / count) });
  }
  for (const row of walks) summaries.get(row.sitterAccountId)!.completedWalkCount = row._count._all;
  return summaries;
}

export async function createReview(accountId: string, role: AccountRole, bookingId: string, input: z.infer<typeof createReviewSchema>) {
  if (role !== "USER") throw new AppError(403, "Tylko właściciel może ocenić spacer.", "FORBIDDEN");
  return prisma.$transaction(async tx => {
    // The account lock also serializes with blocking, deactivation and email changes.
    await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR SHARE`;
    const author = await tx.account.findUnique({ where: { id: accountId }, select: { role: true, blockedAt: true, deactivatedAt: true, emailVerifiedAt: true } });
    if (!author || author.role !== "USER" || author.blockedAt || author.deactivatedAt) throw new AppError(403, "Konto jest niedostępne.", "FORBIDDEN");
    if (!author.emailVerifiedAt) throw new AppError(403, "Potwierdź adres e-mail przed publikacją opinii.", "EMAIL_NOT_VERIFIED");
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Booking" WHERE id = ${bookingId} AND "ownerAccountId" = ${accountId} FOR UPDATE`;
    if (!locked.length) throw new AppError(404, "Nie znaleziono rezerwacji.", "BOOKING_NOT_FOUND");
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { review: true, sitterService: { select: { type: true } } } });
    if (booking.sitterAccountId === accountId) throw new AppError(409, "Nie możesz ocenić własnej usługi.", "SELF_REVIEW_NOT_ALLOWED");
    if (booking.status !== "COMPLETED" || booking.endsAt > new Date() || booking.sitterService.type !== "DOG_WALK")
      throw new AppError(409, "Ocenę można wystawić po zakończeniu spaceru.", "REVIEW_NOT_AVAILABLE");
    if (booking.review) {
      const previous = booking.review;
      if (previous.punctuality === input.punctuality && previous.communication === input.communication && previous.quality === input.quality && previous.comment === input.comment) return previous;
      throw new AppError(409, "Ten spacer został już oceniony.", "REVIEW_ALREADY_EXISTS");
    }
    return tx.sitterReview.create({ data: { bookingId, authorAccountId: accountId, sitterAccountId: booking.sitterAccountId, ...input } });
  });
}

export async function publicSitterReviews(profileId: string, input: z.infer<typeof listReviewsSchema>) {
  const profile = await prisma.sitterProfile.findFirst({ where: { id: profileId,
    account: { role: "USER", blockedAt: null, deactivatedAt: null, emailVerifiedAt: { not: null } } },
    select: { id: true, accountId: true, photoKey: true, city: true, account: { select: { userProfile: { select: { fullName: true } } } } } });
  if (!profile) throw new AppError(404, "Nie znaleziono opiekuna.", "SITTER_NOT_FOUND");
  let boundary: Prisma.SitterReviewWhereInput = {};
  if (input.cursor) {
    try {
      const cursor = z.object({ id: z.string().min(1).max(100), at: z.iso.datetime() }).parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString()));
      boundary = { OR: [{ createdAt: { lt: new Date(cursor.at) } }, { createdAt: new Date(cursor.at), id: { lt: cursor.id } }] };
    } catch { throw new AppError(400, "Nieprawidłowy kursor opinii.", "INVALID_CURSOR"); }
  }
  const [rows, summaries] = await Promise.all([
    prisma.sitterReview.findMany({ where: { sitterAccountId: profile.accountId, ...boundary }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: input.limit + 1,
      select: { id: true, punctuality: true, communication: true, quality: true, comment: true, createdAt: true,
        author: { select: { blockedAt: true, deactivatedAt: true, userProfile: { select: { fullName: true } } } } } }),
    reviewSummaries([profile.accountId])
  ]);
  const page = rows.slice(0, input.limit), last = page.at(-1);
  return {
    sitter: { id: profile.id, displayName: profile.account.userProfile?.fullName ?? "Opiekun Pupply", city: profile.city, photoUrl: await getPetPhotoUrl(profile.photoKey).catch(() => null) },
    summary: summaries.get(profile.accountId)!,
    items: page.map(({ author, ...review }) => {
      const parts = author.userProfile?.fullName.trim().split(/\s+/) ?? [];
      const authorName = !author.blockedAt && !author.deactivatedAt && parts.length
        ? [parts[0], parts.length > 1 ? `${Array.from(parts.at(-1)!)[0]}.` : ""].filter(Boolean).join(" ") : "Użytkownik";
      return { ...review, rating: round((review.punctuality + review.communication + review.quality) / 3), authorName };
    }),
    nextCursor: rows.length > input.limit && last ? Buffer.from(JSON.stringify({ id: last.id, at: last.createdAt.toISOString() })).toString("base64url") : null
  };
}
