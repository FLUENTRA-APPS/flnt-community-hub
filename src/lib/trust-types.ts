import { z } from "zod";

export type BusinessStats = {
  id: string;
  slug: string;
  sellerName: string;
  businessType: string;
  organicCount: number;
  organicAvg: number;
  adjustCount: number;
  totalCount: number;
  totalAvg: number;
  verified: boolean;
  badgeOverride: boolean | null;
  createdAt: string;
};

export type BusinessReview = {
  id: string;
  authorName: string;
  stars: number;
  review: string;
  createdAt: string;
};

export const createBusinessSchema = z.object({
  sellerName: z.string().trim().min(2).max(80),
  businessType: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(15)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes only"),
});

export const ratingSchema = z.object({
  businessId: z.string().uuid(),
  stars: z
    .number()
    .min(0.5)
    .max(5)
    .refine((v) => Number.isInteger(v * 2), "Ratings move in half stars"),
  review: z.string().trim().max(2000).default(""),
});

export type StatsRow = {
  id: string;
  slug: string;
  seller_name: string;
  business_type: string;
  created_at: string;
  organic_count: number;
  organic_avg: number | string;
  adjust_count: number;
  total_count: number;
  total_avg: number | string;
  verified: boolean;
  badge_override: boolean | null;
};

export function mapStats(row: StatsRow): BusinessStats {
  return {
    id: row.id,
    slug: row.slug,
    sellerName: row.seller_name,
    businessType: row.business_type,
    organicCount: row.organic_count,
    organicAvg: Number(row.organic_avg ?? 0),
    adjustCount: row.adjust_count,
    totalCount: row.total_count,
    totalAvg: Number(row.total_avg ?? 0),
    verified: Boolean(row.verified),
    badgeOverride: row.badge_override,
    createdAt: row.created_at,
  };
}

export const STATS_SELECT =
  "id, slug, seller_name, business_type, created_at, organic_count, organic_avg, adjust_count, total_count, total_avg, verified, badge_override";
