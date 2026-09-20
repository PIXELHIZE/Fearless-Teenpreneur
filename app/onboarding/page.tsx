import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/system/onboarding-flow";
import { currentUser } from "@/lib/server/auth";

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.onboarded_at) redirect("/home");
  return <OnboardingFlow />;
}
