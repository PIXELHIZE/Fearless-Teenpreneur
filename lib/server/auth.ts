import "server-only";
import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db, now, uid } from "./db";

const COOKIE = "teum_session";
const SESSION_DAYS = 30;

export interface User {
  id: string;
  email: string;
  name: string;
  gender: string;
  birth_year: number | null;
  created_at: number;
  onboarded_at: number | null;
}

function hash(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function verify(password: string, salt: string, expected: string): boolean {
  const actual = Buffer.from(hash(password, salt), "hex");
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && timingSafeEqual(actual, target);
}

export function createUser(email: string, password: string): User {
  const salt = randomBytes(16).toString("hex");
  const id = uid("u_");
  db.prepare(
    `INSERT INTO users (id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, email.toLowerCase().trim(), hash(password, salt), salt, now());
  return getUserById(id)!;
}

export function findUserByEmail(email: string) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase().trim()) as
    | (User & { password_hash: string; password_salt: string })
    | undefined;
}

export function getUserById(id: string): User | undefined {
  return db
    .prepare(`SELECT id, email, name, gender, birth_year, created_at, onboarded_at FROM users WHERE id = ?`)
    .get(id) as User | undefined;
}

export function checkPassword(email: string, password: string): User | null {
  const row = findUserByEmail(email);
  if (!row) return null;
  if (!verify(password, row.password_salt, row.password_hash)) return null;
  return getUserById(row.id)!;
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expires = now() + SESSION_DAYS * 86400_000;
  db.prepare(`INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`).run(
    token,
    userId,
    now(),
    expires,
  );
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = db.prepare(`SELECT * FROM sessions WHERE token = ?`).get(token) as
    | { user_id: string; expires_at: number }
    | undefined;
  if (!session || session.expires_at < now()) return null;
  return getUserById(session.user_id) ?? null;
}

/** 로그인이 필요한 경로에서 사용한다. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
