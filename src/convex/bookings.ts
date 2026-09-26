// HVR PG Laundry — deterministic booking engine (v1).
//
// This module is the single source of truth for laundry booking. Every rule
// (current-week dates, past-time blocking, machine status, weekly limits,
// overlap prevention) is enforced server-side here; the UI only mirrors it.
// Convex mutations are serialized transactions, so two students racing for
// the same slot can never both succeed.

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;
import {
  addDays,
  currentIstDate,
  currentIstSecondsOfDay,
  deriveMachineStatus,
  generateSlotGrid,
  secondsTo12h,
  secondsToHHMM,
  weekDates,
} from "./time";
import { ROLES } from "./schema";

const DAY_MS = 86_400_000;

/** Every settings row; exactly one is created by seeding. */
export async function requireSettings(ctx: Ctx): Promise<Doc<"settings">> {
  const settings = await ctx.db.query("settings").first();
  if (!settings) throw new ConvexError("Settings not initialised");
  return settings;
}

async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not signed in");
  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("Account not found");
  return user;
}

/** Admin guard for every admin mutation/query. */
export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== ROLES.ADMIN) {
    throw new ConvexError("Admin access required");
  }
  return user;
}

/* ------------------------------------------------------------------ */
/* Shared read helpers                                                  */
/* ------------------------------------------------------------------ */

/** All machines (including disabled) in machine-number order. */
async function allMachines(ctx: Ctx) {
  const machines = await ctx.db.query("machines").collect();
  return machines.sort((a, b) => a.machineNumber - b.machineNumber);
}

/** Confirmed bookings for a machine on a date. */
export async function confirmedForMachineDate(
  ctx: Ctx,
  machineId: Id<"machines">,
  date: string,
): Promise<Doc<"bookings">[]> {
  return await ctx.db
    .query("bookings")
    .withIndex("by_machine_date", (q: any) =>
      q.eq("machineId", machineId).eq("date", date),
    )
    .filter((q: any) => q.eq(q.field("status"), "CONFIRMED"))
    .collect();
}

/** Confirmed bookings for a date across all machines, with user info joined. */
async function dayBookingsWithUsers(ctx: any, date: string) {
  const bookings = await ctx.db
    .query("bookings")
    .withIndex("by_date", (q: any) => q.eq("date", date))
    .filter((q: any) => q.eq(q.field("status"), "CONFIRMED"))
    .collect();
  const out: Array<
    Omit<Doc<"bookings">, "userId"> & {
      userName: string;
      userRoom: string | undefined;
    }
  > = [];
  for (const b of bookings) {
    const u = await ctx.db.get(b.userId);
    out.push({
      ...b,
      userId: b.userId,
      userName: u?.name ?? "Student",
      userRoom: u?.roomNumber,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** The week (Mon→Sun) the whole app should display right now, in IST. */
export const currentWeek = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const today = currentIstDate(now);
    return {
      today,
      dates: weekDates(today).map((date) => ({
        date,
        isToday: date === today,
        isPast: date < today,
      })),
      nowSeconds: currentIstSecondsOfDay(now),
      serverNowMs: now,
    };
  },
});

/**
 * Availability for one machine on one date: the deterministic slot grid with
 * per-slot status. Statuses: AVAILABLE, BOOKED (by you or someone else),
 * MAINTENANCE, PASSED.
 */
export const machineAvailability = query({
  args: { machineId: v.id("machines"), date: v.string() },
  handler: async (ctx, { machineId, date }) => {
    const now = Date.now();
    const settings = await requireSettings(ctx);
    const machine = await ctx.db.get(machineId);
    if (!machine) throw new ConvexError("Machine not found");

    const today = currentIstDate(now);
    const nowSec = currentIstSecondsOfDay(now);
    const grid = generateSlotGrid(
      settings.openSeconds,
      settings.closeSeconds,
      machine.defaultDurationSeconds,
    );

    const bookings = await confirmedForMachineDate(ctx, machineId, date);
    const myUserId = (await getAuthUserId(ctx)) ?? null;

    const slots = await Promise.all(
      grid.map(async (slot) => {
        const booking = bookings.find(
          (b) => b.startSeconds === slot.start && b.endSeconds === slot.end,
        );
        let status: "AVAILABLE" | "BOOKED" | "MAINTENANCE" | "PASSED" = "AVAILABLE";
        if (machine.status === "MAINTENANCE") {
          status = "MAINTENANCE";
        } else if (booking) {
          status = "BOOKED";
        } else if (date < today || (date === today && slot.end <= nowSec)) {
          status = "PASSED";
        }
        const bookedBy = booking
          ? ((await ctx.db.get(booking.userId))?.name ?? "Student")
          : null;
        return {
          start: slot.start,
          end: slot.end,
          label: `${secondsToHHMM(slot.start)}–${secondsToHHMM(slot.end)}`,
          label12h: `${secondsTo12h(slot.start)} – ${secondsTo12h(slot.end)}`,
          status,
          bookingId: booking?.bookingId ?? null,
          isMine: !!booking && myUserId !== null && booking.userId === myUserId,
          bookedBy,
        };
      }),
    );

    const storedActive = bookings
      .filter((b) => b.date === today)
      .map((b) => ({ startSeconds: b.startSeconds, endSeconds: b.endSeconds }));
    const liveStatus = deriveMachineStatus(machine.status, storedActive, now);

    // Live countdown for a running booking (today only).
    const running = bookings.find(
      (b) =>
        b.date === today &&
        b.startSeconds <= nowSec &&
        nowSec < b.endSeconds,
    );
    const next = bookings
      .filter((b) => b.date === today && b.startSeconds > nowSec)
      .sort((a, b) => a.startSeconds - b.startSeconds)[0];

    return {
      machine: {
        _id: machine._id,
        machineNumber: machine.machineNumber,
        name: machine.name,
        capacityKg: machine.capacityKg,
        location: machine.location,
        defaultDurationSeconds: machine.defaultDurationSeconds,
        storedStatus: machine.status,
        liveStatus,
      },
      date,
      isPastDate: date < today,
      slots,
      runningBooking: running
        ? {
            bookingId: running.bookingId,
            userName: (await ctx.db.get(running.userId))?.name ?? "Student",
            endSeconds: running.endSeconds,
            remainingSeconds: running.endSeconds - nowSec,
          }
        : null,
      nextBooking: next
        ? {
            bookingId: next.bookingId,
            userName: (await ctx.db.get(next.userId))?.name ?? "Student",
            startSeconds: next.startSeconds,
          }
        : null,
    };
  },
});

/**
 * Weekly allowance for the signed-in student: confirmed bookings in the
 * current week (Mon–Sun) against the configured limit.
 */
export const weeklyUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { used: 0, limit: 4, remaining: 4 };
    const settings = await requireSettings(ctx);
    const dates = weekDates(currentIstDate(Date.now()));
    let used = 0;
    for (const date of dates) {
      const rows = await ctx.db
        .query("bookings")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).eq("date", date),
        )
        .filter((q) => q.eq(q.field("status"), "CONFIRMED"))
        .collect();
      used += rows.length;
    }
    return {
      used,
      limit: settings.weeklyLimit,
      remaining: Math.max(0, settings.weeklyLimit - used),
    };
  },
});

/** All bookings for the signed-in student, newest first. */
export const myBookings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const now = Date.now();
    const today = currentIstDate(now);
    const nowSec = currentIstSecondsOfDay(now);

    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    rows.sort((a, b) => (a.date + String(a.startSeconds).padStart(6, "0")).localeCompare(b.date + String(b.startSeconds).padStart(6, "0")));

    const out = [];
    for (const b of rows) {
      const machine = await ctx.db.get(b.machineId);
      const derived =
        b.status === "CONFIRMED"
          ? b.date < today || (b.date === today && b.endSeconds <= nowSec)
            ? "COMPLETED"
            : b.date === today &&
                b.startSeconds <= nowSec &&
                nowSec < b.endSeconds
              ? "ACTIVE"
              : "UPCOMING"
          : "CANCELLED";
      out.push({
        _id: b._id,
        bookingId: b.bookingId,
        machineNumber: machine?.machineNumber ?? 0,
        machineName: machine?.name ?? "Machine",
        date: b.date,
        startSeconds: b.startSeconds,
        endSeconds: b.endSeconds,
        durationSeconds: b.durationSeconds,
        status: b.status,
        derived,
        cancellationReason: b.cancellationReason ?? null,
        label12h: `${secondsTo12h(b.startSeconds)} – ${secondsTo12h(b.endSeconds)}`,
        remainingSeconds:
          b.status === "CONFIRMED" && b.date === today && b.startSeconds <= nowSec && nowSec < b.endSeconds
            ? b.endSeconds - nowSec
            : null,
      });
    }
    return out.reverse();
  },
});

/**
 * Everything the student home screen needs in one reactive query.
 */
export const studentHome = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const now = Date.now();
    const today = currentIstDate(now);
    const nowSec = currentIstSecondsOfDay(now);

    const mine = await ctx.db
      .query("bookings")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .filter((q) => q.eq(q.field("status"), "CONFIRMED"))
      .collect();

    const active =
      mine.find((b) => b.startSeconds <= nowSec && nowSec < b.endSeconds) ??
      null;
    const upcoming = mine
      .filter((b) => b.startSeconds > nowSec)
      .sort((a, b) => a.startSeconds - b.startSeconds)[0] ?? null;

    const activeMachine = active ? await ctx.db.get(active.machineId) : null;
    const upcomingMachine = upcoming
      ? await ctx.db.get(upcoming.machineId)
      : null;

    const settings = await requireSettings(ctx);
    const dates = weekDates(today);
    let used = 0;
    for (const date of dates) {
      const rows = await ctx.db
        .query("bookings")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).eq("date", date),
        )
        .filter((q) => q.eq(q.field("status"), "CONFIRMED"))
        .collect();
      used += rows.length;
    }

    return {
      today,
      nowMs: now,
      nowSeconds: nowSec,
      activeBooking: active
        ? {
            _id: active._id,
            bookingId: active.bookingId,
            machineNumber: activeMachine?.machineNumber ?? 0,
            endSeconds: active.endSeconds,
            remainingSeconds: Math.max(0, active.endSeconds - nowSec),
          }
        : null,
      upcomingBooking: upcoming
        ? {
            _id: upcoming._id,
            bookingId: upcoming.bookingId,
            machineNumber: upcomingMachine?.machineNumber ?? 0,
            startSeconds: upcoming.startSeconds,
            endSeconds: upcoming.endSeconds,
          }
        : null,
      weekly: {
        used,
        limit: settings.weeklyLimit,
        remaining: Math.max(0, settings.weeklyLimit - used),
      },
      support: {
        name: settings.supportName,
        phone: settings.supportPhone,
      },
    };
  },
});

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

function humanConflict(start: number, end: number) {
  return `Sorry, this slot was just booked. ${secondsTo12h(start)} – ${secondsTo12h(end)} is no longer available.`;
}

/**
 * Confirm a booking. Runs inside a single serialized transaction:
 * re-validates date, time, machine status, weekly limit and overlap before
 * writing. Two simultaneous requests for one slot cannot both pass.
 */
export const confirmBooking = mutation({
  args: {
    machineId: v.id("machines"),
    date: v.string(),
    startSeconds: v.number(),
  },
  handler: async (ctx, { machineId, date, startSeconds }) => {
    const user = await requireUser(ctx);
    if (user.isAnonymous) {
      throw new ConvexError("Please sign in with your student account to book");
    }
    const now = Date.now();
    const settings = await requireSettings(ctx);
    const machine = await ctx.db.get(machineId);
    if (!machine) throw new ConvexError("Machine not found");

    // 1. Date must be within the current week (Mon–Sun) and not in the past.
    const today = currentIstDate(now);
    const week = weekDates(today);
    if (!week.includes(date)) {
      throw new ConvexError("You can only book within the current week");
    }
    if (date < today) {
      throw new ConvexError("That date has already passed");
    }

    // 2. Machine must be enabled and bookable.
    if (!machine.active || machine.status === "DISABLED") {
      throw new ConvexError("This machine is currently unavailable");
    }
    if (machine.status === "MAINTENANCE" || machine.status === "OFFLINE") {
      throw new ConvexError("This machine is under maintenance");
    }

    // 3. Slot must be a valid grid slot for this machine.
    const duration = machine.defaultDurationSeconds;
    const endSeconds = startSeconds + duration;
    const grid = generateSlotGrid(
      settings.openSeconds,
      settings.closeSeconds,
      duration,
    );
    const slot = grid.find((s) => s.start === startSeconds);
    if (!slot || slot.end !== endSeconds) {
      throw new ConvexError("That slot does not exist for this machine");
    }

    // 4. Past-time blocking (backend authority).
    if (date === today && endSeconds <= currentIstSecondsOfDay(now)) {
      throw new ConvexError("That time slot has already passed");
    }

    // 5. Weekly limit — cancelled bookings never count.
    const usedThisWeek = await (async () => {
      let used = 0;
      for (const d of week) {
        const rows = await ctx.db
          .query("bookings")
          .withIndex("by_user_date", (q) => q.eq("userId", user._id).eq("date", d))
          .filter((q) => q.eq(q.field("status"), "CONFIRMED"))
          .collect();
        used += rows.length;
      }
      return used;
    })();
    if (usedThisWeek >= settings.weeklyLimit) {
      throw new ConvexError(
        `You have reached your weekly booking limit (${settings.weeklyLimit} per week)`,
      );
    }

    // 6. Overlap prevention — against every confirmed booking that day, on
    //    any machine, so a student cannot hold two machines at once.
    const sameDay = await ctx.db
      .query("bookings")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id).eq("date", date))
      .filter((q) => q.eq(q.field("status"), "CONFIRMED"))
      .collect();
    if (sameDay.some((b) => b.startSeconds < endSeconds && startSeconds < b.endSeconds)) {
      throw new ConvexError("You already have a booking that overlaps this slot");
    }

    // 7. Slot collision check (any user). The transaction serialization makes
    //    the read-then-write below race-free.
    const existing = await confirmedForMachineDate(ctx, machineId, date);
    const clash = existing.find(
      (b) => b.startSeconds === startSeconds && b.endSeconds === endSeconds,
    );
    if (clash) throw new ConvexError(humanConflict(startSeconds, endSeconds));
    if (existing.some((b) => b.startSeconds < endSeconds && startSeconds < b.endSeconds)) {
      throw new ConvexError("That slot overlaps another booking");
    }

    // 8. Booking ID: HVR-YYYYMMDD-NNNN via a monotonic counter row.
    const counterKey = `bookingId:${date}`;
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_key", (q) => q.eq("key", counterKey))
      .first();
    const nextValue = (counter?.value ?? 0) + 1;
    if (counter) {
      await ctx.db.patch(counter._id, { value: nextValue });
    } else {
      await ctx.db.insert("counters", { key: counterKey, value: nextValue });
    }
    const bookingId = `HVR-${date.replace(/-/g, "")}-${String(nextValue).padStart(4, "0")}`;

    const ts = now;
    const id = await ctx.db.insert("bookings", {
      bookingId,
      userId: user._id,
      machineId,
      date,
      startSeconds,
      endSeconds,
      durationSeconds: duration,
      status: "CONFIRMED",
      createdAt: ts,
      updatedAt: ts,
    });

    // In-app confirmation notification (same transaction).
    await ctx.db.insert("notifications", {
      userId: user._id,
      bookingDbId: id,
      type: "BOOKING_CONFIRMED",
      title: "Booking confirmed",
      message: `${bookingId} — Machine ${machine.machineNumber} on ${date} at ${secondsTo12h(startSeconds)}.`,
      createdAt: ts,
    });

    return { bookingDbId: id, bookingId, date, startSeconds, endSeconds };
  },
});

/**
 * "Finish & Notify Next" — the student marks their laundry done, and the next
 * booking on this machine is notified that the machine is ready, with an
 * action prompt they can answer from the notification center.
 */
export const finishBooking = mutation({
  args: { bookingDbId: v.id("bookings") },
  handler: async (ctx, { bookingDbId }) => {
    const user = await requireUser(ctx);
    const booking = await ctx.db.get(bookingDbId);
    if (!booking) throw new ConvexError("Booking not found");
    if (booking.userId !== user._id && user.role !== ROLES.ADMIN) {
      throw new ConvexError("You can only finish your own laundry");
    }
    if (booking.status !== "CONFIRMED") {
      throw new ConvexError("This booking is no longer active");
    }
    const now = Date.now();
    const today = currentIstDate(now);
    const nowSec = currentIstSecondsOfDay(now);
    if (booking.date !== today) {
      throw new ConvexError("Laundry can only be finished on the booked day");
    }
    if (booking.startSeconds > nowSec) {
      throw new ConvexError("Your slot hasn't started yet");
    }

    await ctx.db.patch(bookingDbId, {
      completedAt: now,
      updatedAt: now,
    });

    const machine = await ctx.db.get(booking.machineId);

    // Find the next confirmed booking on this machine today.
    const upcoming = await ctx.db
      .query("bookings")
      .withIndex("by_machine_date", (q) =>
        q.eq("machineId", booking.machineId).eq("date", today),
      )
      .filter((q) => q.eq(q.field("status"), "CONFIRMED"))
      .collect();
    const next = upcoming
      .filter((b) => b._id !== bookingDbId && b.startSeconds >= nowSec)
      .sort((a, b) => a.startSeconds - b.startSeconds)[0];

    let nextStudentName: string | null = null;
    if (next) {
      const nextUser = await ctx.db.get(next.userId);
      nextStudentName = nextUser?.name ?? "Student";
      await ctx.db.insert("notifications", {
        userId: next.userId,
        bookingDbId: next._id,
        type: "MACHINE_READY",
        title: `Machine ${machine?.machineNumber ?? ""} is ready`,
        message: `The previous laundry cycle has finished. Your slot ${secondsTo12h(next.startSeconds)} – ${secondsTo12h(next.endSeconds)} is ready now. Please head to the laundry area.`,
        actionState: "PENDING",
        createdAt: now,
      });
      // Start the escalation clock for the next student.
      await ctx.db.patch(next._id, {
        escalationState: "NOTIFIED",
        firstNotifiedAt: now,
        updatedAt: now,
      });
    }

    // Event history for admin + booking timeline.
    await ctx.db.insert("bookingEvents", {
      bookingDbId,
      eventType: "LAUNDRY_FINISHED",
      detail: next
        ? `Laundry finished — next student ${nextStudentName} notified`
        : "Laundry finished — no next booking on this machine",
      at: now,
    });

    return {
      ok: true as const,
      machineNumber: machine?.machineNumber ?? 0,
      nextStudentName,
      nextStartSeconds: next?.startSeconds ?? null,
    };
  },
});

/** Server-side owner resolution for the finish action (never trust the client). */
export const bookingOwner = internalQuery({
  args: { bookingDbId: v.id("bookings") },
  handler: async (ctx, { bookingDbId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const booking = await ctx.db.get(bookingDbId);
    if (!booking) return null;
    // Only the owner or an admin may see who owns it.
    const requester = await ctx.db.get(userId);
    if (!requester) return null;
    if (booking.userId !== userId && requester.role !== ROLES.ADMIN) return null;
    return booking.userId;
  },
});

/** Student-initiated cancellation. Frees the weekly allowance immediately. */
export const cancelMyBooking = mutation({
  args: { bookingDbId: v.id("bookings") },
  handler: async (ctx, { bookingDbId }) => {
    const user = await requireUser(ctx);
    const booking = await ctx.db.get(bookingDbId);
    if (!booking) throw new ConvexError("Booking not found");
    if (booking.userId !== user._id && user.role !== ROLES.ADMIN) {
      throw new ConvexError("You can only cancel your own bookings");
    }
    if (booking.status !== "CONFIRMED") {
      throw new ConvexError("This booking is already cancelled");
    }
    const now = Date.now();
    const isAdmin = user.role === ROLES.ADMIN;
    await ctx.db.patch(bookingDbId, {
      status: "CANCELLED",
      cancelledAt: now,
      cancellationReason: isAdmin ? "ADMIN_CANCELLED" : "STUDENT_CANCELLED",
      updatedAt: now,
    });
    await ctx.db.insert("bookingEvents", {
      bookingDbId,
      eventType: isAdmin ? "ADMIN_CANCELLED" : "STUDENT_CANCELLED",
      detail: isAdmin
        ? `Cancelled by admin ${user.name ?? ""}`
        : "Cancelled by the student",
      at: now,
    });
    // Notify the affected student when an admin cancels on their behalf.
    if (isAdmin && booking.userId !== user._id) {
      await ctx.db.insert("notifications", {
        userId: booking.userId,
        bookingDbId,
        type: "SLOT_CANCELLED",
        title: "Booking cancelled by PG admin",
        message: `Your ${booking.date} slot ${secondsTo12h(booking.startSeconds)} – ${secondsTo12h(booking.endSeconds)} was cancelled by the PG admin. Please contact support if this looks wrong.`,
        createdAt: now,
      });
    }
    return { ok: true };
  },
});

/** One machine with availability summary for the booking step-2 grid. */
export const machineWithDayLoad = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const now = Date.now();
    const settings = await requireSettings(ctx);
    const today = currentIstDate(now);
    const machines = await allMachines(ctx);
    const out = [];
    for (const machine of machines) {
      const grid = generateSlotGrid(
        settings.openSeconds,
        settings.closeSeconds,
        machine.defaultDurationSeconds,
      );
      const bookings = await confirmedForMachineDate(ctx, machine._id, date);
      const nowSec = currentIstSecondsOfDay(now);
      const selectable = grid.filter((s) => {
        if (machine.status === "MAINTENANCE") return false;
        if (!machine.active || machine.status === "DISABLED") return false;
        if (date < today) return false;
        if (date === today && s.end <= nowSec) return false;
        if (bookings.some((b) => b.startSeconds === s.start && b.endSeconds === s.end)) return false;
        return true;
      }).length;
      const storedActive = bookings
        .filter((b) => b.date === today)
        .map((b) => ({ startSeconds: b.startSeconds, endSeconds: b.endSeconds }));
      out.push({
        _id: machine._id,
        machineNumber: machine.machineNumber,
        name: machine.name,
        capacityKg: machine.capacityKg,
        location: machine.location,
        defaultDurationSeconds: machine.defaultDurationSeconds,
        liveStatus: deriveMachineStatus(machine.status, storedActive, now),
        totalSlots: grid.length,
        openSlots: selectable,
      });
    }
    return out;
  },
});

/**
 * Public-safe machine snapshot for the QR landing page (scanned from the
 * sticker on the machine). No personal data is returned — only the machine's
 * live status and how many slots remain today.
 */
export const publicMachine = query({
  args: { machineId: v.id("machines") },
  handler: async (ctx, { machineId }) => {
    const now = Date.now();
    const settings = await requireSettings(ctx);
    const machine = await ctx.db.get(machineId);
    if (!machine) return null;
    const today = currentIstDate(now);
    const nowSec = currentIstSecondsOfDay(now);
    const grid = generateSlotGrid(
      settings.openSeconds,
      settings.closeSeconds,
      machine.defaultDurationSeconds,
    );
    const bookings = await confirmedForMachineDate(ctx, machineId, today);
    const openSlots = grid.filter((s) => {
      if (machine.status === "MAINTENANCE") return false;
      if (!machine.active || machine.status === "DISABLED") return false;
      if (s.end <= nowSec) return false;
      if (bookings.some((b) => b.startSeconds === s.start && b.endSeconds === s.end)) {
        return false;
      }
      return true;
    }).length;
    const storedActive = bookings.map((b) => ({
      startSeconds: b.startSeconds,
      endSeconds: b.endSeconds,
    }));
    return {
      machineNumber: machine.machineNumber,
      name: machine.name,
      capacityKg: machine.capacityKg,
      location: machine.location,
      defaultDurationSeconds: machine.defaultDurationSeconds,
      liveStatus: deriveMachineStatus(machine.status, storedActive, now),
      openSlots,
      totalSlots: grid.length,
      openTime: secondsTo12h(settings.openSeconds),
      closeTime: secondsTo12h(settings.closeSeconds),
    };
  },
});

/** Admin: all bookings with student info (latest first). */
export const adminAllBookings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const today = currentIstDate(now);
    const nowSec = currentIstSecondsOfDay(now);
    const rows = await ctx.db.query("bookings").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const out = [];
    for (const b of rows.slice(0, 300)) {
      const u = await ctx.db.get(b.userId);
      const m = await ctx.db.get(b.machineId);
      out.push({
        _id: b._id,
        bookingId: b.bookingId,
        studentName: u?.name ?? "Student",
        studentRoom: u?.roomNumber ?? "",
        machineNumber: m?.machineNumber ?? 0,
        date: b.date,
        label12h: `${secondsTo12h(b.startSeconds)} – ${secondsTo12h(b.endSeconds)}`,
        status: b.status,
        derived:
          b.status === "CONFIRMED"
            ? b.date < today || (b.date === today && b.endSeconds <= nowSec)
              ? "COMPLETED"
              : "UPCOMING"
            : "CANCELLED",
        cancellationReason: b.cancellationReason ?? null,
        createdAt: b.createdAt,
      });
    }
    return out;
  },
});
