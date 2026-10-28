// Example feature: delete this file (and the link on the home page) to remove it.
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "#/lib/api";
import { attempt } from "#/lib/errors";

export const Route = createFileRoute("/notes")({ component: Notes });

function Notes() {
  const [text, setText] = useState("");
  const notes = useQuery(api.notes.list);
  const create = useMutation(api.notes.create);
  const remove = useMutation(api.notes.remove);

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-4 p-6 pt-16">
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Stored in Convex and updated live.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (text.trim() === "") return;
              if (await attempt(create({ text }), "Couldn't add the note.")) setText("");
            }}
          >
            <Input
              aria-label="New note"
              placeholder="Write a note…"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <Button type="submit">Add</Button>
          </form>
          {notes === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {notes.map((note) => (
                <li key={note._id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="wrap-break-word">{note.text}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void attempt(remove({ id: note._id }), "Couldn't delete the note.")
                    }
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
