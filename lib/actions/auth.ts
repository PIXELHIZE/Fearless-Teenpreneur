"use server";

import { redirect } from "next/navigation";
import { checkPassword, createUser, currentUser, endSession, findUserByEmail, startSession } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export interface FormState {
  error?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!EMAIL.test(email)) return { error: "이메일 형식을 확인해 주세요." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 해요." };
  if (password !== confirm) return { error: "비밀번호가 서로 달라요." };
  if (findUserByEmail(email)) return { error: "이미 가입한 이메일이에요. 로그인해 주세요." };

  const user = createUser(email, password);
  await startSession(user.id);
  redirect("/onboarding");
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요." };

  const user = checkPassword(email, password);
  if (!user) return { error: "이메일 또는 비밀번호가 맞지 않아요." };

  await startSession(user.id);
  redirect(user.onboarded_at ? "/home" : "/onboarding");
}

export async function signOutAction() {
  await endSession();
  redirect("/login");
}

export async function deleteAccountAction() {
  const user = await currentUser();
  if (!user) redirect("/login");
  db.prepare(`DELETE FROM users WHERE id = ?`).run(user.id);
  await endSession();
  redirect("/signup");
}
