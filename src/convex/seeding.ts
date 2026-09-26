// HVR PG Laundry — idempotent seed. Creates default settings, machines and
// demo students with realistic bookings so every screen has real data.
//
// Run once after deploying: `bun convex run seeding:seed`. Safe to run
// repeatedly: every section checks first.

import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import {
  addDays,
  currentIstDate,
  currentIstSecondsOfDay,
  hhmmToSeconds,
  weekDates,
} from "./time";
import { ROLES } from "./schema";

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const results: string[] = [];

    // 1. Settings singleton -------------------------------------------------
    const settings = await ctx.db.query("settings").first();
    if (!settings) {
      await ctx.db.insert("settings", {
        openSeconds: hhmmToSeconds("05:00"),
        closeSeconds: hhmmToSeconds("22:00"),
        defaultDurationSeconds: 90 * 60,
        weeklyLimit: 4,
        supportName: "HVR PG Owner",
        supportPhone: "+91 98450 00000",
        emergencyPhone: "+91 98450 11111",
        timezoneOffsetMinutes: 330,
        updatedAt: Date.now(),
      });
      results.push("settings: created");
    } else {
      results.push("settings: exists");
    }

    // 2. Machines -----------------------------------------------------------
    const machineSpecs = [
      { n: 1, kg: 7, location: "Ground Floor", minutes: 90 },
      { n: 2, kg: 8, location: "Ground Floor", minutes: 90 },
      { n: 3, kg: 6, location: "First Floor", minutes: 70 },
    ];
    for (const spec of machineSpecs) {
      const existing = await ctx.db
        .query("machines")
        .withIndex("by_machineNumber", (q) => q.eq("machineNumber", spec.n))
        .first();
      if (!existing) {
        await ctx.db.insert("machines", {
          machineNumber: spec.n,
          name: `Machine ${String(spec.n).padStart(2, "0")}`,
          capacityKg: spec.kg,
          location: spec.location,
          status: "AVAILABLE",
          defaultDurationSeconds: spec.minutes * 60,
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        results.push(`machine ${spec.n}: created`);
      } else {
        results.push(`machine ${spec.n}: exists`);
      }
    }

    // 3. Demo students (email/password-less OTP accounts are created at first
    //    sign-in by Convex Auth; these rows back demo bookings + admin lists).
    //    We can't create auth accounts without their email verification, so we
    //    create lightweight user rows linked by email for demo data only.
    const demoPeople = [
      { name: "Rahul Sharma", email: "rahul@hvrpg.demo", room: "A-101", phone: "+91 90000 11111" },
      { name: "Arjun Patel", email: "arjun@hvrpg.demo", room: "A-204", phone: "+91 90000 22222" },
      { name: "Kiran Reddy", email: "kiran@hvrpg.demo", room: "B-105", phone: "+91 90000 33333" },
      { name: "Harsh Verma", email: "harsh@hvrpg.demo", room: "B-203", phone: "+91 90000 44444" },
    ];

    const userIds: Record<string, any> = {};
    for (const person of demoPeople) {
      let user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", person.email))
        .first();
      if (!user) {
        const id = await ctx.db.insert("users", {
          name: person.name,
          email: person.email,
          phone: person.phone,
          pgName: "HVR PG",
          roomNumber: person.room,
          role: ROLES.STUDENT,
          emailVerificationTime: Date.now(),
          profileComplete: true,
        });
        userIds[person.email] = id;
        results.push(`student ${person.name}: created`);
      } else {
        userIds[person.email] = user._id;
        results.push(`student ${person.name}: exists`);
      }
    }

    // 4. Demo bookings across the current week ------------------------------
    const machines = await ctx.db.query("machines").collect();
    machines.sort((a, b) => a.machineNumber - b.machineNumber);
    if (machines.length === 0) throw new ConvexError("Machines missing after seed");

    const existingBookings = await ctx.db.query("bookings").collect();
    if (existingBookings.length === 0) {
      const today = currentIstDate(Date.now());
      const monday = weekDates(today)[0];
      const nowSec = currentIstSecondsOfDay(Date.now());
      const dayOffset = (idx: number) => addDays(monday, idx);

      // [dayIndexOffset, machineIndex, startHHMM, studentEmail]
      const plan: Array<[number, number, string, string]> = [
        [0, 0, "06:30", "rahul@hvrpg.demo"], // Monday — past (completed)
        [0, 1, "11:00", "arjun@hvrpg.demo"],
        [1, 0, "17:00", "kiran@hvrpg.demo"], // Tuesday — past
        [2, 1, "08:00", "rahul@hvrpg.demo"], // Wednesday — past
        [3, 0, "12:30", "harsh@hvrpg.demo"],
        [3, 2, "15:30", "arjun@hvrpg.demo"],
        [4, 1, "09:30", "kiran@hvrpg.demo"],
        [5, 0, "18:30", "harsh@hvrpg.demo"],
        [6, 2, "19:30", "rahul@hvrpg.demo"],
      ];

      let seq = 0;
      for (const [dayIdx, mIdx, startHHMM, email] of plan) {
        const date = dayOffset(dayIdx);
        const machine = machines[mIdx];
        const start = hhmmToSeconds(startHHMM);
        const end = start + machine.defaultDurationSeconds;
        if (date === today && end <= nowSec) {
          // Keep one booking that's still relevant for today if possible.
          continue;
        }
        seq += 1;
        await ctx.db.insert("bookings", {
          bookingId: `HVR-${date.replace(/-/g, "")}-${String(seq).padStart(4, "0")}`,
          userId: userIds[email],
          machineId: machine._id,
          date,
          startSeconds: start,
          endSeconds: end,
          durationSeconds: machine.defaultDurationSeconds,
          status: "CONFIRMED",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // One cancelled example for the admin list.
      await ctx.db.insert("bookings", {
        bookingId: `HVR-${today.replace(/-/g, "")}-9901`,
        userId: userIds["arjun@hvrpg.demo"],
        machineId: machines[0]._id,
        date: today,
        startSeconds: hhmmToSeconds("05:00"),
        endSeconds: hhmmToSeconds("06:30"),
        durationSeconds: 90 * 60,
        status: "CANCELLED",
        cancellationReason: "STUDENT_CANCELLED",
        cancelledAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      results.push("demo bookings: created");
    } else {
      results.push("demo bookings: exist");
    }

    return { results };
  },
});
