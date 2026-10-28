import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { api } from "../../_generated/api";
import { errors } from "../../lib/errors";
import schema from "../../schema";
import { modules } from "../../test.setup";

describe("notes", () => {
  test("creates and lists notes, newest first", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.api.notes.create, { text: "  first  " });
    await t.mutation(api.api.notes.create, { text: "second" });

    const notes = await t.query(api.api.notes.list, {});
    expect(notes.map((note) => note.text)).toEqual(["second", "first"]);
  });

  test("rejects empty notes", async () => {
    const t = convexTest(schema, modules);
    const error = await t.mutation(api.api.notes.create, { text: "   " }).catch((e) => e);
    expect(errors.is(error, "invalid_length")).toBe(true);
  });

  test("deletes a note", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.api.notes.create, { text: "gone soon" });

    await t.mutation(api.api.notes.remove, { id });
    expect(await t.query(api.api.notes.list, {})).toEqual([]);
    const error = await t.mutation(api.api.notes.remove, { id }).catch((e) => e);
    expect(errors.is(error, "not_found")).toBe(true);
  });
});
