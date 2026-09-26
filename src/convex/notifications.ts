// HVR PG Laundry — in-app notification center.
//
// Students are notified in-app when: a booking is confirmed, a machine becomes
// ready (the previous student finished), a slot is cancelled, a machine goes
// into maintenance, or weather guidance is attached after finishing laundry.
// Machine-ready notifications carry an action prompt the student can respond
// to ("I'm coming" / "Can't come") straight from the notification.

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type NotifType =
  | "BOOKING_CONFIRMED"
  | "MACHINE_READY"
  | "PREVIOUS_FINISHED"
  | "SLOT_CANCELLED"
  | "MACHINE_MAINTENANCE"
  | "WEATHER_ALERT"
  | "PG_SUPPORT";

type ActionState = "PENDING" | "ACKNOWLEDGED" | "DECLINED";

/** Internal helper so other modules can create notifications. */
export const createInternal = internalMutation({
  args: {
    userId: v.id("users"),
    bookingDbId: v.optional(v.id("bookings")),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    withAction: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actionState: ActionState | undefined =
      args.type === "MACHINE_READY" && args.withAction ? "PENDING" : undefined;
    await ctx.db.insert("notifications", {
      userId: args.userId,
      bookingDbId: args.bookingDbId,
      type: args.type as NotifType,
      title: args.title,
      message: args.message,
      actionState,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** The signed-in student's notifications, newest first. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(60);
    return rows.map((n) => ({
      _id: n._id,
      type: n.type,
      title: n.title,
      message: n.message,
      actionState: n.actionState ?? null,
      readAt: n.readAt ?? null,
      createdAt: n.createdAt,
      bookingDbId: n.bookingDbId ?? null,
    }));
  },
});

/** Unread count for the nav bell badge. */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.filter((n) => n.readAt === undefined).length;
  },
});

/** Mark one notification as read. */
export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not signed in");
    const n = await ctx.db.get(notificationId);
    if (!n || n.userId !== userId) throw new ConvexError("Not found");
    if (n.readAt === undefined) {
      await ctx.db.patch(notificationId, { readAt: Date.now() });
    }
    return { ok: true };
  },
});

/** Mark every notification as read. */
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not signed in");
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    for (const n of rows) {
      if (n.readAt === undefined) await ctx.db.patch(n._id, { readAt: now });
    }
    return { ok: true };
  },
});

/**
 * Student response to a machine-ready prompt. "I'm coming" acknowledges and
 * stops further chasing; "Can't come" cancels the booking (freeing the slot).
 */
export const respondToReady = mutation({
  args: {
    notificationId: v.id("notifications"),
    response: v.union(v.literal("COMING"), v.literal("CANT_COME")),
  },
  handler: async (ctx, { notificationId, response }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not signed in");
    const n = await ctx.db.get(notificationId);
    if (!n || n.userId !== userId) throw new ConvexError("Not found");
    if (n.actionState !== "PENDING") {
      throw new ConvexError("This notification was already handled");
    }

    await ctx.db.patch(notificationId, {
      actionState: response === "COMING" ? "ACKNOWLEDGED" : "DECLINED",
      readAt: n.readAt ?? Date.now(),
    });

    if (response === "CANT_COME" && n.bookingDbId) {
      const booking = await ctx.db.get(n.bookingDbId);
      if (booking && booking.status === "CONFIRMED") {
        await ctx.db.patch(booking._id, {
          status: "CANCELLED",
          cancelledAt: Date.now(),
          cancellationReason: "STUDENT_CANCELLED",
          updatedAt: Date.now(),
        });
      }
    }
    return { ok: true };
  },
});
