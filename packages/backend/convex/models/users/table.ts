import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * One document for each user. Its `_id` is the user id of Convex Auth's tokens. The auth
 * components keep the email, the password hash and the sessions; this table keeps the profile.
 */
export const usersTable = defineTable({
  /** The name to show, set on /settings. Unset until the user picks one. */
  name: v.optional(v.string()),
  /** An avatar URL, such as one an OAuth provider gives. */
  image: v.optional(v.string()),
});
