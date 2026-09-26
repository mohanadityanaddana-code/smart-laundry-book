// HVR PG Laundry — public action wrapper for the finish-laundry flow.
//
// Actions can't authenticate users directly, so the finish mutation resolves
// the booking's owner server-side; the action simply chains the steps and
// returns an explicitly typed result (breaking Convex's inference cycle).

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

type FinishWeather =
  | { ok: true; rainProbability: number; summary: string; guidance: string }
  | { ok: false; reason: string };

type AiAdvice =
  | { ok: true; title: string; message: string; dryingTip: string; indoorRecommended: boolean; model: string }
  | { ok: false; reason: string; detail: string; model: string };

export const finishAndFetchWeather = action({
  args: { bookingDbId: v.id("bookings") },
  handler: async (ctx, { bookingDbId }): Promise<{
    finish: {
      ok: boolean;
      machineNumber: number;
      nextStudentName: string | null;
      nextStartSeconds: number | null;
    };
    weather: FinishWeather | null;
    aiAdvice: AiAdvice | null;
  }> => {
    // 1. Finish the booking (ownership + state validated inside the mutation)
    //    and notify the next student that the machine is ready.
    const finish = await ctx.runMutation(api.bookings.finishBooking, {
      bookingDbId,
    });

    // 2. Resolve the booking owner server-side (never trust the client).
    const owner = await ctx.runQuery(internal.bookings.bookingOwner, {
      bookingDbId,
    });

    // 3. Fetch real weather for the drying-guidance card (best effort).
    let weather: FinishWeather | null = null;
    if (owner) {
      weather = await ctx.runAction(internal.weather.fetchForBooking, {
        bookingDbId,
        userId: owner,
        machineNumber: finish.machineNumber,
      });
    }

    // 4. Real Gemini advice (advisory only; booking outcome unchanged).
    //    Uses the weather we just fetched; the date/slot come from the
    //    persisted booking so the AI never influences them.
    let aiAdvice: AiAdvice | null = null;
    try {
      const ctxInfo = await ctx.runQuery(internal.aiPersist.bookingAdviceContext, {
        bookingDbId,
      });
      if (ctxInfo) {
        aiAdvice = (await ctx.runAction(internal.ai.adviceForBooking, {
          bookingDbId,
          studentName: ctxInfo.studentName,
          machineNumber: ctxInfo.machineNumber,
          date: ctxInfo.date,
          startLabel: ctxInfo.startLabel,
          endLabel: ctxInfo.endLabel,
          weatherSummary: ctxInfo.weatherSummary,
          rainProbability: ctxInfo.rainProbability,
          guidance: ctxInfo.guidance,
        })) as AiAdvice;
      }
    } catch {
      aiAdvice = null;
    }

    return { finish, weather, aiAdvice };
  },
});
