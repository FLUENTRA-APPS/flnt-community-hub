import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createBusinessSchema,
  mapStats,
  ratingSchema,
  STATS_SELECT,
  type BusinessReview,
  type BusinessStats,
} from "./trust-types";

export const listBusinesses = createServerFn({ method: "GET" }).handler(
  async (): Promise<BusinessStats[]> => {
    const { publicClient } = await import("./server-shared.server");
    const { data } = await publicClient()
      .from("business_stats")
      .select(STATS_SELECT)
      .order("total_count", { ascending: false })
      .limit(100);
    return (data ?? []).map((row) => mapStats(row as never));
  },
);

export const getBusiness = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().trim().toLowerCase().max(15) }).parse(input),
  )
  .handler(
    async ({ data }): Promise<{ business: BusinessStats; reviews: BusinessReview[] } | null> => {
      const { publicClient } = await import("./server-shared.server");
      const client = publicClient();
      const { data: row } = await client
        .from("business_stats")
        .select(STATS_SELECT)
        .eq("slug", data.slug)
        .maybeSingle();
      if (!row) return null;

      const business = mapStats(row as never);
      const { data: reviews } = await client
        .from("business_ratings")
        .select("id, author_name, stars, review, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(100);

      return {
        business,
        reviews: (reviews ?? []).map((r) => ({
          id: r.id,
          authorName: r.author_name,
          stars: Number(r.stars),
          review: r.review,
          createdAt: r.created_at,
        })),
      };
    },
  );

export const createBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof createBusinessSchema>) => createBusinessSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ slug: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireVerifiedAccount } = await import("./guards.server");
    const account = await requireVerifiedAccount(context.userId, context.claims);

    const { count } = await supabaseAdmin
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", account.userId);
    if ((count ?? 0) >= 3) throw new Error("You can list up to 3 businesses per account.");

    const { data: clash } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (clash) throw new Error("That business name is already taken.");

    const { error } = await supabaseAdmin.from("businesses").insert({
      slug: data.slug,
      seller_name: data.sellerName,
      business_type: data.businessType,
      owner_id: account.userId,
    });
    if (error) throw new Error("Could not create the listing.");
    return { slug: data.slug };
  });

export const submitRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof ratingSchema>) => ratingSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireVerifiedAccount } = await import("./guards.server");
    const account = await requireVerifiedAccount(context.userId, context.claims);

    const { error } = await supabaseAdmin.from("business_ratings").insert({
      business_id: data.businessId,
      user_id: account.userId,
      author_name: account.displayName || "member",
      stars: data.stars,
      review: data.review,
    });

    if (error) {
      if (error.message.includes("24 hours")) {
        throw new Error("You can only rate this business once every 24 hours.");
      }
      throw new Error("Could not save your rating.");
    }
    return { ok: true };
  });

export const getMyRatingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { businessId: string }) =>
    z.object({ businessId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ nextAllowedAt: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: last } = await supabaseAdmin
      .from("business_ratings")
      .select("created_at")
      .eq("business_id", data.businessId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last) return { nextAllowedAt: null };
    const next = new Date(new Date(last.created_at).getTime() + 24 * 60 * 60 * 1000);
    return { nextAllowedAt: next > new Date() ? next.toISOString() : null };
  });
