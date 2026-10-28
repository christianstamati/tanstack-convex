import { v } from "convex/values";
import { internalQuery, type MutationCtx } from "../../_generated/server";
import schema from "../../schema";

/** Stores an email that wasn't sent, one row per recipient. */
export async function storeEmail(
  ctx: MutationCtx,
  { to, subject, text }: { to: string[]; subject: string; text: string },
): Promise<void> {
  const link = text.match(/https?:\/\/\S+/)?.[0] ?? null;
  const code = link === null ? null : new URL(link).searchParams.get("code");
  for (const recipient of to) {
    await ctx.db.insert("devMailbox", { to: recipient.toLowerCase(), subject, text, link, code });
  }
}

const vEmail = schema.doc("devMailbox");

/**
 * The newest email to an address, or `null`. From packages/backend:
 *
 *   bunx convex run internal/devMailbox:latest '{"to": "ada@example.com"}'
 */
const latest = internalQuery({
  args: { to: v.string() },
  returns: v.union(vEmail, v.null()),
  handler: async (ctx, { to }) => {
    return await ctx.db
      .query("devMailbox")
      .withIndex("by_to", (q) => q.eq("to", to.toLowerCase()))
      .order("desc")
      .first();
  },
});

/** The newest emails to anyone, newest first. */
const list = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(vEmail),
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("devMailbox")
      .order("desc")
      .take(Math.min(limit ?? 20, 100));
  },
});

export const devMailboxInternal = { latest, list };
