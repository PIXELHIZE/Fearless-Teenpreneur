"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import {
  addAvailability,
  addBusy,
  deleteLesson,
  deleteSeries,
  getLesson,
  listAvailability,
  listBusy,
  listLessons,
  removeAvailability,
  removeBusy,
} from "@/lib/server/repo";
import { decorateLessons, type LessonCardData } from "@/lib/server/views";
import { isPast, isToday } from "@/lib/server/policy";
import { MIN_LESSON_MINUTES, addDaysStr } from "@/lib/time";
import type { AvailabilitySlot, BusyEvent } from "@/lib/types";

export interface DayData {
  date: string;
  lessons: LessonCardData[];
  availability: AvailabilitySlot[];
  busy: BusyEvent[];
}

export interface MonthData {
  days: { date: string; lessons: number; free: boolean }[];
}

export async function loadMonth(anchor: string): Promise<MonthData> {
  const user = await requireUser();
  const start = `${anchor.slice(0, 7)}-01`;
  const end = addDaysStr(start, 41);
  const lessons = listLessons(user.id, start, end);
  const availability = listAvailability(user.id);
  const busy = listBusy(user.id);

  const days: MonthData["days"] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = addDaysStr(start, index);
    const weekday = new Date(date).getDay();
    const free = availability.some((slot) => (slot.kind === "weekly" ? slot.weekday === weekday : slot.date === date));
    days.push({ date, lessons: lessons.filter((lesson) => lesson.date === date).length, free });
  }
  void busy;
  return { days };
}

export async function loadDay(date: string): Promise<DayData> {
  const user = await requireUser();
  const weekday = new Date(date).getDay();
  return {
    date,
    lessons: decorateLessons(user.id, listLessons(user.id, date, date)),
    availability: listAvailability(user.id).filter((slot) =>
      slot.kind === "weekly" ? slot.weekday === weekday : slot.date === date,
    ),
    busy: listBusy(user.id).filter((event) => (event.kind === "weekly" ? event.weekday === weekday : event.date === date)),
  };
}

export async function addStudyTime(input: {
  repeat: boolean;
  weekdays: number[];
  date: string;
  start: number;
  end: number;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (input.end - input.start < MIN_LESSON_MINUTES) {
    return { ok: false, error: `${MIN_LESSON_MINUTES}분 이상으로 잡아 주세요.` };
  }

  if (input.repeat) {
    if (!input.weekdays.length) return { ok: false, error: "요일을 골라 주세요." };
    for (const weekday of input.weekdays) {
      addAvailability(user.id, { kind: "weekly", weekday, date: null, start_min: input.start, end_min: input.end });
    }
  } else {
    if (!input.date) return { ok: false, error: "날짜를 골라 주세요." };
    addAvailability(user.id, { kind: "date", weekday: null, date: input.date, start_min: input.start, end_min: input.end });
  }

  revalidatePath("/calendar");
  return { ok: true };
}

export async function removeStudyTime(id: string) {
  const user = await requireUser();
  removeAvailability(user.id, id);
  revalidatePath("/calendar");
}

export async function addPersonalEvent(input: {
  title: string;
  repeat: boolean;
  weekdays: number[];
  date: string;
  start: number;
  end: number;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!input.title.trim()) return { ok: false, error: "일정 이름을 적어 주세요." };
  if (input.end <= input.start) return { ok: false, error: "종료가 시작보다 빨라요." };

  if (input.repeat) {
    if (!input.weekdays.length) return { ok: false, error: "요일을 골라 주세요." };
    for (const weekday of input.weekdays) {
      addBusy(user.id, {
        title: input.title.trim(),
        kind: "weekly",
        weekday,
        date: null,
        start_min: input.start,
        end_min: input.end,
      });
    }
  } else {
    addBusy(user.id, {
      title: input.title.trim(),
      kind: "date",
      weekday: null,
      date: input.date,
      start_min: input.start,
      end_min: input.end,
    });
  }

  revalidatePath("/calendar");
  return { ok: true };
}

export async function removePersonalEvent(id: string) {
  const user = await requireUser();
  removeBusy(user.id, id);
  revalidatePath("/calendar");
}

export interface DeleteLessonResult {
  ok: boolean;
  error?: string;
  /** 반복 수업이라 "이것만 / 전체" 를 물어야 하는 경우 */
  needsChoice?: boolean;
  seriesCount?: number;
}

/**
 * 수업 삭제.
 * - 오늘 수업과 이미 지난 수업은 지울 수 없다.
 * - 반복 수업이면 먼저 "이것만 / 전체" 를 묻는다. (mode 없이 호출)
 */
export async function deleteLessonAction(
  lessonId: string,
  mode?: "one" | "series",
): Promise<DeleteLessonResult> {
  const user = await requireUser();
  const lesson = getLesson(user.id, lessonId);
  if (!lesson) return { ok: false, error: "수업을 찾을 수 없어요." };

  if (isToday(lesson.date)) return { ok: false, error: "오늘 수업은 지울 수 없어요." };
  if (isPast(lesson.date, lesson.end_min)) return { ok: false, error: "이미 지난 수업이에요." };

  if (lesson.series_id && !mode) {
    const count = listLessons(user.id).filter(
      (item) => item.series_id === lesson.series_id && item.date >= lesson.date,
    ).length;
    return { ok: false, needsChoice: true, seriesCount: count };
  }

  if (lesson.series_id && mode === "series") {
    deleteSeries(user.id, lesson.series_id, lesson.date);
  } else {
    deleteLesson(user.id, lessonId);
  }

  revalidatePath("/calendar");
  revalidatePath("/lessons");
  revalidatePath("/home");
  return { ok: true };
}
