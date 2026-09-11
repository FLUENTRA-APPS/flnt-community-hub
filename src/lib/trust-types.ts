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

