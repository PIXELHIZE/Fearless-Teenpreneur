"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, MessagesSquare, Sparkles, X } from "lucide-react";
import { loadChat, sendToAgent } from "@/lib/actions/agent";
import type { ChatEntry } from "@/lib/types";

const SUGGESTIONS = ["이번 주 일정 좀 바꿔 줘", "영어 단어도 목표에 넣고 싶어", "요즘 뭐가 부족해?"];

/**
 * 오른쪽 아래 버튼으로 여는 에이전트 대화.
 * 모바일에서는 화면 전체를 쓰고, 넓은 화면에서는 큰 패널로 뜬다.
 * 여기서 스케줄·커리큘럼을 바꿀 수 있지만 다가오는 수업은 건드리지 않는다.
 */
export function AgentChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || loaded) return;
    void loadChat().then((list) => {
      setEntries(list);
      setLoaded(true);
    });
  }, [open, loaded]);

  useEffect(() => {
    if (!open) return;
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, pending, open]);

  // 전체 화면 대화 중에는 뒤 페이지가 스크롤되지 않게 한다.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setDraft("");
    setEntries((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, role: "user", content: message, actions: [], created_at: Date.now() },
    ]);
    startTransition(async () => {
      const result = await sendToAgent(message);
      setEntries((prev) => [
        ...prev,
        { id: `tmp-${Date.now()}-a`, role: "assistant", content: result.message, actions: result.actions, created_at: Date.now() },
      ]);
      // 즉시 과외를 열었으면 잠깐 답을 보여 주고 수업으로 넘어간다.
      if (result.redirect) {
        setTimeout(() => {
          setOpen(false);
          router.push(result.redirect!);
        }, 1200);
      }
    });
  };

  return (
    <>
      {open ? (
        <section className="chat-panel" role="dialog" aria-modal="true" aria-label="AI 에이전트 대화">
          <header className="chat-head">
            <span className="chat-avatar" aria-hidden>
              <Sparkles size={20} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>teum 에이전트</strong>
              <span>일정·목표·커리큘럼을 함께 조정해요</span>
            </div>
            <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="닫기">
              <X size={22} aria-hidden />
            </button>
          </header>

          <div className="chat-log" ref={logRef}>
            {!loaded ? (
              <>
                <div className="skeleton-line" style={{ width: "70%" }} />
                <div className="skeleton-line" style={{ width: "50%" }} />
              </>
            ) : null}

            {loaded && entries.length === 0 ? (
              <>
                <div className="chat-bubble" data-role="assistant">
                  안녕하세요. 공부하다 막히거나 일정이 어긋나면 편하게 말해 주세요. 계획은 제가 다시 맞출게요.
                </div>
                <div className="chat-actions">
                  {SUGGESTIONS.map((text) => (
                    <button key={text} type="button" className="chat-chip" onClick={() => send(text)}>
                      {text}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {entries.map((entry) => (
              <div key={entry.id} style={{ display: "grid", gap: 6 }}>
                <div className="chat-bubble" data-role={entry.role}>
                  {entry.content}
                </div>
                {entry.actions?.length ? (
                  <div className="chat-actions">
                    {entry.actions.map((action) => (
                      <span key={action} className="pill" data-tone="outline">
                        {action}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {pending ? (
              <div className="chat-bubble" data-role="assistant">
                <span className="typing" aria-label="답변 작성 중">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            ) : null}
          </div>

          <form
            className="chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="무엇이든 말해 주세요"
              aria-label="메시지"
              autoFocus
            />
            <button type="submit" className="chat-send" disabled={!draft.trim() || pending} aria-label="보내기">
              <ArrowUp size={20} aria-hidden />
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className="chat-fab"
        data-open={open ? "true" : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "에이전트 대화 닫기" : "에이전트와 대화하기"}
      >
        {open ? <X aria-hidden /> : <MessagesSquare aria-hidden />}
      </button>
    </>
  );
}
