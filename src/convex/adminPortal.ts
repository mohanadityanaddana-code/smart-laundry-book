// HVR PG Laundry — admin portal backend: audit log, event feed, notification
// records, machine event history and booking rescheduling.
//
// Every function is admin-guarded on the server: the role is read from the
// database (never from the client), so direct API calls from students fail.

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  addDays,
  currentIstDate,
  currentIstSecondsOfDay,
  generateSlotGrid,
  secondsTo12h,
  weekDates,
} from "./time";
import { requireAdmin, requireSettings, confirmedForMachineDate } from "./bookings";

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

/** Record an admin action (called inside admin mutations). */
export async function audit(
  ctx: { db: { insert(t: "auditLog", d: unknown): Promise<any> } },
  adminUserId: any,
  action: string,
  targetEntity: string,
  targetId: string | null,
  metadata: string,
) {
  await ctx.db.insert("auditLog", {
    adminUserId,
    action,
    targetEntity,
    targetId,
    metadata,
    at: Date.now(),
  });
}

/** Admin audit log — admin-only, newest first. */
export const auditLog = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const rows = await ctx.db.query("auditLog").order("desc").take(150);
    return rows.map((r) => ({
      _id: r._id,
      action: r.action,
      targetEntity: r.targetEntity,
      targetId: r.targetId,
      metadata: r.metadata,
      adminName: "",
      at: r.at,
      adminUserId: r.adminUserId,
    }));
  },
});

/* ------------------------------------------------------------------ */
/* System event feed                                                   */
/* ------------------------------------------------------------------ */

/** All booking/system events (admin-only), newest first. */
export const allEvents = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("bookingEvents").order("desc").take(200);
    const out = [];
    for (const e of rows) {
      const booking = await ctx.db.get(e.bookingDbId);
      const user = booking ? await ctx.db.get(booking.userId) : null;
      const machine = booking ? await ctx.db.get(booking.machineId) : null;
      out.push({
        _id: e._id,
        eventType: e.eventType,
        detail: e.detail,
        at: e.at,
        bookingId: booking?.bookingId ?? null,
        studentName: user?.name ?? null,
        machineNumber: machine?.machineNumber ?? null,
      });
    }
    return out;
  },
});

/** Event timeline for one booking (admin booking-detail drawer). */
export const bookingTimeline = query({
  args: { bookingDbId: v.id("bookings") },
  handler: async (ctx, { bookingDbId }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("bookingEvents")
      .withIndex("by_booking", (q) => q.eq("bookingDbId", bookingDbId))
      .collect();
    return rows.sort((a, b) => b.at - a.at).map((e) => ({
      _id: e._id,
      eventType: e.eventType,
      detail: e.detail,
      at: e.at,
    }));
  },
});

/* ------------------------------------------------------------------ */
/* Notifications (admin view)                                          */
/* ------------------------------------------------------------------ */

/** All notifications with recipient info (admin-only). */
export const allNotifications = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("notifications").order("desc").take(150);
    const out = [];
    for (const n of rows) {
      const user = await ctx.db.get(n.userId);
      const booking = n.bookingDbId ? await ctx.db.get(n.bookingDbId) : null;
      const machine = booking ? await ctx.db.get(booking.machineId) : null;
      out.push({
        _id: n._id,
        recipientName: user?.name ?? "Student",
        type: n.type,
        title: n.title,
        message: n.message,
        actionState: n.actionState ?? null,
        readAt: n.readAt ?? null,
        createdAt: n.createdAt,
        bookingId: booking?.bookingId ?? null,
        machineNumber: machine?.machineNumber ?? null,
      });
    }
    return out;
  },
});

/** Send an administrative announcement to every non-anonymous student. */
export const sendAnnouncement = mutation({
  args: { title: v.string(), message: v.string() },
  handler: async (ctx, { title, message }) => {
    const admin = await requireAdmin(ctx);
    if (title.trim().length < 3) throw new ConvexError("Title is too short");
    if (message.trim().length < 3) throw new ConvexError("Message is too short");
    const users = await ctx.db.query("users").collect();
    const now = Date.now();
    let count = 0;
    for (const u of users) {
      if (u.isAnonymous) continue;
      await ctx.db.insert("notifications", {
        userId: u._id,
        type: "PG_SUPPORT",
        title: title.trim(),
        message: message.trim(),
        createdAt: now,
      });
      count += 1;
    }
    await audit(ctx, admin._id, "ANNOUNCEMENT_SENT", "notification", null, `${title} — delivered to ${count} students`);
    return { count };
  },
});

/* ------------------------------------------------------------------ */
/* Machine extras                                                      */
/* ------------------------------------------------------------------ */

/** Event history for one machine (admin machine detail). */
export const machineEvents = query({
  args: { machineId: v.id("machines") },
  handler: async (ctx, { machineId }) => {
    await requireAdmin(ctx);
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_machine_date", (q) => q.eq("machineId", machineId))
      .collect()
      .then((rows) => rows.slice(0, 80));
    const events = [];
    for (const b of bookings) {
      const rows = await ctx.db
        .query("bookingEvents")
        .withIndex("by_booking", (q) => q.eq("bookingDbId", b._id))
        .collect();
      for (const e of rows) {
        events.push({ ...e, bookingId: b.bookingId, date: b.date });
      }
    }
    return events.sort((a, b) => b.at - a.at).slice(0, 60);
  },
});

/* ------------------------------------------------------------------ */
/* Rescheduling                                                        */
/* ------------------------------------------------------------------ */

/**
 * Admin-initiated reschedule: moves a confirmed booking to another open slot
 * on the same machine. Validates the target slot against every booking rule,
 * records the event, and notifies the student — never moves silently.
 */
export const rescheduleBooking = mutation({
  args: {
    bookingDbId: v.id("bookings"),
    newStartSeconds: v.number(),
  },
  handler: async (ctx, { bookingDbId, newStartSeconds }) => {
    const admin = await requireAdmin(ctx);
    const booking = await ctx.db.get(bookingDbId);
    if (!booking) throw new ConvexError("Booking not found");
    if (booking.status !== "CONFIRMED") {
      throw new ConvexError("Only confirmed bookings can be rescheduled");
    }

    const settings = await requireSettings(ctx);
    const machine = await ctx.db.get(booking.machineId);
    if (!machine) throw new ConvexError("Machine not found");

    const now = Date.now();
    const today = currentIstDate(now);
    const nowSec = currentIstSecondsOfDay(now);
    const duration = booking.endSeconds - booking.startSeconds;
    const newEnd = newStartSeconds + duration;

    // Validate against the same rules as the booking engine.
    const grid = generateSlotGrid(settings.openSeconds, settings.closeSeconds, duration);
    if (!grid.some((s) => s.start === newStartSeconds)) {
      throw new ConvexError("Target time is not a valid slot");
    }
    if (booking.date < today || (booking.date === today && newEnd <= nowSec)) {
      throw new ConvexError("Target time has already passed");
    }
    const others = await confirmedForMachineDate(ctx, machine._id, booking.date);
    const clash = others.find(
      (b) => b._id !== bookingDbId && b.startSeconds < newEnd && newStartSeconds < b.endSeconds,
    );
    if (clash) throw new ConvexError("Another booking already occupies that time");
    const ownDay = await ctx.db
      .query("bookings")
      .withIndex("by_user_date", (q) => q.eq("userId", booking.userId).eq("date", booking.date))
      .filter((q) => q.eq(q.field("status"), "CONFIRMED"))
      .collect();
    if (
      ownDay.some(
        (b) => b._id !== bookingDbId && b.startSeconds < newEnd && newStartSeconds < b.endSeconds,
      )
    ) {
      throw new ConvexError("The student already has an overlapping booking");
    }

    await ctx.db.patch(bookingDbId, {
      startSeconds: newStartSeconds,
      endSeconds: newEnd,
      updatedAt: now,
    });

    await ctx.db.insert("bookingEvents", {
      bookingDbId,
      eventType: "RESCHEDULED",
      detail: `Moved by admin from ${secondsTo12h(booking.startSeconds)} to ${secondsTo12h(newStartSeconds)} on ${booking.date}`,
      at: now,
    });

    await ctx.db.insert("notifications", {
      userId: booking.userId,
      bookingDbId,
      type: "RESCHEDULED",
      title: "Your booking was rescheduled",
      message: `Machine ${machine.machineNumber} on ${booking.date} moved to ${secondsTo12h(newStartSeconds)} – ${secondsTo12h(newEnd)}. Contact the PG office if this doesn't work for you.`,
      createdAt: now,
    });

    await audit(ctx, admin._id, "BOOKING_RESCHEDULED", "booking", booking.bookingId, `to ${secondsTo12h(newStartSeconds)}`);
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Weather reports (admin view)                                        */
/* ------------------------------------------------------------------ */

/** Stored weather reports for completed laundry events. */
export const weatherReports = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("weatherReports").order("desc").take(50);
    const out = [];
    for (const w of rows) {
      const booking = await ctx.db.get(w.bookingDbId);
      const user = booking ? await ctx.db.get(booking.userId) : null;
      const machine = booking ? await ctx.db.get(booking.machineId) : null;
      out.push({
        _id: w._id,
        bookingId: booking?.bookingId ?? null,
        studentName: user?.name ?? null,
        machineNumber: machine?.machineNumber ?? null,
        date: booking?.date ?? null,
        rainProbability: w.rainProbability,
        summary: w.summary,
        guidance: w.guidance,
        provider: w.provider,
        fetchedAt: w.fetchedAt,
      });
    }
    return out;
  },
});

/* ------------------------------------------------------------------ */
/* Student detail                                                      */
/* ------------------------------------------------------------------ */

/** Full profile + booking + notification history for one student. */
export const studentDetail = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("Student not found");
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const week = weekDates(currentIstDate(Date.now()));
    const bookingsOut = [];
    for (const b of bookings.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50)) {
      const machine = await ctx.db.get(b.machineId);
      bookingsOut.push({
        _id: b._id,
        bookingId: b.bookingId,
        machineNumber: machine?.machineNumber ?? 0,
        date: b.date,
        label12h: `${secondsTo12h(b.startSeconds)} – ${secondsTo12h(b.endSeconds)}`,
        status: b.status,
        cancellationReason: b.cancellationReason ?? null,
      });
    }
    const notifs = (
      await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(20)
    ).map((n) => ({
      _id: n._id,
      type: n.type,
      title: n.title,
      createdAt: n.createdAt,
      readAt: n.readAt ?? null,
    }));
    return {
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      pgName: user.pgName ?? "",
      roomNumber: user.roomNumber ?? "",
      role: user.role ?? "student",
      disabled: !!user.disabled,
      joinedAt: user._creationTime,
      weeklyUsage: bookings.filter(
        (b) => b.status === "CONFIRMED" && week.includes(b.date),
      ).length,
      totalBookings: bookings.length,
      bookings: bookingsOut,
      notifications: notifs,
    };
  },
});
