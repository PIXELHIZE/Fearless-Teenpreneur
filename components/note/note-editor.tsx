"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { MathText } from "@/components/app/math-text";
import { useRouter } from "next/navigation";
import {
  DefaultToolbar,
  DefaultToolbarContent,
  react,
  Tldraw,
  TldrawUiMenuItem,
  useEditor,
  useIsToolSelected,
  useTools,
  type Editor,
  type TLComponents,
  type TLUiOverrides,
} from "tldraw";
import "tldraw/tldraw.css";
import { ChevronLeft, CircleAlert, RotateCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionButton } from "@/components/system/motion-button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { attachAiPen, getAiPen, type AiPin } from "@/lib/note/ai-pen-controller";
import { AiPenTool } from "@/lib/note/ai-pen-tool";
import { AiPenOverlay } from "./ai-pen-overlay";
import { placeExamSheet } from "@/lib/note/exam-sheet";
import { captureNotePages } from "@/lib/note/capture";
import { renameNote, savePins, submitExam, type NoteRow, type SubmitResult } from "@/lib/actions/note";

/** 올가미 + 반짝임 — AI 펜 전용 아이콘 */
const AiPenIcon = (
  <div className="ai-pen-icon">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 4.2c4.3 0 7.8 2.3 7.8 5.2 0 2.9-3.5 5.2-7.8 5.2-1.2 0-2.4-.2-3.4-.5-.9.9-2.3 1.7-3.6 2 .5-.8.9-1.8 1-2.7-1.1-1-1.8-2.2-1.8-3.5C4.2 6.5 7.7 4.2 12 4.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeDasharray="3 2.4"
      />
      <path d="M17.4 15.1l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" fill="currentColor" />
    </svg>
  </div>
);

const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools["ai-pen"] = {
      id: "ai-pen",
      icon: AiPenIcon,
      label: "AI 펜",
      kbd: "a",
      onSelect: () => editor.setCurrentTool("ai-pen"),
    };
    return tools;
  },
};

function NoteToolbar() {
  const tools = useTools();
  const aiPen = tools["ai-pen"];
  const isSelected = useIsToolSelected(aiPen);
  return (
    <DefaultToolbar>
      <TldrawUiMenuItem {...aiPen} isSelected={isSelected} />
      <DefaultToolbarContent />
    </DefaultToolbar>
  );
}

function KeyboardGlue() {
  const editor = useEditor();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      getAiPen(editor)?.closePin();
      getAiPen(editor)?.disarmPin();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor]);
  return null;
}

/** 종이 결이 내용과 함께 움직이고 확대되도록 카메라를 직접 읽는다. */
function makePaper(paper: string) {
  return function Paper() {
    const editor = useEditor();
    const camera = editor.getCamera();
    if (paper === "plain") return <div className="note-paper" />;
    const size = 38 * camera.z;
    return (
      <div className="note-paper">
        <div
          className="note-paper-pattern"
          data-paper={paper}
          style={{
            opacity: Math.max(0, Math.min(1, (camera.z - 0.28) * 3)),
            backgroundSize: paper === "ruled" ? `100% ${size}px` : `${size}px ${size}px`,
            backgroundPosition: `${camera.x * camera.z}px ${camera.y * camera.z}px`,
            ["--line-w" as string]: `${Math.max(1, camera.z)}px`,
            ["--dot-w" as string]: `${Math.max(1.5, 2 * camera.z)}px`,
          }}
        />
      </div>
    );
  };
}

export function NoteEditor({ note }: { note: NoteRow }) {
  const router = useRouter();
  const editorRef = useRef<Editor | null>(null);
  const [title, setTitle] = useState(note.title);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");

  const components = useMemo<TLComponents>(
    () => ({
      Background: makePaper(note.paper),
      InFrontOfTheCanvas: AiPenOverlay,
      Toolbar: NoteToolbar,
      DebugPanel: null,
      DebugMenu: null,
    }),
    [note.paper],
  );

  const tools = useMemo(() => [AiPenTool], []);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      attachAiPen(editor, note.id, note.pins as AiPin[], (pins) => {
        void savePins(note.id, pins);
      });
      editor.user.updateUserPreferences({ colorScheme: "light" });
      editor.setCurrentTool("draw");

      // 시험지 노트를 처음 열면 문제를 이미지로 깔아 둔다.
      if (note.kind !== "blank" && note.exam.length && editor.getCurrentPageShapeIds().size === 0) {
        void placeExamSheet(editor, note.exam, note.title);
      }

      const stopTracking = react("remember previous tool", () => {
        getAiPen(editor)?.rememberPreviousTool(editor.getCurrentToolId());
      });

      // 캔버스를 건드리면 열려 있던 메모를 접는다.
      const container = editor.getContainer();
      const onPointerDownCapture = (event: PointerEvent) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest(".ai-card-layer") || target?.closest(".ai-pin-wrap")) return;
        getAiPen(editor)?.closePin();
        getAiPen(editor)?.disarmPin();
      };
      container.addEventListener("pointerdown", onPointerDownCapture, true);

      return () => {
        stopTracking();
        container.removeEventListener("pointerdown", onPointerDownCapture, true);
      };
    },
    [note.id, note.kind, note.exam, note.title, note.pins],
  );

  const submit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setError("");
    startTransition(async () => {
      const pages = await captureNotePages(editor);
      // 시험지 이미지 말고 학생이 그린 것이 하나라도 있어야 한다.
      const written = editor.getCurrentPageShapes().some((shape) => !shape.isLocked);
      if (!pages.length || !written) {
        setError("아직 쓴 답이 없어요. 펜으로 답을 쓴 뒤 채점받아 주세요.");
        return;
      }
      const response = await submitExam(note.id, pages.map((page) => page.base64));
      if (!response.ok) {
        setError(response.error ?? "채점에 실패했어요.");
        return;
      }
      setResult(response);
    });
  };

  return (
    <div className="note-shell">
      <header className="note-bar">
        <Button variant="ghost" size="icon" aria-label="나가기" onClick={() => router.back()}>
          <ChevronLeft aria-hidden />
        </Button>

        <input
          className="note-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void renameNote(note.id, title)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          aria-label="노트 제목"
        />

        {note.kind !== "blank" ? (
          note.submitted_at && note.result ? (
            <>
              <Button variant="ghost" size="icon" aria-label="다시 채점받기" title="다시 채점받기" onClick={submit} disabled={pending}>
                <RotateCw aria-hidden />
              </Button>
              <MotionButton variant="ok" onClick={() => setResult(note.result)}>
                <Send size={16} aria-hidden /> 결과 보기
              </MotionButton>
            </>
          ) : (
            <MotionButton variant="brand" loading={pending} onClick={submit}>
              <Send size={16} aria-hidden /> {pending ? "채점 중" : "채점받기"}
            </MotionButton>
          )
        ) : null}
      </header>

      {error ? (
        <p className="note-error" role="alert">
          <CircleAlert size={15} aria-hidden />
          {error}
        </p>
      ) : null}

      <div className="note-canvas">
        <Tldraw
          persistenceKey={`teum-note-${note.id}`}
          tools={tools}
          components={components}
          overrides={uiOverrides}
          onMount={handleMount}
        >
          <KeyboardGlue />
        </Tldraw>
      </div>

      <Sheet open={Boolean(result)} onOpenChange={(open) => !open && setResult(null)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>채점을 마쳤어요</SheetTitle>
            <SheetDescription>{result?.overall}</SheetDescription>
          </SheetHeader>

          {result ? (
            <div className="stack" style={{ marginTop: 16 }}>
              <div className="stat-grid">
                <div className="stat-tile">
                  <span className="label">받은 점수</span>
                  <span className="value">
                    {result.score}
                    <span className="unit">/ {result.total}점</span>
                  </span>
                </div>
                <div className="stat-tile">
                  <span className="label">맞힌 문항</span>
                  <span className="value">
                    {result.items?.filter((item) => item.correct).length ?? 0}
                    <span className="unit">/ {result.items?.length ?? 0}</span>
                  </span>
                </div>
              </div>

              {result.overall || result.advice ? (
                <div className="card-muted stack" style={{ gap: 10 }}>
                  {result.strengths?.length ? (
                    <div>
                      <span className="pill" data-tone="ok">잘한 점</span>
                      <ul className="ai-list" style={{ marginTop: 8 }}>
                        {result.strengths.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {result.weaknesses?.length ? (
                    <div>
                      <span className="pill" data-tone="coral">보충할 점</span>
                      <ul className="ai-list" style={{ marginTop: 8 }}>
                        {result.weaknesses.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {result.advice ? <p style={{ fontSize: 14, lineHeight: 1.75 }}>{result.advice}</p> : null}
                </div>
              ) : null}

              <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 10 }}>
                {result.items?.map((item) => (
                  <li key={item.number} className="card-muted stack" style={{ gap: 6, padding: 14 }}>
                    <div className="row-between">
                      <strong style={{ fontSize: 13 }}>
                        {item.number}번{item.read ? <span className="muted" style={{ fontWeight: 500 }}> · 내 답: {item.read}</span> : null}
                      </strong>
                      <span className="pill tnum" data-tone={item.correct ? "ok" : item.score > 0 ? "sun" : "coral"}>
                        {item.score} / {item.points}점
                      </span>
                    </div>
                    <MathText as="p" className="muted" text={item.comment} />
                  </li>
                ))}
              </ul>

              {note.lesson_id ? (
                <MotionButton variant="brand" size="lg" onClick={() => router.push(`/lesson/${note.lesson_id}`)}>
                  수업 결과 보기
                </MotionButton>
              ) : (
                <MotionButton variant="grape" size="lg" onClick={() => router.push("/me/history")}>
                  피드백 기록 보기
                </MotionButton>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
