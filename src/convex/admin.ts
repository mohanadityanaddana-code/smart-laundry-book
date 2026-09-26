// HVR PG Laundry — admin backend: machine management, schedule settings,
// student management and dashboard stats. Every function is admin-guarded.

import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  currentIstDate,
  currentIstSecondsOfDay,
  deriveMachineStatus,
  hhmmToSeconds,
  secondsToHHMM,
  weekDates,
} from "./time";
import { requireAdmin, confirmedForMachineDate, requireSettings } from "./bookings";
import { audit } from "./adminPortal";

/* ------------------------------------------------------------------ */
/* Machines                                                            */
/* ------------------------------------------------------------------ */

export const addMachine = mutation({
  args: {
    machineNumber: v.number(),
    name: v.string(),
    capacityKg: v.number(),
    location: v.string(),
    durationMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const userId = me._id;
    if (args.durationMinutes < 15 || args.durationMinutes > 240) {
      throw new ConvexError("Duration must be between 15 and 240 minutes");
    }
    if (args.machineNumber < 1) {
      throw new ConvexError("Machine number must be positive");
    }
    const existing = await ctx.db
      .query("machines")
      .withIndex("by_machineNumber", (q) => q.eq("machineNumber", args.machineNumber))
      .first();
    if (existing) {
      throw new ConvexError(`Machine ${args.machineNumber} already exists`);
    }
    const now = Date.now();
    const newMachineId = await ctx.db.insert("machines", {
      machineNumber: args.machineNumber,
      name: args.name.trim() || `Machine ${args.machineNumber}`,
      capacityKg: args.capacityKg,
      location: args.location.trim(),
      status: "AVAILABLE",
      defaultDurationSeconds: args.durationMinutes * 60,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, userId, "MACHINE_ADDED", "machine", String(args.machineNumber), args.name);
    return { ok: true };
  },
});

export const updateMachine = mutation({
  args: {
    machineId: v.id("machines"),
    name: v.optional(v.string()),
    capacityKg: v.optional(v.number()),
    location: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("AVAILABLE"),
        v.literal("MAINTENANCE"),
        v.literal("OFFLINE"),
        v.literal("DISABLED"),
      ),
    ),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const userId = me._id;
    const machine = await ctx.db.get(args.machineId);
    if (!machine) throw new ConvexError("Machine not found");
    if (args.durationMinutes !== undefined) {
      if (args.durationMinutes < 15 || args.durationMinutes > 240) {
        throw new ConvexError("Duration must be between 15 and 240 minutes");
      }
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.capacityKg !== undefined) patch.capacityKg = args.capacityKg;
    if (args.location !== undefined) patch.location = args.location.trim();
    if (args.durationMinutes !== undefined) {
      patch.defaultDurationSeconds = args.durationMinutes * 60;
    }
    if (args.status !== undefined) patch.status = args.status;
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch(args.machineId, patch);
    await audit(
      ctx,
      userId,
      args.status !== undefined ? "MACHINE_STATUS_CHANGED" : "MACHINE_EDITED",
      "machine",
      String(machine.machineNumber),
      JSON.stringify({ ...args, machineId: undefined }),
    );

    // Notify students with future bookings on a machine that just went into
    // maintenance or was disabled.
    if (
      (args.status === "MAINTENANCE" || args.status === "DISABLED" || args.active === false) &&
      machine.status !== args.status
    ) {
      const today = currentIstDate(Date.now());
      const future = await ctx.db
        .query("bookings")
        .withIndex("by_machine_date", (q) =>
          q.eq("machineId", args.machineId).eq("date", today),
        )
        .filter((q) => q.eq(q.field("status"), "CONFIRMED"))
        .collect();
      const nowSec = currentIstSecondsOfDay(Date.now());
      for (const b of future) {
        if (b.endSeconds > nowSec) {
          await ctx.db.insert("notifications", {
            userId: b.userId,
            bookingDbId: b._id,
            type: "MACHINE_MAINTENANCE",
            title: `Machine ${machine.machineNumber} needs attention`,
            message:
              "This machine was taken out of service. The PG owner will help you rebook on another machine — your weekly allowance is freed if you cancel.",
            createdAt: Date.now(),
          });
        }
      }
    }

    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireSettings(ctx);
    return {
      openTime: secondsToHHMM(s.openSeconds),
      closeTime: secondsToHHMM(s.closeSeconds),
      defaultDurationMinutes: Math.round(s.defaultDurationSeconds / 60),
      weeklyLimit: s.weeklyLimit,
      supportName: s.supportName,
      supportPhone: s.supportPhone,
      emergencyPhone: s.emergencyPhone,
      latitude: s.latitude ?? null,
      longitude: s.longitude ?? null,
      reminderTimeoutMinutes: s.reminderTimeoutMinutes ?? 10,
      finalResponseMinutes: s.finalResponseMinutes ?? 5,
    };
  },
});

export const updateSettings = mutation({
  args: {
    openTime: v.optional(v.string()), // "HH:MM"
    closeTime: v.optional(v.string()),
    defaultDurationMinutes: v.optional(v.number()),
    weeklyLimit: v.optional(v.number()),
    supportName: v.optional(v.string()),
    supportPhone: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    reminderTimeoutMinutes: v.optional(v.number()),
    finalResponseMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const userId = me._id;
    const s = await requireSettings(ctx);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };

    let open = s.openSeconds;
    let close = s.closeSeconds;
    if (args.openTime !== undefined) open = hhmmToSeconds(args.openTime);
    if (args.closeTime !== undefined) close = hhmmToSeconds(args.closeTime);
    if (open >= close) {
      throw new ConvexError("Opening time must be before closing time");
    }
    patch.openSeconds = open;
    patch.closeSeconds = close;

    if (args.defaultDurationMinutes !== undefined) {
      if (args.defaultDurationMinutes < 15 || args.defaultDurationMinutes > 240) {
        throw new ConvexError("Default duration must be 15–240 minutes");
      }
      patch.defaultDurationSeconds = args.defaultDurationMinutes * 60;
    }
    if (args.weeklyLimit !== undefined) {
      if (args.weeklyLimit < 1 || args.weeklyLimit > 21) {
        throw new ConvexError("Weekly limit must be between 1 and 21");
      }
      patch.weeklyLimit = args.weeklyLimit;
    }
    if (args.supportName !== undefined) patch.supportName = args.supportName.trim();
    if (args.supportPhone !== undefined) patch.supportPhone = args.supportPhone.trim();
    if (args.emergencyPhone !== undefined) patch.emergencyPhone = args.emergencyPhone.trim();
    if (args.latitude !== undefined) patch.latitude = args.latitude;
    if (args.longitude !== undefined) patch.longitude = args.longitude;
    if (args.reminderTimeoutMinutes !== undefined) {
      if (args.reminderTimeoutMinutes < 1 || args.reminderTimeoutMinutes > 120) {
        throw new ConvexError("Reminder timeout must be 1–120 minutes");
      }
      patch.reminderTimeoutMinutes = args.reminderTimeoutMinutes;
    }
    if (args.finalResponseMinutes !== undefined) {
      if (args.finalResponseMinutes < 1 || args.finalResponseMinutes > 60) {
        throw new ConvexError("Final response window must be 1–60 minutes");
      }
      patch.finalResponseMinutes = args.finalResponseMinutes;
    }

    await ctx.db.patch(s._id, patch);
    await audit(ctx, userId, "SETTINGS_CHANGED", "settings", null, JSON.stringify(args));
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Students                                                            */
/* ------------------------------------------------------------------ */

export const students = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const today = currentIstDate(Date.now());
    const week = weekDates(today);
    const out = [];
    for (const u of users) {
      if (u.isAnonymous) continue;
      let thisWeek = 0;
      let total = 0;
      for (const date of week) {
        const rows = await ctx.db
          .query("bookings")
          .withIndex("by_user_date", (q) => q.eq("userId", u._id).eq("date", date))
          .filter((q) => q.eq(q.field("status"), "CONFIRMED"))
          .collect();
        thisWeek += rows.length;
      }
      const all = await ctx.db
        .query("bookings")
        .withIndex("by_user", (q) => q.eq("userId", u._id))
        .collect();
      total = all.length;
      out.push({
        _id: u._id,
        name: u.name ?? "Unnamed",
        email: u.email ?? "",
        phone: u.phone ?? "",
        pgName: u.pgName ?? "",
        roomNumber: u.roomNumber ?? "",
        role: u.role ?? "student",
        disabled: !!u.disabled,
        emailVerified: !!u.emailVerificationTime,
        profileComplete: !!u.profileComplete,
        bookingsThisWeek: thisWeek,
        totalBookings: total,
        joinedAt: u._creationTime,
      });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  },
});

export const setStudentActive = mutation({
  args: { userId: v.id("users"), active: v.boolean() },
  handler: async (ctx, { userId, active }) => {
    const admin = await requireAdmin(ctx);
    if (userId === admin._id) {
      throw new ConvexError("You cannot change your own account");
    }
    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("Student not found");
    await ctx.db.patch(userId, { disabled: !active });
    await audit(ctx, admin._id, active ? "STUDENT_ENABLED" : "STUDENT_DISABLED", "user", target.email ?? userId, target.name ?? "");
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Dashboard stats                                                     */
/* ------------------------------------------------------------------ */

export const dashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const today = currentIstDate(now);
    const nowSec = currentIstSecondsOfDay(now);
    const week = weekDates(today);

    const machines = (await ctx.db.query("machines").collect()).sort(
      (a, b) => a.machineNumber - b.machineNumber,
    );
    const users = await ctx.db.query("users").collect();
    const students = users.filter((u) => !u.isAnonymous);

    const todayBookings = await ctx.db
      .query("bookings")
      .withIndex("by_date", (q) => q.eq("date", today))
      .filter((q) => q.eq(q.field("status"), "CONFIRMED"))
      .collect();

    const allBookings = await ctx.db.query("bookings").collect();
    const cancelled = allBookings.filter((b) => b.status === "CANCELLED").length;
    const weekConfirmed = allBookings.filter(
      (b) => b.status === "CONFIRMED" && week.includes(b.date),
    ).length;

    // Utilization: booked slot-seconds today / (open machines × open hours).
    const settings = await requireSettings(ctx);
    const openSpan = Math.max(1, settings.closeSeconds - settings.openSeconds);
    const bookableMachines = machines.filter(
      (m) => m.active && m.status !== "DISABLED",
    );
    let bookedSeconds = 0;
    for (const b of todayBookings) {
      bookedSeconds += b.endSeconds - b.startSeconds;
    }
    const capacitySeconds = bookableMachines.length * openSpan;
    const utilization =
      capacitySeconds > 0 ? Math.round((bookedSeconds / capacitySeconds) * 100) : 0;

    let running = 0;
    let available = 0;
    const machineCards = machines.map((m) => {
      const active = todayBookings
        .filter((b) => b.machineId === m._id)
        .map((b) => ({ startSeconds: b.startSeconds, endSeconds: b.endSeconds }));
      const live = deriveMachineStatus(m.status, active, now);
      if (live === "RUNNING") running += 1;
      if (live === "AVAILABLE") available += 1;
      const runningB = todayBookings.find(
        (b) =>
          b.machineId === m._id &&
          b.startSeconds <= nowSec &&
          nowSec < b.endSeconds,
      );
      return {
        _id: m._id,
        machineNumber: m.machineNumber,
        name: m.name,
        capacityKg: m.capacityKg,
        location: m.location,
        status: m.status,
        liveStatus: live,
        durationMinutes: Math.round(m.defaultDurationSeconds / 60),
        active: m.active,
        runningRemainingSeconds:
          live === "RUNNING" && runningB ? runningB.endSeconds - nowSec : null,
      };
    });

    return {
      totals: {
        students: students.length,
        machines: machines.length,
        availableMachines: available,
        runningMachines: running,
        todayBookings: todayBookings.length,
        weekBookings: weekConfirmed,
        completedBookings: allBookings.filter(
          (b) =>
            b.status === "CONFIRMED" &&
            (b.date < today || (b.date === today && b.endSeconds <= nowSec)),
        ).length,
        cancelledBookings: cancelled,
      },
      utilization,
      machines: machineCards,
    };
  },
});

/** Admin: live machine list for the machines page (reuses availability logic). */
export const adminMachines = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const today = currentIstDate(now);
    const nowSec = currentIstSecondsOfDay(now);
    const machines = (await ctx.db.query("machines").collect()).sort(
      (a, b) => a.machineNumber - b.machineNumber,
    );
    const settings = await requireSettings(ctx);
    const out = [];
    for (const m of machines) {
      const bookings = await confirmedForMachineDate(ctx, m._id, today);
      const active = bookings.map((b) => ({
        startSeconds: b.startSeconds,
        endSeconds: b.endSeconds,
      }));
      const live = deriveMachineStatus(m.status, active, now);
      const runningB = bookings.find(
        (b) => b.startSeconds <= nowSec && nowSec < b.endSeconds,
      );
      const gridCount = Math.floor(
        (settings.closeSeconds - settings.openSeconds) / m.defaultDurationSeconds,
      );
      const bookedToday = bookings.length;
      out.push({
        _id: m._id,
        machineNumber: m.machineNumber,
        name: m.name,
        capacityKg: m.capacityKg,
        location: m.location,
        status: m.status,
        active: m.active,
        liveStatus: live,
        durationMinutes: Math.round(m.defaultDurationSeconds / 60),
        runningRemainingSeconds:
          live === "RUNNING" && runningB ? runningB.endSeconds - nowSec : null,
        bookedToday,
        slotsToday: Math.max(gridCount, 0),
      });
    }
    return out;
  },
});
