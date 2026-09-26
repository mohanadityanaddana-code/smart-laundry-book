// HVR PG Laundry — real weather data for the "just finished laundry" moment.
//
// Uses Open-Meteo (free, no API key required) so the feature works out of the
// box. If the PG coordinates are not configured or the provider is down, the
// app reports exactly that instead of inventing percentages.
//
// Actions have no direct database access, so results are persisted through
// internal mutations below.

import { v } from "convex/values";
import { action, internalAction, internalMutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

type WeatherResult =
  | { ok: true; rainProbability: number; summary: string; guidance: string }
  | { ok: false; reason: "NOT_CONFIGURED" | "PROVIDER_DOWN" };

/** Persist a fetched report (called from the action). */
export const saveReport = internalMutation({
  args: {
    bookingDbId: v.id("bookings"),
    rainProbability: v.number(),
    summary: v.string(),
    guidance: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("weatherReports", {
      bookingDbId: args.bookingDbId,
      rainProbability: args.rainProbability,
      summary: args.summary,
      guidance: args.guidance,
      provider: "open-meteo",
      fetchedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Weather report for a finished booking (read by the weather card). */
export const forBooking = query({
  args: { bookingDbId: v.id("bookings") },
  handler: async (ctx, { bookingDbId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const cached = await ctx.db
      .query("weatherReports")
      .withIndex("by_booking", (q) => q.eq("bookingDbId", bookingDbId))
      .first();
    if (!cached) return null;
    return {
      rainProbability: cached.rainProbability,
      summary: cached.summary,
      guidance: cached.guidance,
      provider: cached.provider,
      fetchedAt: cached.fetchedAt,
    };
  },
});

/**
 * Internal action: fetch live weather, cache it, and notify the student.
 * Always resolves — failures come back as ok:false, never as fake data.
 */
export const fetchForBooking = internalAction({
  args: {
    bookingDbId: v.id("bookings"),
    userId: v.id("users"),
    machineNumber: v.number(),
  },
  handler: async (ctx, { bookingDbId, userId, machineNumber }): Promise<WeatherResult> => {
    const settings = await ctx.runQuery(internal.settingsDoc.get, {});

    if (!settings?.latitude || !settings?.longitude) {
      await ctx.runMutation(internal.notifications.createInternal, {
        userId,
        bookingDbId,
        type: "WEATHER_ALERT",
        title: "Weather info unavailable",
        message:
          "Drying guidance is temporarily unavailable — the PG location isn't configured yet. The PG owner can add it in Admin → Settings.",
      });
      return { ok: false, reason: "NOT_CONFIGURED" };
    }

    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${settings.latitude}` +
        `&longitude=${settings.longitude}` +
        `&hourly=precipitation_probability&forecast_days=2&timezone=Asia%2FKolkata`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("provider error");

      const data = await res.json();
      const times: string[] = data?.hourly?.time ?? [];
      const probs: number[] = data?.hourly?.precipitation_probability ?? [];
      if (times.length === 0) throw new Error("empty forecast");

      // "YYYY-MM-DDTHH" for the current IST hour; look 6 hours ahead.
      const istNow = new Date(Date.now() + 5.5 * 3600_000);
      const hourKey = istNow.toISOString().slice(0, 13);
      const next6 = times
        .map((t, i) => ({ t, p: probs[i] ?? 0 }))
        .filter((x) => x.t >= hourKey)
        .slice(0, 6);
      if (next6.length === 0) throw new Error("no forecast window");

      const maxProb = Math.max(...next6.map((x) => x.p));
      const avgProb = Math.round(
        next6.reduce((acc, x) => acc + x.p, 0) / next6.length,
      );
      const score = Math.round((maxProb + avgProb) / 2);

      const summary =
        score >= 60
          ? "Rain is likely in the next few hours."
          : score >= 35
            ? "There's a fair chance of rain — keep an eye on the sky."
            : "Conditions look suitable for drying clothes.";

      const guidance =
        score >= 60
          ? "Consider using an indoor drying area."
          : score >= 35
            ? "If you've hung clothes outside, bring them in early."
            : "Great time to line-dry outdoors.";

      await ctx.runMutation(internal.weather.saveReport, {
        bookingDbId,
        rainProbability: score,
        summary,
        guidance,
      });

      await ctx.runMutation(internal.notifications.createInternal, {
        userId,
        bookingDbId,
        type: "WEATHER_ALERT",
        title:
          score >= 60
            ? `Rain alert — ${score}% chance of rain`
            : `Drying conditions — ${score}% chance of rain`,
        message: `Machine ${machineNumber}: ${summary} ${guidance}`,
      });

      return { ok: true, rainProbability: score, summary, guidance };
    } catch {
      await ctx.runMutation(internal.notifications.createInternal, {
        userId,
        bookingDbId,
        type: "WEATHER_ALERT",
        title: "Weather info unavailable",
        message:
          "We couldn't reach the weather service just now. Your laundry is recorded — check back shortly for drying guidance.",
      });
      return { ok: false, reason: "PROVIDER_DOWN" };
    }
  },
});
