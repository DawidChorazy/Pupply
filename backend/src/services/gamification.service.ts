import { AccountRole, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

const definitions = [
  {
    id: "first-pet",
    title: "Pierwszy pupil",
    description: "Dodaj pupila do swojego konta.",
    points: 50,
    target: 1,
    icon: "paw"
  },
  {
    id: "profile-complete",
    title: "Pełny profil pupila",
    description:
      "Uzupełnij imię, wiek, rasę, wagę i kontakt do weterynarza u jednego pupila.",
    points: 75,
    target: 5,
    icon: "dog-service"
  },
  {
    id: "first-walk",
    title: "Pierwszy zakończony spacer",
    description:
      "Zakończ spacer zarezerwowany w aplikacji. Opiekun potwierdza wykonanie po zakończeniu terminu.",
    points: 90,
    target: 1,
    icon: "walk"
  },
  {
    id: "regular-care",
    title: "Regularna opieka",
    description: "Zrealizuj 5 rezerwacji opieki nad swoimi pupilami.",
    points: 300,
    target: 5,
    icon: "calendar-star"
  }
] as const;

function requireUser(role: AccountRole) {
  if (role !== "USER")
    throw new AppError(
      403,
      "Questy i ranking są dostępne dla kont użytkowników.",
      "FORBIDDEN"
    );
}

async function state(accountId: string, db: Prisma.TransactionClient) {
  const [pets, completed, walks, claims] = await Promise.all([
    db.pet.findMany({
      where: { accountId },
      select: { name: true, age: true, breed: true, weight: true, vet: true }
    }),
    db.booking.count({
      where: { ownerAccountId: accountId, status: "COMPLETED" }
    }),
    db.booking.count({
      where: {
        ownerAccountId: accountId,
        status: "COMPLETED",
        sitterService: { type: "DOG_WALK" }
      }
    }),
    db.questClaim.findMany({ where: { accountId } })
  ]);
  const completeness = Math.max(
    0,
    ...pets.map(
      (pet) =>
        [
          Boolean(pet.name.trim()),
          pet.age !== null,
          Boolean(pet.breed?.trim()),
          pet.weight !== null && pet.weight > 0,
          Boolean(pet.vet?.trim())
        ].filter(Boolean).length
    )
  );
  const progress: Record<string, number> = {
    "first-pet": pets.length,
    "profile-complete": completeness,
    "first-walk": walks,
    "regular-care": completed
  };
  return {
    userPoints: claims.reduce((sum, claim) => sum + claim.points, 0),
    quests: definitions.map((definition) => {
      const claim = claims.find((item) => item.questId === definition.id);
      return {
        ...definition,
        points: claim?.points ?? definition.points,
        progress: claim
          ? definition.target
          : Math.min(progress[definition.id], definition.target),
        status: claim
          ? "claimed"
          : progress[definition.id] >= definition.target
            ? "available"
            : "locked"
      };
    })
  };
}

export async function getQuests(accountId: string, role: AccountRole) {
  requireUser(role);
  return prisma.$transaction((tx) => state(accountId, tx), {
    isolationLevel: "RepeatableRead"
  });
}

export async function claimQuest(
  accountId: string,
  role: AccountRole,
  questId: string
) {
  requireUser(role);
  if (!definitions.some((quest) => quest.id === questId))
    throw new AppError(404, "Nie znaleziono zadania.", "QUEST_NOT_FOUND");
  return prisma.$transaction(async (tx) => {
    const current = await state(accountId, tx);
    const quest = current.quests.find((item) => item.id === questId)!;
    if (quest.status === "locked")
      throw new AppError(
        409,
        "Najpierw wykonaj zadanie, aby odebrać punkty.",
        "QUEST_NOT_COMPLETED"
      );
    // The database unique key makes retries and simultaneous claims safe.
    await tx.questClaim.createMany({
      data: [{ accountId, questId, points: quest.points }],
      skipDuplicates: true
    });
    return state(accountId, tx);
  });
}

export async function getLeaderboard(accountId: string, role: AccountRole) {
  requireUser(role);
  const rows = await prisma.$queryRaw<
    {
      id: string;
      fullName: string;
      points: bigint;
      rank: bigint;
      position: bigint;
    }[]
  >`
    WITH scores AS (
      SELECT a.id, p."fullName", COALESCE(SUM(c.points), 0)::bigint AS points
      FROM "Account" a JOIN "UserProfile" p ON p."accountId" = a.id
      LEFT JOIN "QuestClaim" c ON c."accountId" = a.id
      WHERE a.role = 'USER' AND a."blockedAt" IS NULL AND a."deactivatedAt" IS NULL
      GROUP BY a.id, p."fullName"
    ), ranked AS (
      SELECT *, RANK() OVER (ORDER BY points DESC) AS rank,
        ROW_NUMBER() OVER (ORDER BY points DESC, id ASC) AS position FROM scores
    )
    SELECT * FROM ranked WHERE position <= 50 OR id = ${accountId} ORDER BY position
  `;
  const serialize = (row: (typeof rows)[number]) => {
    const parts = row.fullName.trim().split(/\s+/);
    const name = [
      parts[0],
      parts.length > 1 ? `${Array.from(parts[parts.length - 1])[0]}.` : ""
    ]
      .filter(Boolean)
      .join(" ");
    return {
      id: row.id,
      name,
      points: Number(row.points),
      rank: Number(row.rank),
      isCurrentUser: row.id === accountId
    };
  };
  return {
    leaderboard: rows.filter((row) => row.position <= 50n).map(serialize),
    currentUser: rows.find((row) => row.id === accountId)
      ? serialize(rows.find((row) => row.id === accountId)!)
      : null
  };
}
