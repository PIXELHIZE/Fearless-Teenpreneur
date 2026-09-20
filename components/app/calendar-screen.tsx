"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, CircleAlert, Clock, Lock, Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  addPersonalEvent,
  addStudyTime,
  deleteLessonAction,
  loadDay,
  loadMonth,
  removePersonalEvent,
  removeStudyTime,
  type DayData,
  type MonthData,
} from "@/lib/actions/calendar";
import { MotionButton } from "@/components/system/motion-button";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/app/page-head";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WEEKDAYS_KO, addDaysStr, hhmmToMin, minToHHMM, relativeDateLabel } from "@/lib/time";

type Mode = "study" | "busy";

/**
 * 캘린더.
 * 위는 달, 아래는 고른 날의 타임라인. 추가는 시트에서 한다.
 * 파란 점 = 수업, 초록 점 = 공부 가능, 회색 = 개인 일정.
 */
export function CalendarScreen({ today }: { today: string }) {
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState<MonthData | null>(null);
  const [day, setDay] = useState<DayData | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [sheet, setSheet] = useState<Mode | null>(null);
  const [repeat, setRepeat] = useState(true);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [start, setStart] = useState("19:00");
  const [end, setEnd] = useState("21:00");
  const [title, setTitle] = useState("");

  const [choice, setChoice] = useState<{ lessonId: string; count: number } | null>(null);
  const [confirmAll, setConfirmAll] = useState<string | null>(null);

  const refresh = () => {
    startTransition(async () => {
      const [monthData, dayData] = await Promise.all([loadMonth(anchor), loadDay(selected)]);
      setMonth(monthData);
      setDay(dayData);
    });
  };

  useEffect(refresh, [anchor, selected]);

  const shiftMonth = (delta: number) => {
    const date = new Date(`${anchor.slice(0, 7)}-01T00:00:00`);
    date.setMonth(date.getMonth() + delta);
    setAnchor(date.toISOString().slice(0, 10));
  };

  const openSheet = (mode: Mode) => {
    setError("");
    // 고른 날의 요일을 기본으로 켜 둔다.
    setWeekdays([new Date(`${selected}T00:00:00`).getDay()]);
    setRepeat(mode === "study");
    setSheet(mode);
  };

  const submit = () => {
    if (!sheet) return;
    setError("");
    const startMin = hhmmToMin(start);
    const endMin = hhmmToMin(end);
    startTransition(async () => {
      const result =
        sheet === "study"
          ? await addStudyTime({ repeat, weekdays, date: selected, start: startMin, end: endMin })
          : await addPersonalEvent({ title, repeat, weekdays, date: selected, start: startMin, end: endMin });
      if (!result.ok) {
        setError(result.error ?? "다시 시도해 주세요.");
        return;
      }
      setTitle("");
      setSheet(null);
      refresh();
    });
  };

  const removeLesson = (lessonId: string, pick?: "one" | "series") => {
    setError("");
    startTransition(async () => {
      const result = await deleteLessonAction(lessonId, pick);
      if (result.needsChoice) {
        setChoice({ lessonId, count: result.seriesCount ?? 0 });
        return;
      }
      setChoice(null);
      setConfirmAll(null);
      if (!result.ok) {
        setError(result.error ?? "지울 수 없어요.");
        return;
      }
      refresh();
    });
  };

  const cells = month?.days ?? Array.from({ length: 42 }, (_, i) => ({ date: addDaysStr(anchor, i), lessons: 0, free: false }));
  const isEmptyDay = day && !day.lessons.length && !day.availability.length && !day.busy.length;

  return (
    <>
      <main className="app-main" style={{ gap: 24 }}>
        <PageHead title="스케줄" subtitle="공부할 수 있는 시간을 알려 주세요" />
        <section className="rise stack" style={{ gap: 12 }}>
          <div className="cal-head">
            <div className="cal-month">
              <strong>{Number(anchor.slice(5, 7))}월</strong>
              <span>{anchor.slice(0, 4)}</span>
            </div>
            {anchor.slice(0, 7) !== today.slice(0, 7) || selected !== today ? (
              <button
                type="button"
                className="cal-today"
                onClick={() => {
                  setAnchor(today);
                  setSelected(today);
                }}
              >
                오늘
              </button>
            ) : null}
            <button type="button" className="cal-round" onClick={() => shiftMonth(-1)} aria-label="이전 달">
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button type="button" className="cal-round" onClick={() => shiftMonth(1)} aria-label="다음 달">
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>

          <div className="cal-grid">
            {WEEKDAYS_KO.map((label, index) => (
              <span key={label} className="cal-weekday" data-sun={index === 0 ? "true" : undefined}>
                {label}
              </span>
            ))}
            {cells.map((cell) => (
              <button
                key={cell.date}
                type="button"
                className="cal-day"
                aria-pressed={cell.date === selected}
                data-today={cell.date === today ? "true" : undefined}
                data-outside={cell.date.slice(0, 7) !== anchor.slice(0, 7) ? "true" : undefined}
                onClick={() => setSelected(cell.date)}
              >
                <span>{Number(cell.date.slice(8))}</span>
                <span className="cal-dots">
                  {Array.from({ length: Math.min(cell.lessons, 3) }).map((_, index) => (
                    <span key={index} className="cal-dot" />
                  ))}
                  {!cell.lessons && cell.free ? <span className="cal-dot" data-kind="free" /> : null}
                </span>
              </button>
            ))}
          </div>

          <div className="cal-legend">
            <span>
              <span className="cal-dot" aria-hidden /> 수업
            </span>
            <span>
              <span className="cal-dot" data-kind="free" aria-hidden /> 공부 가능
            </span>
            <span>
              <span className="cal-dot" data-kind="busy" aria-hidden /> 개인 일정
            </span>
          </div>
        </section>

        <section className="rise rise-1">
          <div className="section-title">
            <h2>{relativeDateLabel(selected, today)}</h2>
            {selected === today ? (
              <span className="pill" data-tone="sun">
                <Lock size={11} aria-hidden /> 오늘 수업은 잠김
              </span>
            ) : null}
          </div>

          {error ? (
            <p className="field-error" role="alert" style={{ marginBottom: 10 }}>
              <CircleAlert size={16} aria-hidden />
              {error}
            </p>
          ) : null}

          {!day ? (
            <div className="stack-sm">
              <div className="skeleton-block" style={{ height: 60 }} />
              <div className="skeleton-block" style={{ height: 60 }} />
            </div>
          ) : isEmptyDay ? (
            <div className="time-empty">
              <strong>비어 있는 날이에요</strong>
              <span>공부할 수 있는 시간을 알려 주면 여기에 수업이 들어와요.</span>
            </div>
          ) : (
            <div className="timeline">
              {day.lessons.map((lesson) => (
                <div key={lesson.id} className="time-item" data-kind="lesson">
                  <span className="when">
                    {minToHHMM(lesson.start_min)}–{minToHHMM(lesson.end_min)}
                  </span>
                  <span className="what">
                    {lesson.title}
                    <small>{lesson.goalTitle}</small>
                  </span>
                  {lesson.isToday ? (
                    <Lock size={15} aria-hidden style={{ flex: "none", color: "var(--muted-foreground)" }} />
                  ) : (
                    <button type="button" className="icon-button" onClick={() => removeLesson(lesson.id)} aria-label="이 수업 지우기">
                      <Trash2 size={16} aria-hidden />
                    </button>
                  )}
                </div>
              ))}

              {day.availability.map((slot) => (
                <div key={slot.id} className="time-item" data-kind="free">
                  <span className="when">
                    {minToHHMM(slot.start_min)}–{minToHHMM(slot.end_min)}
                  </span>
                  <span className="what">
                    공부 가능
                    <small>{slot.kind === "weekly" ? "매주 반복" : "이 날만"}</small>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => startTransition(async () => { await removeStudyTime(slot.id); refresh(); })}
                    aria-label="공부 가능 시간 지우기"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              ))}

              {day.busy.map((event) => (
                <div key={event.id} className="time-item" data-kind="busy">
                  <span className="when">
                    {minToHHMM(event.start_min)}–{minToHHMM(event.end_min)}
                  </span>
                  <span className="what">
                    {event.title}
                    <small>{event.kind === "weekly" ? "매주 반복" : "이 날만"}</small>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => startTransition(async () => { await removePersonalEvent(event.id); refresh(); })}
                    aria-label="일정 지우기"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rise rise-2 stack-sm">
          <MotionButton variant="ok" size="lg" onClick={() => openSheet("study")}>
            <Clock size={18} aria-hidden /> 공부 가능 시간 추가
          </MotionButton>
          <Button variant="outline" size="lg" onClick={() => openSheet("busy")}>
            <CalendarPlus size={18} aria-hidden /> 개인 일정 추가
          </Button>
        </section>
      </main>

      <Sheet open={Boolean(sheet)} onOpenChange={(open) => !open && setSheet(null)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{sheet === "study" ? "공부 가능 시간" : "개인 일정"}</SheetTitle>
            <SheetDescription>
              {sheet === "study"
                ? "이 시간 안에서만 수업이 잡혀요. 30분 이상으로 잡아 주세요."
                : "이 시간에는 수업을 넣지 않아요."}
            </SheetDescription>
          </SheetHeader>

          <div className="stack">
            {sheet === "busy" ? (
              <div className="field">
                <label htmlFor="event-title">일정 이름</label>
                <input id="event-title" className="input-lg" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 학원, 동아리" />
              </div>
            ) : null}

            <div className="segment" role="group" aria-label="반복">
              <button type="button" aria-pressed={repeat} onClick={() => setRepeat(true)}>
                매주 반복
              </button>
              <button type="button" aria-pressed={!repeat} onClick={() => setRepeat(false)}>
                {relativeDateLabel(selected, today)}만
              </button>
            </div>

            {repeat ? (
              <div className="weekday-grid">
                {WEEKDAYS_KO.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    className="choice-chip"
                    aria-pressed={weekdays.includes(index)}
                    onClick={() => setWeekdays((prev) => (prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index].sort()))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="field-pair">
              <div className="field">
                <label htmlFor="cal-start">시작</label>
                <input id="cal-start" type="time" step={1800} className="input-lg tnum" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="cal-end">종료</label>
                <input id="cal-end" type="time" step={1800} className="input-lg tnum" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>

            {error ? (
              <p className="field-error" role="alert">
                <CircleAlert size={16} aria-hidden />
                {error}
              </p>
            ) : null}

            <MotionButton variant={sheet === "study" ? "ok" : "brand"} size="lg" onClick={submit} loading={pending}>
              <Plus size={16} aria-hidden /> 추가하기
            </MotionButton>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(choice)} onOpenChange={(open) => !open && setChoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>반복되는 수업이에요</DialogTitle>
            <DialogDescription>이 수업만 지울까요, 앞으로의 반복까지 모두 지울까요?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => choice && removeLesson(choice.lessonId, "one")}>
              이 수업만
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmAll(choice?.lessonId ?? null);
                setChoice(null);
              }}
            >
              반복 전체 ({choice?.count ?? 0}개)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmAll)} onOpenChange={(open) => !open && setConfirmAll(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="row" style={{ gap: 8 }}>
              <TriangleAlert size={18} aria-hidden /> 정말 모두 지울까요?
            </DialogTitle>
            <DialogDescription>앞으로 예정된 반복 수업이 모두 사라져요. 되돌릴 수 없어요. 오늘 수업은 그대로 남습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAll(null)}>
              그대로 둘게요
            </Button>
            <Button variant="destructive" onClick={() => confirmAll && removeLesson(confirmAll, "series")}>
              모두 지우기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
