import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// HVR PG Laundry roles: students book slots, admin manages the PG laundry.
export const ROLES = {
  ADMIN: "admin",
  STUDENT: "student",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.STUDENT),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // HVR PG Laundry student profile
      phone: v.optional(v.string()),
      pgName: v.optional(v.string()),
      roomNumber: v.optional(v.string()),
      profileComplete: v.optional(v.boolean()),
      disabled: v.optional(v.boolean()),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Washing machines
    machines: defineTable({
      machineNumber: v.number(),
      name: v.string(),
      capacityKg: v.number(),
      location: v.string(),
      // Stored operational status. RUNNING / RESERVED are derived at read time
      // from bookings so they can never go stale.
      status: v.union(
        v.literal("AVAILABLE"),
        v.literal("MAINTENANCE"),
        v.literal("OFFLINE"),
        v.literal("DISABLED"),
      ),
      defaultDurationSeconds: v.number(),
      active: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_machineNumber", ["machineNumber"]),

    // Bookings. Slot grid itself is generated deterministically from settings
    // (see convex/slots.ts), so only confirmed reservations are stored.
    bookings: defineTable({
      bookingId: v.string(), // e.g. HVR-20260926-0001
      userId: v.id("users"),
      machineId: v.id("machines"),
      date: v.string(), // YYYY-MM-DD in PG timezone (IST)
      startSeconds: v.number(), // seconds from midnight
      endSeconds: v.number(),
      durationSeconds: v.number(),
      status: v.union(v.literal("CONFIRMED"), v.literal("CANCELLED")),
      cancelledAt: v.optional(v.number()),
      cancellationReason: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_machine_date", ["machineId", "date"])
      .index("by_user", ["userId"])
      .index("by_user_date", ["userId", "date"])
      .index("by_date", ["date"])
      .index("by_status", ["status"])
      .index("by_bookingId", ["bookingId"]),

    // Single-row app configuration
    settings: defineTable({
      openSeconds: v.number(), // e.g. 5 * 3600 = 05:00 AM
      closeSeconds: v.number(), // e.g. 22 * 3600 = 10:00 PM
      defaultDurationSeconds: v.number(), // e.g. 90 * 60
      weeklyLimit: v.number(), // max confirmed bookings per student per week
      supportName: v.string(),
      supportPhone: v.string(),
      emergencyPhone: v.string(),
      timezoneOffsetMinutes: v.number(), // 330 for IST
      updatedAt: v.number(),
    }),

    // Monotonic per-day counters used to generate race-safe booking IDs
    counters: defineTable({
      key: v.string(), // "bookingId:YYYY-MM-DD"
      value: v.number(),
    })      .index("by_key", ["key"]),

    // tableName: defineTable({
    //   ...
    //   // table fields
    // }).index("by_field", ["field"])
  },
  {
    schemaValidation: false,
  },
);

export default schema;
