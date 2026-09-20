import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { DrillScreen } from "@/components/app/drill-screen";

export const dynamic = "force-dynamic";

const KINDS = ["ox", "flip", "trace"] as const;

/** 기초 학습은 탭바 없이 집중 화면으로 연다. */
export default async function StudyPage({ params }: { params: Promise<{ kind: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.onboarded_at) redirect("/onboarding");

  const { kind } = await params;
  if (!KINDS.includes(kind as (typeof KINDS)[number])) redirect("/home");

  return (
    <div className="app-shell">
      <DrillScreen kind={kind as (typeof KINDS)[number]} />
    </div>
  );
}
