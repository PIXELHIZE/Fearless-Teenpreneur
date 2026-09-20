"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, FileCheck2, NotebookPen, Plus, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { MotionButton } from "@/components/system/motion-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHead } from "@/components/app/page-head";
import { createBlankNote, createCustomExamAction, deleteNote } from "@/lib/actions/note";
import type { ExamStyle } from "@/lib/server/agent/exam";

interface NoteView {
  id: string;
  title: string;
  kind: string;
  score: number | null;
  total: number | null;
  paper: string;
  examCount: number;
  pinCount: number;
  submitted: boolean;
  updatedAt: number;
}

const STYLES: { value: ExamStyle; label: string }[] = [
  { value: "mixed", label: "혼합" },
  { value: "choice", label: "5지선다" },
  { value: "short", label: "단답형" },
  { value: "essay", label: "서술형" },
];
const COUNTS = [5, 10, 15, 20];

const PAPERS = [
  { value: "plain", label: "무지" },
  { value: "ruled", label: "줄노트" },
  { value: "grid", label: "모눈" },
  { value: "dotted", label: "점선" },
];

export function NoteLibrary({ notes }: { notes: NoteView[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [paper, setPaper] = useState("ruled");
  const [pending, startTransition] = useTransition();

  const [examOpen, setExamOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [style, setStyle] = useState<ExamStyle>("mixed");
  const [examError, setExamError] = useState("");

  const createExam = () => {
    setExamError("");
    startTransition(async () => {
      const result = await createCustomExamAction({ topic, count, style });
      if (!result.ok || !result.noteId) {
        setExamError(result.error ?? "시험지를 만들지 못했어요.");
        return;
      }
      router.push(`/note/${result.noteId}`);
    });
  };

  const create = () => {
    startTransition(async () => {
      const id = await createBlankNote(title, paper);
      router.push(`/note/${id}`);
    });
  };

  const exams = notes.filter((note) => note.kind === "exam" || note.kind === "custom");
  const blanks = notes.filter((note) => note.kind === "blank");

  return (
    <>
      <main className="app-main">
        <PageHead
          title="AI 노트"
          subtitle="막히는 곳에 동그라미만 치면 AI 펜이 도와줘요"
          side={
            <Button variant="outline" shape="pill" size="icon" aria-label="새 노트" onClick={() => setOpen(true)}>
              <Plus aria-hidden />
            </Button>
          }
        />
        <button type="button" className="instant-card rise" data-tone="grape" onClick={() => setExamOpen(true)}>
          <span className="instant-icon" aria-hidden>
            <WandSparkles size={22} />
          </span>
          <span style={{ flex: 1, textAlign: "start" }}>
            <strong>맞춤 시험지 만들기</strong>
            <small>주제와 문항 수를 적으면 모의고사가 나와요</small>
          </span>
          <span className="instant-go">만들기</span>
        </button>

        {exams.length ? (
          <section className="rise rise-1">
            <div className="section-title">
              <h2>시험지</h2>
            </div>
            <div className="stack-sm">
              {exams.map((note) => (
                <NoteRow key={note.id} note={note} onOpen={() => router.push(`/note/${note.id}`)} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="rise rise-1">
          <div className="section-title">
            <h2>내 노트</h2>
          </div>
          {blanks.length ? (
            <div className="stack-sm">
              {blanks.map((note) => (
                <NoteRow key={note.id} note={note} onOpen={() => router.push(`/note/${note.id}`)} />
              ))}
            </div>
          ) : (
            <div className="card">
              <EmptyState
                icon={<NotebookPen aria-hidden />}
                title="노트가 없어요"
                description="빈 노트를 만들어 손으로 풀어 보세요. 막히는 곳은 AI 펜으로 물어볼 수 있어요."
                action={
                  <MotionButton variant="brand" onClick={() => setOpen(true)}>
                    <Plus size={16} aria-hidden /> 새 노트
                  </MotionButton>
                }
              />
            </div>
          )}
        </section>
      </main>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>새 노트</SheetTitle>
            <SheetDescription>종이 결을 고르면 바로 시작할 수 있어요.</SheetDescription>
          </SheetHeader>

          <div className="stack" style={{ marginTop: 16 }}>
            <div className="field">
              <label htmlFor="note-title">노트 이름</label>
              <input
                id="note-title"
                className="input-lg"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="제목 없는 노트"
              />
            </div>
            <div className="field">
              <label>종이</label>
              <div className="choice-grid">
                {PAPERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className="choice-chip"
                    aria-pressed={paper === item.value}
                    onClick={() => setPaper(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <MotionButton variant="sun" size="lg" loading={pending} onClick={create}>
              만들기
            </MotionButton>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={examOpen} onOpenChange={setExamOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>맞춤 시험지</SheetTitle>
            <SheetDescription>내 커리큘럼과 최근 약점을 알고 있는 에이전트가 모의고사 형식으로 출제해요.</SheetDescription>
          </SheetHeader>

          <div className="stack">
            <div className="field">
              <label htmlFor="exam-topic">주제 · 분야</label>
              <input
                id="exam-topic"
                className="input-lg"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예) 이차함수 최댓값·최솟값, 영어 관계대명사"
              />
            </div>
            <div className="field">
              <label>문항 수</label>
              <div className="choice-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {COUNTS.map((value) => (
                  <button key={value} type="button" className="choice-chip" aria-pressed={count === value} onClick={() => setCount(value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>유형</label>
              <div className="choice-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {STYLES.map((item) => (
                  <button key={item.value} type="button" className="choice-chip" aria-pressed={style === item.value} onClick={() => setStyle(item.value)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {examError ? (
              <p className="field-error" role="alert">
                <CircleAlert size={16} aria-hidden />
                {examError}
              </p>
            ) : null}

            <MotionButton variant="grape" size="lg" loading={pending} onClick={createExam}>
              <WandSparkles size={18} aria-hidden /> {pending ? "출제하고 있어요" : "시험지 만들기"}
            </MotionButton>
            {pending ? (
              <p className="muted" style={{ fontSize: 12.5, textAlign: "center" }}>
                {count}문항을 만드는 데 10~20초쯤 걸려요.
              </p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NoteRow({ note, onOpen }: { note: NoteView; onOpen: () => void }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="lesson-row" style={{ alignItems: "center" }}>
      <button
        type="button"
        onClick={onOpen}
        className="row"
        style={{ flex: 1, gap: 14, border: 0, background: "none", textAlign: "start", minWidth: 0, padding: 0, color: "inherit" }}
      >
        <span className="icon-tile" data-tone={note.kind === "custom" ? "grape" : note.kind === "exam" ? "brand" : "sun"} aria-hidden>
          {note.kind === "blank" ? <NotebookPen size={19} /> : <FileCheck2 size={19} />}
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <strong
            style={{ display: "block", fontSize: 15, fontWeight: 650, letterSpacing: "-.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {note.title}
          </strong>
          <span className="muted row" style={{ fontSize: 12.5, gap: 6, marginTop: 3 }}>
            {note.kind === "blank" ? "빈 노트" : `${note.examCount}문항${note.kind === "custom" ? " · 맞춤" : " · 수업"}`}
            {note.pinCount ? (
              <span className="row" style={{ gap: 3, color: "var(--brand)" }}>
                <Sparkles size={11} aria-hidden />
                {note.pinCount}
              </span>
            ) : null}
          </span>
        </span>
      </button>

      {note.submitted ? (
        <span className="pill tnum" data-tone="ok">
          {note.score !== null && note.total ? `${note.score}/${note.total}점` : "채점 완료"}
        </span>
      ) : null}

      <button
        type="button"
        className="icon-button"
        aria-label="노트 삭제"
        disabled={pending}
        onClick={() => startTransition(async () => { await deleteNote(note.id); })}
      >
        <Trash2 size={16} aria-hidden />
      </button>
    </div>
  );
}
