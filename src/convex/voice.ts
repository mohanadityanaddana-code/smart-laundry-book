// HVR PG Laundry — voice / AI notification abstraction.
//
// The booking rules stay deterministic; voice is only a delivery channel for
// the machine-ready notification. A real telephony provider can be plugged in
// later via env vars (VOICE_PROVIDER / VOICE_PROVIDER_API_KEY); until then a
// clearly-labelled mock provider records the rendered message so the workflow
// is end-to-end testable and the admin can inspect call history.

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

/** Render {student_name} {machine_number} {start_time} {end_time} {pg_name}. */
export function renderTemplate(
  text: string,
  vars: {
    student_name?: string;
    machine_number?: string;
    start_time?: string;
    end_time?: string;
    pg_name?: string;
  },
): string {
  return text
    .replace(/\{student_name\}/g, vars.student_name ?? "student")
    .replace(/\{machine_number\}/g, vars.machine_number ?? "")
    .replace(/\{start_time\}/g, vars.start_time ?? "")
    .replace(/\{end_time\}/g, vars.end_time ?? "")
    .replace(/\{pg_name\}/g, vars.pg_name ?? "HVR PG");
}

/**
 * Dispatch a voice call through the configured provider and log the attempt.
 * Always resolves; failures are recorded, never thrown into the booking flow.
 */
export const dispatchCall = internalMutation({
  args: {
    bookingDbId: v.id("bookings"),
    targetUserId: v.id("users"),
    type: v.string(),
    message: v.string(),
    attemptNumber: v.number(),
  },
  handler: async (ctx, args): Promise<{ status: string; detail: string }> => {
    const provider = process.env.VOICE_PROVIDER ?? "mock";
    const configured = !!process.env.VOICE_PROVIDER_API_KEY;

    let status: "COMPLETED" | "FAILED" | "SKIPPED_NO_PROVIDER";
    let detail: string;
    if (provider === "mock") {
      status = "COMPLETED";
      detail =
        "Recorded by the development mock voice provider. Set VOICE_PROVIDER and VOICE_PROVIDER_API_KEY to deliver real AI voice calls.";
    } else if (!configured) {
      status = "SKIPPED_NO_PROVIDER";
      detail = `Provider "${provider}" is configured but VOICE_PROVIDER_API_KEY is missing — call skipped, in-app notification was still delivered.`;
    } else {
      // Real provider integration point: implement the provider's HTTP call
      // here in a Convex action (actions can reach the internet) and record
      // the provider's call id in `detail`. Not enabled in this build.
      status = "FAILED";
      detail = `Provider "${provider}" is not implemented in this build — in-app notification was delivered.`;
    }

    await ctx.db.insert("voiceCalls", {
      bookingDbId: args.bookingDbId,
      targetUserId: args.targetUserId,
      provider,
      type: args.type,
      message: args.message,
      attemptNumber: args.attemptNumber,
      status,
      detail,
      at: Date.now(),
    });
    return { status, detail };
  },
});

/* ----------------------------- Admin management ---------------------------- */

export const adminListTemplates = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("voiceTemplates").collect();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const adminSaveTemplate = mutation({
  args: {
    templateId: v.optional(v.id("voiceTemplates")),
    name: v.string(),
    type: v.string(),
    text: v.string(),
    active: v.boolean(),
  },
  handler: async (ctx, { templateId, name, type, text, active }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not signed in");
    const admin = await ctx.db.get(userId);
    if (!admin || admin.role !== "admin") {
      throw new ConvexError("Admin access required");
    }
    if (text.trim().length < 10) {
      throw new ConvexError("Template text is too short");
    }
    const now = Date.now();
    if (templateId) {
      await ctx.db.patch(templateId, { name, type, text, active, updatedAt: now });
      return { ok: true };
    }
    await ctx.db.insert("voiceTemplates", {
      name,
      type,
      text,
      active,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const adminDeleteTemplate = mutation({
  args: { templateId: v.id("voiceTemplates") },
  handler: async (ctx, { templateId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not signed in");
    const admin = await ctx.db.get(userId);
    if (!admin || admin.role !== "admin") {
      throw new ConvexError("Admin access required");
    }
    await ctx.db.delete(templateId);
    return { ok: true };
  },
});

/** Rendered preview of the active machine_ready template for the admin UI. */
export const adminPreview = query({
  args: {
    studentName: v.optional(v.string()),
    machineNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db
      .query("voiceTemplates")
      .withIndex("by_type", (q) => q.eq("type", "machine_ready"))
      .filter((q) => q.eq(q.field("active"), true))
      .first();
    if (!template) return { text: null, rendered: null, provider: process.env.VOICE_PROVIDER ?? "mock" };
    const rendered = renderTemplate(template.text, {
      student_name: args.studentName ?? "Rahul",
      machine_number: String(args.machineNumber ?? 2),
      start_time: "7:00 PM",
      end_time: "8:30 PM",
      pg_name: "HVR PG",
    });
    return {
      text: template.text,
      rendered,
      provider: process.env.VOICE_PROVIDER ?? "mock",
    };
  },
});

export const adminListCalls = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("voiceCalls").collect();
    const out = [];
    for (const c of rows.sort((a, b) => b.at - a.at).slice(0, 100)) {
      const user = await ctx.db.get(c.targetUserId);
      out.push({
        _id: c._id,
        targetName: user?.name ?? "Student",
        type: c.type,
        message: c.message,
        attemptNumber: c.attemptNumber,
        status: c.status,
        detail: c.detail,
        provider: c.provider,
        at: c.at,
      });
    }
    return out;
  },
});
