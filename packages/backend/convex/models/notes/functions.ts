import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import { errors } from "../../lib/errors";

const MIN_LENGTH = 1;
const MAX_LENGTH = 500;

const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("notes").order("desc").take(100);
  },
});

const create = mutation({
  args: { text: v.string() },
  returns: v.id("notes"),
  handler: async (ctx, { text }) => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      throw errors.create("invalid_length", { what: "note", min: MIN_LENGTH, max: MAX_LENGTH });
    }
    return await ctx.db.insert("notes", { text: trimmed });
  },
});

const remove = mutation({
  args: { id: v.id("notes") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const note = await ctx.db.get("notes", id);
    if (note === null) throw errors.create("not_found", { what: "note" });
    await ctx.db.delete("notes", id);
    return null;
  },
});

export const notesApi = { list, create, remove };
