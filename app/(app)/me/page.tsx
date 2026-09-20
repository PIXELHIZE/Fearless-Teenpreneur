import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { goalProgress, lessonHistory, profileStats } from "@/lib/server/views";
import { listFeedback } from "@/lib/server/xp";
import { listRevisions, listUnits, recentAnalyses } from "@/lib/server/repo";
import { MeScreen } from "@/components/app/me-screen";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const goals = goalProgress(user.id);
  const revisions = listRevisions(user.id, 8).map((row) => ({
    id: row.id,
    reason: row.reason,
    changes: safeList(row.changes_json),
    effectiveFrom: row.effective_from,
    createdAt: row.created_at,
  }));
  const analyses = recentAnalyses(user.id, 5).map((row) => ({
    lessonId: row.lesson_id,
    summary: row.summary,
    accuracy: row.accuracy,
    focusSeconds: row.focus_seconds,
    createdAt: row.created_at,
  }));

  return (
    <MeScreen
      stats={profileStats(user.id)}
      feedback={listFeedback(user.id, 4)}
      lessons={lessonHistory(user.id, 4)}
      user={{
        name: user.name,
        email: user.email,
        gender: user.gender,
        birthYear: user.birth_year,
      }}
      goals={goals.map((item) => ({
        id: item.goal.id,
        title: item.goal.title,
        subject: item.goal.subject,
        level: item.goal.level,
        targetDate: item.goal.target_date,
        total: item.total,
        done: item.done,
        mastery: item.mastery,
        units: listUnits(user.id, item.goal.id).map((unit) => ({
          id: unit.id,
          title: unit.title,
          summary: unit.summary,
          mastery: unit.mastery,
          status: unit.status,
        })),
      }))}
      revisions={revisions}
      analyses={analyses}
    />
  );
}

function safeList(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
