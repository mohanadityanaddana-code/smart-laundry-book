// HVR PG Laundry — student profile and admin role-sync logic.

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ROLES } from "./schema";

/**
 * Admin emails, comma-separated via env var `ADMIN_EMAILS`.
 * A signed-in user whose email is on this list is promoted to the admin role
 * automatically (server-side). Configure in the Freebuff env/keys UI.
 */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "admin@hvrpg.in")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Called by the app shell right after sign-in. Promotes configured admin
 * emails to the ADMIN role and back-fills required profile fields, then
 * returns the canonical user profile the app works with.
 */
export const syncMe = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not signed in");
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("Account not found");

    const patch: Record<string, unknown> = {};

    // Role sync (never demote an existing admin).
    if (user.role !== ROLES.ADMIN) {
      const email = (user.email ?? "").toLowerCase();
      if (email && adminEmails().includes(email)) {
        patch.role = ROLES.ADMIN;
      } else if (user.role !== ROLES.STUDENT) {
        patch.role = ROLES.STUDENT;
      }
    }

    // Every account must carry the PG name (v1 is single-PG).
    if (user.pgName !== "HVR PG") patch.pgName = "HVR PG";

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(userId, patch);
    }

    const updated = await ctx.db.get(userId);
    return {
      _id: updated!._id,
      name: updated!.name ?? "",
      email: updated!.email ?? "",
      phone: updated!.phone ?? "",
      pgName: updated!.pgName ?? "",
      roomNumber: updated!.roomNumber ?? "",
      role: updated!.role ?? ROLES.STUDENT,
      emailVerified: !!updated!.emailVerificationTime,
      profileComplete: !!updated!.profileComplete,
      disabled: !!updated!.disabled,
      isAnonymous: !!updated!.isAnonymous,
    };
  },
});

/** Update the signed-in student's editable profile fields. */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    roomNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not signed in");
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("Account not found");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length < 2) throw new ConvexError("Name is too short");
      patch.name = name;
    }
    if (args.phone !== undefined) {
      const phone = args.phone.replace(/\s+/g, "");
      if (!/^[+0-9][0-9-]{6,17}$/.test(phone)) {
        throw new ConvexError("Enter a valid phone number");
      }
      patch.phone = phone;
    }
    if (args.roomNumber !== undefined) {
      const room = args.roomNumber.trim();
      if (room.length < 1) throw new ConvexError("Room number is required");
      patch.roomNumber = room;
    }
    if (
      user.role !== ROLES.ADMIN &&
      (patch.name ?? user.name) &&
      (patch.phone ?? user.phone) &&
      (patch.roomNumber ?? user.roomNumber) &&
      !user.profileComplete
    ) {
      patch.profileComplete = true;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(userId, patch);
    }
    return { ok: true };
  },
});
