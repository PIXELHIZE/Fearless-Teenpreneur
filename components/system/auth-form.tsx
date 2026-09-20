"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CircleAlert } from "lucide-react";
import { MotionButton } from "@/components/system/motion-button";
import { Logo } from "@/components/system/logo";
import type { FormState } from "@/lib/actions/auth";

interface Props {
  mode: "signup" | "login";
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}

const COPY = {
  signup: {
    title: "시작해 볼까요",
    lead: "목표만 알려 주면 계획·자료·피드백은 teum 이 맡을게요.",
    submit: "가입하고 시작하기",
    swapText: "이미 계정이 있나요?",
    swapLink: "로그인",
    swapHref: "/login",
  },
  login: {
    title: "다시 만나서 반가워요",
    lead: "이어서 공부할 수 있게 준비해 뒀어요.",
    submit: "로그인",
    swapText: "아직 계정이 없나요?",
    swapLink: "가입하기",
    swapHref: "/signup",
  },
} as const;

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const copy = COPY[mode];

  return (
    <main className="onboard">
      <div className="onboard-body app-frame">
        <div className="rise">
          <Logo variant="lockup" style={{ height: 30 }} />
          <h2>{copy.title}</h2>
          <p>{copy.lead}</p>
        </div>

        <form action={formAction} className="stack rise rise-1">
          <div className="field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="input-lg"
              placeholder="you@example.com"
            />
          </div>

          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              className="input-lg"
              placeholder={mode === "signup" ? "8자 이상" : ""}
            />
          </div>

          {mode === "signup" ? (
            <div className="field">
              <label htmlFor="confirm">비밀번호 확인</label>
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input-lg" />
            </div>
          ) : null}

          {state.error ? (
            <p className="field-error" role="alert">
              <CircleAlert size={16} aria-hidden />
              {state.error}
            </p>
          ) : null}

          <MotionButton type="submit" variant="brand" size="lg" loading={pending} className="w-full">
            {copy.submit}
          </MotionButton>
        </form>

        <p className="muted rise rise-2" style={{ fontSize: 14, textAlign: "center" }}>
          {copy.swapText}{" "}
          <Link href={copy.swapHref} style={{ color: "var(--brand)", fontWeight: 600 }}>
            {copy.swapLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
