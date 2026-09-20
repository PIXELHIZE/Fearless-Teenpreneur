import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { LessonRunner } from "@/components/app/lesson-runner";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  return <LessonRunner lessonId={id} />;
}
