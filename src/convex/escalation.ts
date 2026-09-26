// HVR PG Laundry — escalation & auto-cancellation workflow.
//
// When a student is notified that their machine is ready, they have a window
// to respond. No response → reminder → final window → auto-cancel → notify
// the next student. Every step is written to bookingEvents so the admin
// Events page shows the full history. The sweep is idempotent and is invoked
// reactively from the app shell, so it runs whenever any signed-in user has
// the app open (serving as the escalation timer).

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  currentIstDate,
  currentIstSecondsOfDay,
  secondsTo12h,
} from "./time";

async function logEvent(
  ctx: any,
  bookingDbId: any,
  eventType: string,
  detail: string,
) {
  await ctx.db.insert("bookingEvents", {
    bookingDbId,
    eventType,
    detail,
    at: Date.now(),
  });
}

/**
 * Public sweep mutation — idempotent, safe to call whenever the app is open.
 *
 * 1. Starting-soon notifications (once per booking, 20 min before start).
 * 2. Reminder notification after reminderTimeoutMinutes without a response.
 * 3. Final response window, then auto-cancel, notify next student, log voice
 *    attempt (mock provider) — all recorded in event history.
 */
export const sweep = mutation({
  args: {},
  handler: async (ctx): Promise<{ actions: string[] }> => {
    const now = Date.now();
    const today = currentIstDate(now);
    const nowSec = currentIstSecondsOfDay(now);
    const settings = await ctx.db.query("settings").first();
    if (!settings) return { actions: [] };

    const reminderMs = (settings.reminderTimeoutMinutes ?? 10) * 60_000;
    const finalMs = (settings.finalResponseMinutes ?? 5) * 60_000;
    const actions: string[] = [];

    // ---------------------------------------------------------------
    // 1. Starting-soon notifications for today's confirmed bookings.
    // ---------------------------------------------------------------
    const todays = await ctx.db
      .query("bookings")
      .withIndex("by_date", (q) => q.eq("date", today))
      .filter((q) => q.eq(q.field("status"), "CONFIRMED"))
      .collect();

    for (const b of todays) {
      const startsIn = b.startSeconds - nowSec;
      if (startsIn <= 0 || startsIn > 20 * 60) continue;
      const existing = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", b.userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("type"), "STARTING_SOON"),
            q.eq(q.field("bookingDbId"), b._id),
          ),
        )
        .first();
      if (existing) continue;
      const machine = await ctx.db.get(b.machineId);
      await ctx.db.insert("notifications", {
        userId: b.userId,
        bookingDbId: b._id,
        type: "STARTING_SOON",
        title: "Laundry starting soon",
        message: `Machine ${machine?.machineNumber ?? ""} — your slot ${secondsTo12h(b.startSeconds)} – ${secondsTo12h(b.endSeconds)} starts in about 20 minutes.`,
        createdAt: now,
      });
      await logEvent(ctx, b._id, "STARTING_SOON_SENT", "20-minute reminder notification delivered");
      actions.push(`starting-soon:${b.bookingId}`);
    }

    // ---------------------------------------------------------------
    // 2. Escalation chasing on today's machine-ready bookings.
    //    A booking is being chased when its escalationState is set.
    // ---------------------------------------------------------------
    const chasing = todays.filter(
      (b) =>
        b.escalationState === "NOTIFIED" ||
        b.escalationState === "REMINDED" ||
        b.escalationState === "FINAL_WINDOW",
    );

    for (const b of chasing) {
      const machine = await ctx.db.get(b.machineId);
      const machineNo = machine?.machineNumber ?? "";
      const firstNotifiedAt = b.firstNotifiedAt ?? now;

      // Student responded (any actionState on their latest notif) → stop.
      const latest = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", b.userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("type"), "MACHINE_READY"),
            q.eq(q.field("bookingDbId"), b._id),
          ),
        )
        .first();
      if (
        latest?.actionState === "ACKNOWLEDGED" ||
        latest?.actionState === "DECLINED" ||
        latest?.actionState === "NEEDS_TIME"
      ) {
        continue;
      }

      if (b.escalationState === "NOTIFIED" && now - firstNotifiedAt >= reminderMs) {
        await ctx.db.patch(b._id, {
          escalationState: "REMINDED",
          remindedAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("notifications", {
          userId: b.userId,
          bookingDbId: b._id,
          type: "REMINDER",
          title: `Reminder — Machine ${machineNo} is waiting`,
          message: `You haven't responded yet. Please confirm you're coming, or your slot ${secondsTo12h(b.startSeconds)} – ${secondsTo12h(b.endSeconds)} may be released.`,
          actionState: "PENDING",
          createdAt: now,
        });
        await ctx.runMutation(internal.voice.dispatchCall, {
          bookingDbId: b._id,
          targetUserId: b.userId,
          type: "machine_ready_reminder",
          message: `Hello, this is HVR PG Laundry. Your machine ${machineNo} slot is ready. Please respond in the app.`,
          attemptNumber: 2,
        });
        await logEvent(ctx, b._id, "REMINDER_SENT", `Second notification + voice attempt after ${settings.reminderTimeoutMinutes ?? 10} min of silence`);
        actions.push(`reminded:${b.bookingId}`);
      } else if (
        b.escalationState === "REMINDED" &&
        now - (b.remindedAt ?? now) >= finalMs
      ) {
        // Final window: mark it, wait finalResponseMinutes more.
        await ctx.db.patch(b._id, {
          escalationState: "FINAL_WINDOW",
          finalDeadline: now + finalMs,
          updatedAt: now,
        });
        await logEvent(ctx, b._id, "FINAL_WINDOW", `Final response window of ${settings.finalResponseMinutes ?? 5} min started`);
        actions.push(`final-window:${b.bookingId}`);
      } else if (
        b.escalationState === "FINAL_WINDOW" &&
        (b.finalDeadline ?? 0) <= now
      ) {
        // ---------------- AUTO-CANCEL ----------------
        await ctx.db.patch(b._id, {
          status: "CANCELLED",
          cancelledAt: now,
          cancellationReason: "AUTO_CANCEL_NO_RESPONSE",
          updatedAt: now,
        });
        const user = await ctx.db.get(b.userId);
        await ctx.db.insert("notifications", {
          userId: b.userId,
          bookingDbId: b._id,
          type: "AUTO_CANCELLED",
          title: "Booking auto-cancelled",
          message: `Your Machine ${machineNo} slot ${secondsTo12h(b.startSeconds)} – ${secondsTo12h(b.endSeconds)} was released automatically because no response was received. You can book a new slot anytime.`,
          createdAt: now,
        });
        await logEvent(ctx, b._id, "AUTO_CANCELLED", "No response after reminder and final window — booking auto-cancelled");

        // Find and notify the next eligible student on this machine.
        const upcoming = await ctx.db
          .query("bookings")
          .withIndex("by_machine_date", (q) =>
            q.eq("machineId", b.machineId).eq("date", today),
          )
          .filter((q) => q.eq(q.field("status"), "CONFIRMED"))
          .collect();
        const next = upcoming
          .filter((o) => o._id !== b._id && o.startSeconds >= nowSec)
          .sort((x, y) => x.startSeconds - y.startSeconds)[0];
        if (next) {
          const nextUser = await ctx.db.get(next.userId);
          await ctx.db.insert("notifications", {
            userId: next.userId,
            bookingDbId: next._id,
            type: "MACHINE_READY",
            title: `Machine ${machineNo} is ready`,
            message: `The previous booking was released. Your slot ${secondsTo12h(next.startSeconds)} – ${secondsTo12h(next.endSeconds)} can start now.`,
            actionState: "PENDING",
            createdAt: now,
          });
          await ctx.db.patch(next._id, {
            escalationState: "NOTIFIED",
            firstNotifiedAt: now,
            updatedAt: now,
          });
          await logEvent(ctx, next._id, "NEXT_STUDENT_NOTIFIED", `Next student ${nextUser?.name ?? ""} notified after auto-cancellation`);
        }
        actions.push(`auto-cancelled:${b.bookingId}`);
      }
    }

    return { actions };
  },
});
