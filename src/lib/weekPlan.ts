import type { UserData, VocabularyId, Word, WeekPlan } from '../types';
import { getWords, getBands } from './vocabulary';

export const WORK_DAYS_PER_WEEK = 5;

export type WordsPerDay = 5 | 8 | 10 | 12 | 15;

export const WORDS_PER_DAY_OPTIONS: WordsPerDay[] = [5, 8, 10, 12, 15];

export function getWordsPerDay(data: UserData): WordsPerDay {
  const n = data.profile.wordsPerDay ?? 10;
  return WORDS_PER_DAY_OPTIONS.includes(n as WordsPerDay) ? (n as WordsPerDay) : 10;
}

/** Monday of the calendar week (local time), YYYY-MM-DD */
export function getWeekKey(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** 0 = Mon … 4 = Fri; null on weekend */
export function getSchoolDayIndex(date = new Date()): number | null {
  const day = date.getDay();
  if (day === 0 || day === 6) return null;
  return day - 1;
}

function isWordKnown(data: UserData, wordId: number, vocabularyId: VocabularyId): boolean {
  return data[vocabularyId].knownWords.includes(wordId);
}

function isWordActive(data: UserData, wordId: number, vocabularyId: VocabularyId): boolean {
  return !isWordKnown(data, wordId, vocabularyId);
}

function getCurrentBand(data: UserData, vocabularyId: VocabularyId): string {
  const bands = getBands(vocabularyId);
  for (const band of bands) {
    const bandWords = getWords(vocabularyId).filter((w) => w.band === band);
    const done = bandWords.filter(
      (w) =>
        isWordKnown(data, w.id, vocabularyId) ||
        data[vocabularyId].wordProgress[w.id]?.mastered
    ).length;
    if (done < bandWords.length * 0.85) return band;
  }
  return bands[bands.length - 1];
}

export function pickWeekWordIds(data: UserData, vocabularyId: VocabularyId, count: number): number[] {
  const words = getWords(vocabularyId);
  const band = getCurrentBand(data, vocabularyId);
  const bandIndex = words.findIndex((w) => w.band === band);
  const ordered =
    bandIndex >= 0 ? [...words.slice(bandIndex), ...words.slice(0, bandIndex)] : words;

  const ids: number[] = [];
  for (const word of ordered) {
    if (ids.length >= count) break;
    if (!isWordActive(data, word.id, vocabularyId)) continue;
    if (ids.includes(word.id)) continue;
    ids.push(word.id);
  }
  return ids;
}

export function createWeekPlan(data: UserData, vocabularyId: VocabularyId): WeekPlan {
  const wordsPerDay = getWordsPerDay(data);
  return {
    weekKey: getWeekKey(),
    wordIds: pickWeekWordIds(data, vocabularyId, wordsPerDay * WORK_DAYS_PER_WEEK),
    completedDays: [],
    examCompleted: false,
  };
}

export function getWeekPlan(data: UserData, vocabularyId: VocabularyId): WeekPlan | null {
  return data[vocabularyId].weekPlan;
}

export function getWeekDayIndexForPlan(data: UserData, vocabularyId: VocabularyId): number {
  const plan = getWeekPlan(data, vocabularyId);
  if (!plan) return 0;
  const schoolDay = getSchoolDayIndex();
  if (schoolDay !== null) return schoolDay;
  const completed = plan.completedDays.length;
  return completed > 0 ? Math.min(completed - 1, WORK_DAYS_PER_WEEK - 1) : 0;
}

export function getNextLessonDayIndex(plan: WeekPlan | null): number | null {
  if (!plan) return null;
  for (let i = 0; i < WORK_DAYS_PER_WEEK; i++) {
    if (!plan.completedDays.includes(i)) return i;
  }
  return null;
}

export function getLessonWordIds(
  data: UserData,
  vocabularyId: VocabularyId,
  dayIndex: number
): number[] {
  const plan = getWeekPlan(data, vocabularyId);
  if (!plan || dayIndex < 0 || dayIndex >= WORK_DAYS_PER_WEEK) return [];

  const perDay = getWordsPerDay(data);
  const start = dayIndex * perDay;
  return plan.wordIds.slice(start, start + perDay);
}

/** Words for the next uncompleted lesson in this week's plan */
export function getTodaysNewWordIds(data: UserData, vocabularyId: VocabularyId): number[] {
  const plan = getWeekPlan(data, vocabularyId);
  const dayIndex = getNextLessonDayIndex(plan);
  if (dayIndex === null) return [];
  return getLessonWordIds(data, vocabularyId, dayIndex);
}

export function getCumulativeWeekWordIds(data: UserData, vocabularyId: VocabularyId): number[] {
  const plan = getWeekPlan(data, vocabularyId);
  if (!plan || plan.completedDays.length === 0) return [];

  const perDay = getWordsPerDay(data);
  const maxCompleted = Math.max(...plan.completedDays);
  const end = Math.min(plan.wordIds.length, (maxCompleted + 1) * perDay);
  return plan.wordIds.slice(0, end);
}

export function getWeekExamWordIds(data: UserData, vocabularyId: VocabularyId): number[] {
  return getWeekPlan(data, vocabularyId)?.wordIds ?? [];
}

export function wordIdsToWords(ids: number[], vocabularyId: VocabularyId): Word[] {
  const pool = getWords(vocabularyId);
  return ids.map((id) => pool.find((w) => w.id === id)).filter(Boolean) as Word[];
}

export function isDailyCompleteToday(data: UserData, vocabularyId: VocabularyId): boolean {
  return getNextLessonDayIndex(getWeekPlan(data, vocabularyId)) === null;
}

export function hasMoreLessonsThisWeek(data: UserData, vocabularyId: VocabularyId): boolean {
  return getNextLessonDayIndex(getWeekPlan(data, vocabularyId)) !== null;
}

export function isWeekExamAvailable(data: UserData, vocabularyId: VocabularyId): boolean {
  const plan = getWeekPlan(data, vocabularyId);
  if (!plan || plan.wordIds.length === 0 || plan.examCompleted) return false;
  const allDaysDone = WORK_DAYS_PER_WEEK === plan.completedDays.length;
  const schoolDay = getSchoolDayIndex();
  return allDaysDone || schoolDay === 4 || schoolDay === null;
}

export interface WeekProgressSummary {
  weekKey: string;
  wordsPerDay: WordsPerDay;
  weekTotal: number;
  schoolDay: number | null;
  schoolDayLabel: number;
  completedDays: number;
  todaysNewCount: number;
  cumulativeCount: number;
  dailyDoneToday: boolean;
  moreLessonsAvailable: boolean;
  nextLessonDay: number | null;
  examAvailable: boolean;
  examCompleted: boolean;
}

export function getWeekProgressSummary(
  data: UserData,
  vocabularyId: VocabularyId
): WeekProgressSummary {
  const plan = getWeekPlan(data, vocabularyId);
  const wordsPerDay = getWordsPerDay(data);
  const schoolDay = getSchoolDayIndex();
  const weekTotal = plan?.wordIds.length ?? wordsPerDay * WORK_DAYS_PER_WEEK;

  const nextLessonDay = getNextLessonDayIndex(plan);

  return {
    weekKey: plan?.weekKey ?? getWeekKey(),
    wordsPerDay,
    weekTotal,
    schoolDay,
    schoolDayLabel:
      nextLessonDay !== null
        ? nextLessonDay + 1
        : plan && plan.completedDays.length > 0
          ? Math.max(...plan.completedDays) + 1
          : 1,
    completedDays: plan?.completedDays.length ?? 0,
    todaysNewCount: getTodaysNewWordIds(data, vocabularyId).length,
    cumulativeCount: getCumulativeWeekWordIds(data, vocabularyId).length,
    dailyDoneToday: nextLessonDay === null,
    moreLessonsAvailable: nextLessonDay !== null,
    nextLessonDay,
    examAvailable: isWeekExamAvailable(data, vocabularyId),
    examCompleted: plan?.examCompleted ?? false,
  };
}
