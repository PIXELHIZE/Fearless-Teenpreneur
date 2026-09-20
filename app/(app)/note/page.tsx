import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { listNotes } from "@/lib/actions/note";
import { NoteLibrary } from "@/components/note/note-library";

export const dynamic = "force-dynamic";

export default async function NotePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const notes = await listNotes();
  return (
    <NoteLibrary
      notes={notes.map((note) => ({
        id: note.id,
        title: note.title,
        kind: note.kind,
        paper: note.paper,
        examCount: note.exam.length,
        pinCount: note.pins.length,
        submitted: Boolean(note.submitted_at),
        score: note.result?.score ?? null,
        total: note.result?.total ?? null,
        updatedAt: note.updated_at,
      }))}
    />
  );
}
