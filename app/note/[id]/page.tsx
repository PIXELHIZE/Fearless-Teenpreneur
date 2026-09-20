import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { getNote } from "@/lib/actions/note";
import { NoteEditor } from "@/components/note/note-editor";

export const dynamic = "force-dynamic";

export default async function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const note = await getNote(id);
  if (!note) redirect("/note");

  return <NoteEditor note={note} />;
}
