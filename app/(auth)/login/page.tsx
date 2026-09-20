import { redirect } from "next/navigation";
import { AuthForm } from "@/components/system/auth-form";
import { signInAction } from "@/lib/actions/auth";
import { currentUser } from "@/lib/server/auth";

export default async function LoginPage() {
  if (await currentUser()) redirect("/home");
  return <AuthForm mode="login" action={signInAction} />;
}
