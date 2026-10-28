import { defineSchema } from "convex/server";
import { notesTable } from "./models/notes/table";
import { usersTable } from "./models/users/table";

export default defineSchema({
  users: usersTable,
  // Example feature: delete this table and convex/models/notes to remove it.
  notes: notesTable,
});
