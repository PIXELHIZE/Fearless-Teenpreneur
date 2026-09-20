"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, Check, CircleAlert, CircleHelp, Mars, Moon, NonBinary, Plus, Sparkles, Sunrise, Sunset, Venus, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MotionButton } from "@/components/system/motion-button";
import { Logo } from "@/components/system/logo";
import { completeOnboarding, type OnboardingResult } from "@/lib/actions/onboarding";
import { WEEKDAYS_KO, minToHHMM, hhmmToMin } from "@/lib/time";
import { motion, reducedMotion } from "@/lib/motion";

gsap.registerPlugin(useGSAP);

interface Slot {
  weekday: number;
  start: number;
  end: number;
}

const STEPS = ["이름", "성별", "나이", "공부 시간", "목표", "분석"] as const;
const GENDERS = [
  { value: "female", label: "여성", icon: Venus, tone: "coral" },
  { value: "male", label: "남성", icon: Mars, tone: "brand" },
  { value: "other", label: "기타", icon: NonBinary, tone: "grape" },
  { value: "skip", label: "밝히지 않음", icon: CircleHelp, tone: "ink" },
] as const;

/** 공부 시간대 프리셋. 누르면 시작·종료가 채워진다. */
const TIME_PRESETS = [
  { label: "아침", range: "06:30–08:00", start: "06:30", end: "08:00", icon: Sunrise },
  { label: "방과 후", range: "16:00–18:00", start: "16:00", end: "18:00", icon: Sunset },
  { label: "저녁", range: "19:00–21:00", start: "19:00", end: "21:00", icon: Moon },
  { label: "늦은 밤", range: "21:00–23:00", start: "21:00", end: "23:00", icon: Moon },
];

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [result, setResult] = useState<OnboardingResult | null>(null);

  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [sheetDay, setSheetDay] = useState<number | null>(null);
  const [draftDays, setDraftDays] = useState<number[]>([]);
  const [draftStart, setDraftStart] = useState("19:00");
  const [draftEnd, setDraftEnd] = useState("21:00");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalSubject, setGoalSubject] = useState("");
  const [goalLevel, setGoalLevel] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalDetail, setGoalDetail] = useState("");

  const scope = useRef<HTMLDivElement>(null);

  // 단계가 바뀔 때마다 내용이 부드럽게 올라온다.
  useGSAP(
    () => {
      if (reducedMotion()) return;
      gsap.fromTo(
        scope.current?.querySelectorAll("[data-reveal]") ?? [],
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: motion.reveal, stagger: motion.stagger, ease: motion.ease, clearProps: "all" },
      );
    },
    { scope, dependencies: [step], revertOnUpdate: true },
  );

  const canGoNext = useMemo(() => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return gender.length > 0;
    if (step === 2) return /^\d{4}$/.test(birthYear);
    if (step === 3) return slots.length > 0;
    if (step === 4) return goalTitle.trim().length > 0;
    return true;
  }, [step, name, gender, birthYear, slots, goalTitle]);

  const openDay = (weekday: number) => {
    setError("");
    setSheetDay(weekday);
    setDraftDays([weekday]);
  };

  const addSlot = () => {
    const start = hhmmToMin(draftStart);
    const end = hhmmToMin(draftEnd);
    if (end - start < 30) {
      setError("30분 이상으로 잡아 주세요.");
      return;
    }
    if (!draftDays.length) {
      setError("요일을 하나 이상 골라 주세요.");
      return;
    }
    setError("");
    setSlots((prev) => {
      const next = [...prev];
      for (const weekday of draftDays) {
        // 같은 요일에 겹치는 시간이 있으면 합친다
        const overlapping = next.filter((slot) => slot.weekday === weekday && slot.start < end && start < slot.end);
        const merged = {
          weekday,
          start: Math.min(start, ...overlapping.map((slot) => slot.start)),
          end: Math.max(end, ...overlapping.map((slot) => slot.end)),
        };
        for (const slot of overlapping) next.splice(next.indexOf(slot), 1);
        next.push(merged);
      }
      return next.sort((a, b) => a.weekday - b.weekday || a.start - b.start);
    });
    setSheetDay(null);
  };

  /** 처음이면 평일 저녁으로 한 번에 시작 */
  const quickStart = () => {
    setError("");
    setSlots([1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: 19 * 60, end: 21 * 60 })));
  };

  const weeklyMinutes = slots.reduce((sum, slot) => sum + (slot.end - slot.start), 0);
  const studyDays = new Set(slots.map((slot) => slot.weekday)).size;

  const submit = () => {
    setError("");
    setStep(5);
    startTransition(async () => {
      const response = await completeOnboarding({
        name,
        gender,
        birthYear: Number(birthYear) || null,
        slots,
        goal: {
          title: goalTitle,
          subject: goalSubject,
          level: goalLevel,
          targetDate: goalDate,
          detail: goalDetail,
        },
      });
      if (!response.ok) {
        setError(response.error ?? "잠시 후 다시 시도해 주세요.");
        setStep(4);
        return;
      }
      setResult(response);
    });
  };

  return (
    <div className="onboard">
      <div className="onboard-progress" aria-hidden>
        <span style={{ transform: `scaleX(${(step + (result ? 1 : 0)) / STEPS.length})` }} />
      </div>

      <div className="app-frame onboard-top">
        {step > 0 && step < 5 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="text-button">
            <ArrowLeft size={16} aria-hidden /> 이전
          </button>
        ) : (
          <Logo variant="symbol" style={{ height: 26 }} />
        )}
        <span className="onboard-step-label">
          {String(Math.min(step + 1, STEPS.length)).padStart(2, "0")} / {STEPS.length}
        </span>
      </div>

      <div ref={scope} className="onboard-body app-frame">
        {step === 0 ? (
          <>
            <div data-reveal>
              <span className="onboard-step-label">STEP 01</span>
              <h2>
                먼저 이름을
                <br />
                알려 주세요
              </h2>
              <p>수업에서 부를 이름이에요. 본명이 아니어도 괜찮아요.</p>
            </div>
            <div className="field" data-reveal>
              <label htmlFor="name">이름</label>
              <input
                id="name"
                className="input-lg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예) 지우"
                autoFocus
              />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div data-reveal>
              <span className="onboard-step-label">STEP 02</span>
              <h2>성별을 골라 주세요</h2>
              <p>말투와 예시를 고르는 데만 씁니다.</p>
            </div>
            <div className="pick-grid" data-reveal>
              {GENDERS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className="pick-card"
                    data-tone={item.tone}
                    aria-pressed={gender === item.value}
                    onClick={() => setGender(item.value)}
                  >
                    <span className="pick-icon" aria-hidden>
                      <Icon size={26} />
                    </span>
                    <strong>{item.label}</strong>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div data-reveal>
              <span className="onboard-step-label">STEP 03</span>
              <h2>몇 년생인가요</h2>
              <p>수준에 맞는 설명과 예시를 고르는 데 씁니다.</p>
            </div>
            <div className="field" data-reveal>
              <label htmlFor="birth">태어난 해</label>
              <input
                id="birth"
                className="input-lg tnum"
                inputMode="numeric"
                maxLength={4}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="2009"
                autoFocus
              />
              {birthYear.length === 4 ? (
                <span className="field-hint">만 {new Date().getFullYear() - Number(birthYear)}세 정도네요.</span>
              ) : null}
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div data-reveal>
              <span className="onboard-step-label">STEP 04</span>
              <h2>
                언제 공부할 수
                <br />
                있나요
              </h2>
              <p>요일마다 공부할 수 있는 시간을 넣어 주세요. 이 시간 안에서만 수업이 잡혀요.</p>
            </div>

            <div className="stack" data-reveal>
              {slots.length ? (
                <div className="row-between">
                  <span className="pill" data-tone="ok">
                    주 {studyDays}일 · {Math.round((weeklyMinutes / 60) * 10) / 10}시간
                  </span>
                  <button type="button" className="text-button" onClick={() => setSlots([])}>
                    모두 지우기
                  </button>
                </div>
              ) : (
                <button type="button" className="quick-start" onClick={quickStart}>
                  <span className="icon-tile" data-tone="ok" aria-hidden>
                    <Moon size={20} />
                  </span>
                  <span style={{ flex: 1, textAlign: "start" }}>
                    <strong>평일 저녁 19:00–21:00 으로 시작</strong>
                    <small>한 번에 채우고 요일마다 다듬을 수 있어요</small>
                  </span>
                  <Plus size={18} aria-hidden />
                </button>
              )}

              <div className="day-list">
                {WEEKDAYS_KO.map((label, weekday) => {
                  const daySlots = slots.filter((slot) => slot.weekday === weekday);
                  return (
                    <div key={label} className="day-row" data-on={daySlots.length ? "true" : undefined}>
                      <span className="day-badge" data-sun={weekday === 0 ? "true" : undefined}>
                        {label}
                      </span>
                      <div className="day-ranges">
                        {daySlots.length ? (
                          daySlots.map((slot) => (
                            <button
                              key={`${slot.start}-${slot.end}`}
                              type="button"
                              className="range-chip tnum"
                              onClick={() => setSlots((prev) => prev.filter((item) => item !== slot))}
                              aria-label={`${label} ${minToHHMM(slot.start)}–${minToHHMM(slot.end)} 지우기`}
                            >
                              {minToHHMM(slot.start)}–{minToHHMM(slot.end)}
                              <X size={12} aria-hidden />
                            </button>
                          ))
                        ) : (
                          <span className="day-empty">쉬는 날</span>
                        )}
                      </div>
                      <button type="button" className="day-add" onClick={() => openDay(weekday)} aria-label={`${label}요일 시간 추가`}>
                        <Plus size={18} aria-hidden />
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="field-hint">시간 칩을 누르면 지워져요. 나중에 스케줄 탭에서도 바꿀 수 있어요.</p>
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <div data-reveal>
              <span className="onboard-step-label">STEP 05</span>
              <h2>
                무엇을 이루고
                <br />
                싶나요
              </h2>
              <p>구체적일수록 커리큘럼이 정확해져요.</p>
            </div>

            <div className="stack" data-reveal>
              <div className="field">
                <label htmlFor="goal">목표</label>
                <input
                  id="goal"
                  className="input-lg"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="예) 2학기 중간고사 수학 90점"
                />
              </div>
              <div className="field-pair">
                <div className="field">
                  <label htmlFor="subject">과목</label>
                  <input id="subject" className="input-lg" value={goalSubject} onChange={(e) => setGoalSubject(e.target.value)} placeholder="수학" />
                </div>
                <div className="field">
                  <label htmlFor="date">목표 시점</label>
                  <input id="date" type="date" className="input-lg tnum" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="level">지금 수준</label>
                <input
                  id="level"
                  className="input-lg"
                  value={goalLevel}
                  onChange={(e) => setGoalLevel(e.target.value)}
                  placeholder="예) 이차함수까지는 알지만 도형에서 막혀요"
                />
              </div>
              <div className="field">
                <label htmlFor="detail">더 알려 주고 싶은 것</label>
                <textarea
                  id="detail"
                  className="input-lg"
                  value={goalDetail}
                  onChange={(e) => setGoalDetail(e.target.value)}
                  placeholder="자신 없는 단원, 시험 범위, 쓰는 교재 같은 걸 적어 주세요."
                />
              </div>
            </div>
          </>
        ) : null}

        {step === 5 ? <AnalysisStep result={result} pending={pending} name={name} onEnter={() => router.push("/home")} /> : null}

        {error && step !== 5 && step !== 3 ? (
          <p className="field-error" role="alert" data-reveal>
            <CircleAlert size={16} aria-hidden />
            {error}
          </p>
        ) : null}
      </div>

      <Sheet open={sheetDay !== null} onOpenChange={(open) => !open && setSheetDay(null)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{sheetDay !== null ? `${WEEKDAYS_KO[sheetDay]}요일에 언제 공부할까요?` : "시간 추가"}</SheetTitle>
            <SheetDescription>시간대를 고르거나 직접 정해 주세요. 30분 이상이어야 해요.</SheetDescription>
          </SheetHeader>

          <div className="stack">
            <div className="preset-row">
              {TIME_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const active = draftStart === preset.start && draftEnd === preset.end;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className="preset-chip"
                    aria-pressed={active}
                    onClick={() => {
                      setDraftStart(preset.start);
                      setDraftEnd(preset.end);
                    }}
                  >
                    <Icon size={16} aria-hidden />
                    <span>
                      <strong>{preset.label}</strong>
                      <small className="tnum">{preset.range}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="field-pair">
              <div className="field">
                <label htmlFor="start">시작</label>
                <input id="start" type="time" step={1800} className="input-lg tnum" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="end">종료</label>
                <input id="end" type="time" step={1800} className="input-lg tnum" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} />
              </div>
            </div>

            <div className="field">
              <label>다른 요일에도 같이 넣기</label>
              <div className="weekday-grid">
                {WEEKDAYS_KO.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    className="choice-chip"
                    data-sun={index === 0 ? "true" : undefined}
                    aria-pressed={draftDays.includes(index)}
                    onClick={() =>
                      setDraftDays((prev) => (prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index].sort()))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {error ? (
              <p className="field-error" role="alert">
                <CircleAlert size={16} aria-hidden />
                {error}
              </p>
            ) : null}

            <MotionButton type="button" variant="ok" size="lg" onClick={addSlot}>
              <Plus size={16} aria-hidden /> {draftDays.map((d) => WEEKDAYS_KO[d]).join("·") || "요일"} {draftStart}–{draftEnd} 추가
            </MotionButton>
          </div>
        </SheetContent>
      </Sheet>

      {step < 5 ? (
        <div className="app-frame onboard-actions">
          <MotionButton
            type="button"
            variant="brand"
            size="lg"
            disabled={!canGoNext}
            onClick={() => (step === 4 ? submit() : setStep((s) => s + 1))}
          >
            {step === 4 ? (
              <>
                <Sparkles size={18} aria-hidden /> 분석하고 시작하기
              </>
            ) : (
              "다음"
            )}
          </MotionButton>
        </div>
      ) : null}
    </div>
  );
}

function AnalysisStep({
  result,
  pending,
  name,
  onEnter,
}: {
  result: OnboardingResult | null;
  pending: boolean;
  name: string;
  onEnter: () => void;
}) {
  const lines = [
    "목표를 읽고 있어요",
    "지금 수준과의 거리를 재고 있어요",
    "단원 순서를 정하고 있어요",
    "공부 가능한 시간에 수업을 넣고 있어요",
  ];

  const [doneCount, setDoneCount] = useState(0);
  useEffect(() => {
    if (!pending && result) return;
    const timer = setInterval(() => setDoneCount((n) => Math.min(lines.length - 1, n + 1)), 2200);
    return () => clearInterval(timer);
  }, [pending, result, lines.length]);

  if (pending || !result) {
    return (
      <div className="stack-lg" data-reveal>
        <div>
          <span className="onboard-step-label">ANALYZING</span>
          <h2>
            {name || "학생"}님만의
            <br />
            계획을 짜고 있어요
          </h2>
        </div>
        <ul className="check-list">
          {lines.map((line, index) => (
            <li key={line} data-done={index < doneCount ? "true" : undefined}>
              <span className="ball" aria-hidden>
                {index < doneCount ? <Check size={14} /> : index === doneCount ? <span className="typing"><i /><i /><i /></span> : null}
              </span>
              <span style={{ color: index <= doneCount ? "var(--foreground)" : "var(--muted-foreground)" }}>{line}</span>
            </li>
          ))}
        </ul>
        <div className="stack" style={{ gap: 8 }}>
          <div className="skeleton-line" style={{ width: "92%" }} />
          <div className="skeleton-line" style={{ width: "74%" }} />
          <div className="skeleton-line" style={{ width: "83%" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="stack-lg" data-reveal>
      <div>
        <span className="onboard-step-label">READY</span>
        <h2>계획이 준비됐어요</h2>
        {result.summary ? <p>{result.summary}</p> : null}
      </div>

      <div className="stat-grid">
        <div className="stat-tile" data-tone="grape">
          <span className="label">설계한 단원</span>
          <span className="value">
            {result.unitCount}
            <span className="unit">개</span>
          </span>
        </div>
        <div className="stat-tile" data-tone="ok">
          <span className="label">잡아 둔 수업</span>
          <span className="value">
            {result.lessonCount}
            <span className="unit">회</span>
          </span>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 14, lineHeight: 1.75 }}>
        공부하면서 계획은 계속 바뀝니다. 수업이 끝나면 자동으로 분석해서 다음 날 커리큘럼부터 손볼게요.
      </p>

      <MotionButton type="button" variant="ok" size="lg" onClick={onEnter}>
        <Check size={18} aria-hidden /> 시작하기
      </MotionButton>
    </div>
  );
}
