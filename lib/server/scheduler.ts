import "server-only";
import { db } from "./db";
import { runDueWork } from "./pipeline";

const INTERVAL = 60_000;

const globalForScheduler = globalThis as unknown as { __teumScheduler?: NodeJS.Timeout };

/**
 * 1분마다 모든 사용자의 "밀린 일"을 처리한다.
 * 수업이 끝나는 순간을 서버가 스스로 알아채야 하므로 (노트에서 나간 시점이 아니라)
 * 클라이언트 이벤트가 아닌 주기 작업으로 돌린다.
 */
export function startScheduler() {
  if (globalForScheduler.__teumScheduler) return;
  globalForScheduler.__teumScheduler = setInterval(() => {
    void tick();
  }, INTERVAL);
  // 서버가 꺼져 있던 동안 밀린 일을 먼저 처리한다.
  setTimeout(() => void tick(), 3_000);
}

export async function tick() {
  let users: { id: string }[] = [];
  try {
    users = db.prepare(`SELECT id FROM users WHERE onboarded_at IS NOT NULL`).all() as { id: string }[];
  } catch (error) {
    console.error("[scheduler] 사용자 조회 실패", error);
    return;
  }

  for (const user of users) {
    try {
      await runDueWork(user.id);
    } catch (error) {
      console.error("[scheduler] 처리 실패", user.id, error);
    }
  }
}
