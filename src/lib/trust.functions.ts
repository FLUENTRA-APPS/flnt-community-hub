import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createBusinessSchema,
  ratingSchema,
  type BusinessReview,
  type BusinessStats,
} from "./trust-types";
import type { BusinessRecord, RatingRecord, TrustDoc } from "./data-types";

const VERIFIED_MIN_COUNT = 5000;
const VERIFIED_MIN_AVG = 2.5;

export function computeStats(business: BusinessRecord, ratings: RatingRecord[]): BusinessStats {
  const own = ratings.filter((r) => r.businessId === business.id);
  const organicCount = own.length;
  const organicSum = own.reduce((sum, r) => sum + r.stars, 0);
  const totalCount = organicCount + business.adjustCount;
  const totalSum = organicSum + business.adjustSum;
  const totalAvg = totalCount ? totalSum / totalCount : 0;
  const earned = totalCount >= VERIFIED_MIN_COUNT && totalAvg > VERIFIED_MIN_AVG;

  return {
    id: business.id,
    slug: business.slug,
    sellerName: business.sellerName,
    businessType: business.businessType,
    organicCount,
    organicAvg: organicCount ? organicSum / organicCount : 0,
    adjustCount: business.adjustCount,
    totalCount,
    totalAvg,
    verified: business.badgeOverride ?? earned,
    badgeOverride: business.badgeOverride,
    createdAt: business.createdAt,
  };
}

export const listBusinesses = createServerFn({ method: "GET" }).handler(
  async (): Promise<BusinessStats[]> => {
    const { readDoc } = await import("./store.server");
    const doc = await readDoc<TrustDoc>("trust.json");
    return doc.businesses
      .map((b) => computeStats(b, doc.ratings))
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 100);
  },
);

export const getBusiness = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().trim().toLowerCase().max(15) }).parse(input),
  )
  .handler(
    async ({ data }): Promise<{ business: BusinessStats; reviews: BusinessReview[] } | null> => {
      const { readDoc } = await import("./store.server");
      const doc = await readDoc<TrustDoc>("trust.json");
      const record = doc.businesses.find((b) => b.slug === data.slug);
      if (!record) return null;

      return {
        business: computeStats(record, doc.ratings),
        reviews: doc.ratings
          .filter((r) => r.businessId === record.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 100)
          .map((r) => ({
            id: r.id,
            authorName: r.authorName,
            stars: r.stars,
            review: r.review,
            createdAt: r.createdAt,
          })),
      };
    },
  );

export const createBusiness = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof createBusinessSchema>) => createBusinessSchema.parse(input))
  .handler(async ({ data }): Promise<{ slug: string }> => {
    const { requireVerifiedAccount } = await import("./guards.server");
    const { mutateDoc, newId } = await import("./store.server");
    const account = await requireVerifiedAccount();

    return mutateDoc<TrustDoc, { slug: string }>("trust.json", (doc) => {
      const mine = doc.businesses.filter((b) => b.ownerId === account.userId);
      if (mine.length >= 3) throw new Error("You can list up to 3 businesses per account.");
      if (doc.businesses.some((b) => b.slug === data.slug)) {
        throw new Error("That business name is already taken.");
      }
      doc.businesses.push({
        id: newId(),
        slug: data.slug,
        sellerName: data.sellerName,
        businessType: data.businessType,
        ownerId: account.userId,
        badgeOverride: null,
        adjustCount: 0,
        adjustSum: 0,
        createdAt: new Date().toISOString(),
      });
      return { slug: data.slug };
    });
  });

export const submitRating = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof ratingSchema>) => ratingSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { requireVerifiedAccount } = await import("./guards.server");
    const { mutateDoc, newId } = await import("./store.server");
    const account = await requireVerifiedAccount();

    await mutateDoc<TrustDoc, void>("trust.json", (doc) => {
      const business = doc.businesses.find((b) => b.id === data.businessId);
      if (!business) throw new Error("Business not found.");

      const last = doc.ratings
        .filter((r) => r.businessId === data.businessId && r.userId === account.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (last && Date.now() - new Date(last.createdAt).getTime() < 24 * 60 * 60 * 1000) {
        throw new Error("You can only rate this business once every 24 hours.");
      }

      doc.ratings.push({
        id: newId(),
        businessId: data.businessId,
        userId: account.userId,
        authorName: account.displayName || "member",
        stars: data.stars,
        review: data.review,
        createdAt: new Date().toISOString(),
      });
    });
    return { ok: true };
  });

export const getMyRatingStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { businessId: string }) =>
    z.object({ businessId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ nextAllowedAt: string | null }> => {
    const { currentUserId } = await import("./auth-core.server");
    const { readDoc } = await import("./store.server");
    const userId = await currentUserId();
    if (!userId) return { nextAllowedAt: null };

    const doc = await readDoc<TrustDoc>("trust.json");
    const last = doc.ratings
      .filter((r) => r.businessId === data.businessId && r.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!last) return { nextAllowedAt: null };
    const next = new Date(new Date(last.createdAt).getTime() + 24 * 60 * 60 * 1000);
    return { nextAllowedAt: next > new Date() ? next.toISOString() : null };
  });
