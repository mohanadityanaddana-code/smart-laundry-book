// HVR PG Laundry — persistence + authorization for the AI advice flow.
//
// Queries/mutations live in this separate module because ai.ts is a "use node"
// action module (Convex requires node actions to live apart from db-accessing
// functions). The validated AI result is stored on the booking's existing
// event history (bookingEvents) — the same history used for LAUNDRY_FINISHED,
// escalations and admin actions. No schema migration, no new tables.
//
// Security notes:
//  - bookingAdviceContext resolves the signed-in user server-side and only
//    returns data when the caller owns the booking (or is an admin).
//  - The GEMINI_API_KEY never passes through here; only validated AI text.

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

/** seconds-from-midnight -> "5:30 PM" (mirrors time.ts's display helper). */
function to12h(seconds: number): string {
  const h24 = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const suffix = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

async function requireUserDoc(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not signed in");
  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("Account not found");
  return user;
}

/**
 * Server-side owner check + context gathering for the Gemini call.
 * Returns null when the booking doesn't exist or the caller isn't its owner
 * (admins may inspect, matching cancelMyBooking/finishBooking semantics).
 */
export const bookingAdviceContext = internalQuery({
  args: { bookingDbId: v.id("bookings") },
  handler: async (ctx, { bookingDbId }) => {
    const user = await requireUserDoc(ctx);
    const booking = await ctx.db.get(bookingDbId);
    if (!booking) return null;
    if (booking.userId !== user._id && user.role !== "admin") return null;

    const machine = await ctx.db.get(booking.machineId);
    const owner = await ctx.db.get(booking.userId);

    // Reuse the cached real weather report if the flow already fetched one;
    // otherwise pass an honest "not available" so Gemini isn't asked to guess.
    const cached = await ctx.db
      .query("weatherReports")
      .withIndex("by_booking", (q) => q.eq("bookingDbId", bookingDbId))
      .first();

    return {
      studentName: owner?.name ?? "student",
      machineNumber: machine?.machineNumber ?? 0,
      date: booking.date,
      startLabel: to12h(booking.startSeconds),
      endLabel: to12h(booking.endSeconds),
      weatherSummary: cached?.summary ?? "not available",
      rainProbability: cached?.rainProbability ?? 0,
      guidance: cached?.guidance ?? "not available",
    };
  },
});

/**
 * Internal diagnostic: returns one existing booking id (CLI verification of
 * the AI action without an authenticated session). Not exposed publicly.
 */
export const sampleBookingId = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("bookings").order("desc").first();
    return { bookingDbId: row?._id ?? null, date: row?.date ?? null };
  },
});

/**
 * Persist a validated Gemini result to the booking's existing event history.
 * Called only from ai.ts after full output validation.
 */
export const saveAdvice = internalMutation({
  args: {
    bookingDbId: v.id("bookings"),
    title: v.string(),
    message: v.string(),
    dryingTip: v.string(),
    indoorRecommended: v.boolean(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("bookingEvents", {
      bookingDbId: args.bookingDbId,
      eventType: "AI_ADVICE",
      detail: `${args.title} — ${args.message}${args.dryingTip ? ` Tip: ${args.dryingTip}` : ""} [${args.model}, indoor: ${args.indoorRecommended ? "yes" : "no"}]`,
      at: Date.now(),
    });
    return { ok: true };
  },
});
