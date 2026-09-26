// Internal settings access for Convex actions (no auth context there).

import { internalQuery } from "./_generated/server";

export const get = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("settings").first();
  },
});
