"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KEYS, readLocal, uid, useLocalState } from "@/lib/storage";
import {
  CalendarInfo,
  DEFAULT_CALENDARS,
  EventItem,
  LegacyScheduleItem,
} from "@/lib/types";
import {
  addDays,
  formatKoreanDate,
  fromDateStr,
  hhmmToMin,
  minToHHMM,
  startOfWeek,
  toDateStr,
  todayStr,
} from "@/lib/date";
import CalendarSidebar from "@/components/calendar/CalendarSidebar";
import WeekView from "@/components/calendar/WeekView";
import MonthView from "@/components/calendar/MonthView";
import EventPanel from "@/components/calendar/EventPanel";
import SelectionBar from "@/components/calendar/SelectionBar";
import ConfirmDialog from "@/components/calendar/ConfirmDialog";

type ViewMode = "month" | "week";

/** 확인 모달을 기다리는 삭제 요청 */
type PendingDelete =
  | { kind: "events"; ids: string[] }
  | { kind: "calendar"; id: string };

export default function CalendarApp() {
  const [calendars, setCalendars, calLoaded] = useLocalState<CalendarInfo[]>(
    KEYS.calendars,
    DEFAULT_CALENDARS,
  );
  const [events, setEvents, evLoaded] = useLocalState<EventItem[]>(
    KEYS.events,
    [],
  );
  const [view, setView] = useState<ViewMode>("week");
  const [focus, setFocus] = useState(() => todayStr());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [justCreated, setJustCreated] = useState(false);

  // localStorage 로드 완료 여부 = 마운트 완료 여부 (하이드레이션 불일치 방지)
  const mounted = evLoaded && calLoaded;

  // v1 스케줄 데이터 1회 마이그레이션 — localStorage(외부 시스템)에서 읽어오는 의도된 패턴
  useEffect(() => {
    if (!evLoaded || !calLoaded) return;
    if (localStorage.getItem("ft.migratedV2")) return;
    const legacy = readLocal<LegacyScheduleItem[]>(KEYS.schedules, []);
    if (legacy.length > 0 && events.length === 0) {
      const typeMap: Record<string, string> = {
        study: "cal-study",
        personal: "cal-personal",
        available: "cal-avail",
      };
      setEvents(
        legacy.map((s) => {
          const start = hhmmToMin(s.startTime);
          return {
            id: s.id,
            calendarId: typeMap[s.type] ?? "cal-personal",
            title: s.title,
            date: s.date,
            startMin: start,
            endMin: s.endTime
              ? Math.max(start + 15, hhmmToMin(s.endTime))
              : Math.min(24 * 60, start + 60),
            memo: s.memo,
            notify: s.notify,
            notifyMinutesBefore: s.notifyMinutesBefore,
          };
        }),
      );
    }
    localStorage.setItem("ft.migratedV2", "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evLoaded, calLoaded]);

  const calendarMap = useMemo(
    () => new Map(calendars.map((c) => [c.id, c])),
    [calendars],
  );
  const visibleEvents = useMemo(
    () => events.filter((e) => calendarMap.get(e.calendarId)?.visible !== false),
    [events, calendarMap],
  );

  const focusDate = fromDateStr(focus);
  const weekDays = useMemo(() => {
    const start = startOfWeek(focusDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const selected = events.find((e) => e.id === selectedId) ?? null;

  // ── 다중 선택 (우클릭) ──
  // 현재 보기에 실제로 그려지는 일정들 — "전체 선택"의 대상
  const viewEvents = useMemo(() => {
    if (view === "week") {
      const inWeek = new Set(weekDays.map(toDateStr));
      return visibleEvents.filter((e) => inWeek.has(e.date));
    }
    const ym = focus.slice(0, 7); // YYYY-MM
    return visibleEvents.filter((e) => e.date.slice(0, 7) === ym);
  }, [view, weekDays, visibleEvents, focus]);

  // 개별 삭제로 사라진 id가 남아 있어도 안전하도록 실제 일정과 교집합을 취한다
  const checkedEvents = useMemo(
    () => visibleEvents.filter((e) => checkedIds.has(e.id)),
    [visibleEvents, checkedIds],
  );
  const checkedCount = checkedEvents.length;

  const toggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearChecks = useCallback(() => setCheckedIds(new Set()), []);

  const selectAllInView = useCallback(() => {
    setCheckedIds(new Set(viewEvents.map((e) => e.id)));
  }, [viewEvents]);

  // 삭제는 전부 확인 모달을 거친다 (2차 검증)
  const requestDeleteChecked = useCallback(() => {
    if (checkedEvents.length === 0) return;
    setPendingDelete({ kind: "events", ids: checkedEvents.map((e) => e.id) });
  }, [checkedEvents]);

  // ── CRUD ──
  const createEvent = useCallback(
    (date: string, startMin = 9 * 60, endMin = 10 * 60) => {
      const firstVisible =
        calendars.find((c) => c.visible) ?? calendars[0];
      if (!firstVisible) return;
      const ev: EventItem = {
        id: uid(),
        calendarId: firstVisible.id,
        title: "",
        date,
        startMin,
        endMin,
        notify: false,
        notifyMinutesBefore: 10,
      };
      setEvents((prev) => [...prev, ev]);
      setSelectedId(ev.id);
      setJustCreated(true);
    },
    [calendars, setEvents],
  );

  const updateEvent = useCallback(
    (id: string, patch: Partial<EventItem>) => {
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      );
    },
    [setEvents],
  );

  const requestDeleteEvent = useCallback((id: string) => {
    setPendingDelete({ kind: "events", ids: [id] });
  }, []);

  const requestDeleteCalendar = useCallback((id: string) => {
    setPendingDelete({ kind: "calendar", id });
  }, []);

  /** 확인 모달에서 "삭제"를 누른 뒤 실제로 지우는 단계 */
  const commitDelete = useCallback(() => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "events") {
      const ids = new Set(pendingDelete.ids);
      setEvents((prev) => prev.filter((e) => !ids.has(e.id)));
      setSelectedId((cur) => (cur && ids.has(cur) ? null : cur));
      setCheckedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    } else {
      const calId = pendingDelete.id;
      setCalendars((prev) => prev.filter((c) => c.id !== calId));
      setEvents((prev) => prev.filter((e) => e.calendarId !== calId));
      setSelectedId((cur) =>
        cur && events.find((e) => e.id === cur)?.calendarId === calId
          ? null
          : cur,
      );
    }
    setPendingDelete(null);
  }, [pendingDelete, events, setCalendars, setEvents]);

  const selectEvent = useCallback((id: string) => {
    setSelectedId(id);
    setJustCreated(false);
  }, []);

  // ── 네비게이션 ──
  const goToday = useCallback(() => setFocus(todayStr()), []);
  const moveFocus = useCallback(
    (dir: 1 | -1) => {
      setFocus((cur) => {
        const d = fromDateStr(cur);
        if (view === "week") return toDateStr(addDays(d, dir * 7));
        const m = new Date(d.getFullYear(), d.getMonth() + dir, 1);
        return toDateStr(m);
      });
    },
    [view],
  );

  // 키보드 단축키: T=오늘, M=월, W=주, ←/→=이동, Delete=선택 삭제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // 확인 모달이 열려 있으면 모달이 키 입력을 전담한다
      if (pendingDelete) return;
      switch (e.key.toLowerCase()) {
        case "delete":
        case "backspace":
          if (checkedCount > 0) {
            e.preventDefault(); // Backspace 뒤로가기 방지
            requestDeleteChecked();
          }
          break;
        case "t":
          goToday();
          break;
        case "m":
          setView("month");
          break;
        case "w":
          setView("week");
          break;
        case "arrowleft":
          moveFocus(-1);
          break;
        case "arrowright":
          moveFocus(1);
          break;
        case "escape":
          // 다중 선택이 있으면 그것부터 해제
          if (checkedCount > 0) clearChecks();
          else setSelectedId(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    goToday,
    moveFocus,
    checkedCount,
    requestDeleteChecked,
    clearChecks,
    pendingDelete,
  ]);

  const headerTitle =
    view === "month"
      ? `${focusDate.getFullYear()}년 ${focusDate.getMonth() + 1}월`
      : (() => {
          const s = weekDays[0];
          const e = weekDays[6];
          const sm = s.getMonth() + 1;
          const em = e.getMonth() + 1;
          return sm === em
            ? `${s.getFullYear()}년 ${sm}월`
            : `${s.getFullYear()}년 ${sm}월 – ${em}월`;
        })();

  // 확인 모달에 띄울 내용 — 무엇이 지워지는지 목록으로 보여준다
  const confirmProps = (() => {
    if (!pendingDelete) return null;
    if (pendingDelete.kind === "events") {
      const targets = pendingDelete.ids
        .map((id) => events.find((e) => e.id === id))
        .filter((e): e is EventItem => Boolean(e));
      if (targets.length === 0) return null;
      return {
        title:
          targets.length === 1
            ? "이 일정을 삭제할까요?"
            : `일정 ${targets.length}개를 삭제할까요?`,
        message: "삭제하면 되돌릴 수 없습니다. 목록을 확인해 주세요.",
        items: targets.map(
          (e) =>
            `${formatKoreanDate(e.date)} ${minToHHMM(e.startMin)} · ${
              e.title || "(제목 없음)"
            }`,
        ),
        confirmLabel:
          targets.length === 1 ? "삭제" : `${targets.length}개 삭제`,
      };
    }
    const cal = calendars.find((c) => c.id === pendingDelete.id);
    if (!cal) return null;
    const inCal = events.filter((e) => e.calendarId === cal.id);
    return {
      title: `캘린더 "${cal.name}"을 삭제할까요?`,
      message:
        inCal.length > 0
          ? `이 캘린더에 속한 일정 ${inCal.length}개도 함께 삭제됩니다. 되돌릴 수 없습니다.`
          : "이 캘린더에는 일정이 없습니다. 되돌릴 수 없습니다.",
      items: inCal.map(
        (e) =>
          `${formatKoreanDate(e.date)} ${minToHHMM(e.startMin)} · ${
            e.title || "(제목 없음)"
          }`,
      ),
      confirmLabel:
        inCal.length > 0 ? `캘린더 + ${inCal.length}개 삭제` : "캘린더 삭제",
    };
  })();

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-400">
        캘린더 불러오는 중...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <CalendarSidebar
        focus={focus}
        onPick={(d) => setFocus(d)}
        calendars={calendars}
        setCalendars={setCalendars}
        events={events}
        onDeleteCalendar={requestDeleteCalendar}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 헤더 */}
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
          <h1 className="min-w-36 text-lg font-bold">{headerTitle}</h1>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => moveFocus(-1)}
              className="rounded-lg px-2.5 py-1 text-gray-500 hover:bg-gray-100"
              aria-label={view === "week" ? "이전 주" : "이전 달"}
            >
              ‹
            </button>
            <button
              onClick={goToday}
              className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-gray-50"
            >
              오늘
            </button>
            <button
              onClick={() => moveFocus(1)}
              className="rounded-lg px-2.5 py-1 text-gray-500 hover:bg-gray-100"
              aria-label={view === "week" ? "다음 주" : "다음 달"}
            >
              ›
            </button>
          </div>

          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            <button
              onClick={() => setView("month")}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                view === "month" ? "bg-primary-soft text-primary" : "text-gray-500"
              }`}
            >
              월
            </button>
            <button
              onClick={() => setView("week")}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                view === "week" ? "bg-primary-soft text-primary" : "text-gray-500"
              }`}
            >
              주
            </button>
          </div>

          <span className="hidden text-[10px] text-gray-300 lg:block">
            T 오늘 · M 월 · W 주 · ←→ 이동 · 우클릭 다중 선택
          </span>

          <div className="flex-1" />

          <button
            onClick={() => createEvent(focus)}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            + 새 일정
          </button>
        </header>

        {/* 본문 */}
        {view === "week" ? (
          <WeekView
            days={weekDays}
            events={visibleEvents}
            calendarMap={calendarMap}
            selectedId={selectedId}
            checkedIds={checkedIds}
            onCreate={(date, s, e) => createEvent(date, s, e)}
            onUpdate={updateEvent}
            onSelect={selectEvent}
            onToggleCheck={toggleCheck}
          />
        ) : (
          <MonthView
            year={focusDate.getFullYear()}
            month={focusDate.getMonth()}
            events={visibleEvents}
            calendarMap={calendarMap}
            selectedId={selectedId}
            checkedIds={checkedIds}
            onCreate={(date) => createEvent(date)}
            onMove={(id, date) => updateEvent(id, { date })}
            onSelect={selectEvent}
            onToggleCheck={toggleCheck}
          />
        )}
      </div>

      {selected && (
        <EventPanel
          event={selected}
          calendars={calendars}
          autoFocusTitle={justCreated}
          onChange={(patch) => updateEvent(selected.id, patch)}
          onDelete={() => requestDeleteEvent(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}

      <SelectionBar
        count={checkedCount}
        totalInView={viewEvents.length}
        onSelectAll={selectAllInView}
        onClear={clearChecks}
        onDelete={requestDeleteChecked}
      />

      {confirmProps && (
        <ConfirmDialog
          {...confirmProps}
          onConfirm={commitDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
