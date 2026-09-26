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
      completedAt: v.optional(v.number()),
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
      latitude: v.optional(v.number()), // PG location for weather
      longitude: v.optional(v.number()),
      updatedAt: v.number(),
    }),

    // Cached real weather lookups, keyed by booking (no fabricated data —
    // figures always come from the configured weather provider).
    weatherReports: defineTable({
      bookingDbId: v.id("bookings"),
      rainProbability: v.number(),
      summary: v.string(),
      guidance: v.string(),
      provider: v.string(),
      fetchedAt: v.number(),
    }).index("by_booking", ["bookingDbId"]),

    // Monotonic per-day counters used to generate race-safe booking IDs
    counters: defineTable({
      key: v.string(), // "bookingId:YYYY-MM-DD"
      value: v.number(),
    }).index("by_key", ["key"]),

    // In-app notification center
    notifications: defineTable({
      userId: v.id("users"),
      bookingDbId: v.optional(v.id("bookings")),
      type: v.union(
        v.literal("BOOKING_CONFIRMED"),
        v.literal("MACHINE_READY"),
        v.literal("PREVIOUS_FINISHED"),
        v.literal("SLOT_CANCELLED"),
        v.literal("MACHINE_MAINTENANCE"),
        v.literal("WEATHER_ALERT"),
        v.literal("PG_SUPPORT"),
      ),
      title: v.string(),
      message: v.string(),
      // Optional action prompt for machine-ready notifications
      actionState: v.optional(
        v.union(
          v.literal("PENDING"),
          v.literal("ACKNOWLEDGED"),
          v.literal("DECLINED"),
        ),
      ),
      readAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_read", ["userId", "readAt"]),

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
