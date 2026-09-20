import { redirect } from "next/navigation";
import { AuthForm } from "@/components/system/auth-form";
import { signUpAction } from "@/lib/actions/auth";
import { currentUser } from "@/lib/server/auth";

export default async function SignUpPage() {
  if (await currentUser()) redirect("/home");
  return <AuthForm mode="signup" action={signUpAction} />;
}
