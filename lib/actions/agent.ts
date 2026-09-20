"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import { addChat, listChat } from "@/lib/server/repo";
import { aiEnabled } from "@/lib/server/ai";
import { runAgentChat } from "@/lib/server/agent/chat";
import { runDueWork } from "@/lib/server/pipeline";
import type { ChatEntry } from "@/lib/types";

export async function loadChat(): Promise<ChatEntry[]> {
  const user = await requireUser();
  return listChat(user.id);
}

export async function sendToAgent(message: string): Promise<{ message: string; actions: string[]; redirect?: string }> {
  const user = await requireUser();
  const text = message.trim();
  if (!text) return { message: "", actions: [] };

  if (!aiEnabled()) {
    addChat(user.id, { role: "user", content: text });
    const reply = "지금은 AI 연결이 꺼져 있어요. OPENROUTER_API_KEY 를 설정하면 바로 대화할 수 있어요.";
    addChat(user.id, { role: "assistant", content: reply });
    return { message: reply, actions: [] };
  }

  try {
    const result = await runAgentChat(user, text);
    revalidatePath("/home");
    revalidatePath("/lessons");
    return result;
  } catch (error) {
    const reply = error instanceof Error ? `문제가 생겼어요. ${error.message}` : "잠시 후 다시 시도해 주세요.";
    addChat(user.id, { role: "assistant", content: reply });
    return { message: reply, actions: [] };
  }
}

/** 화면을 열 때 밀린 분석·자료 준비를 따라잡게 한다. */
export async function catchUp() {
  const user = await requireUser();
  await runDueWork(user.id);
  revalidatePath("/home");
  revalidatePath("/lessons");
}
