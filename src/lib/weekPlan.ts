import type { UserData, VocabularyId, Word, WeekPlan } from '../types';
import { getWords, getBands } from './vocabulary';

export const WORK_DAYS_PER_WEEK = 5;

export type WordsPerDay = 5 | 8 | 10 | 12 | 15;

export const WORDS_PER_DAY_OPTIONS: WordsPerDay[] = [5, 8, 10, 12, 15];

export function getWordsPerDay(data: UserData): WordsPerDay {
  const n = data.profile.wordsPerDay ?? 10;
  return WORDS_PER_DAY_OPTIONS.includes(n as WordsPerDay) ? (n as WordsPerDay) : 10;
}

export function getBatchWordCount(data: UserData): number {
  return getWordsPerDay(data) * WORK_DAYS_PER_WEEK;
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

/** All learnable words in curriculum order */
export function getOrderedActiveWordIds(data: UserData, vocabularyId: VocabularyId): number[] {
  const words = getWords(vocabularyId);
  const band = getCurrentBand(data, vocabularyId);
  const bandIndex = words.findIndex((w) => w.band === band);
  const ordered =
    bandIndex >= 0 ? [...words.slice(bandIndex), ...words.slice(0, bandIndex)] : words;

  const ids: number[] = [];
  for (const word of ordered) {
    if (!isWordActive(data, word.id, vocabularyId)) continue;
    if (ids.includes(word.id)) continue;
    ids.push(word.id);
  }
  return ids;
}

/** Words for one batch of 5 lessons */
export function pickBatchWordIds(
  data: UserData,
  vocabularyId: VocabularyId,
  batchIndex: number
): number[] {
  const batchSize = getBatchWordCount(data);
  const start = batchIndex * batchSize;
  return getOrderedActiveWordIds(data, vocabularyId).slice(start, start + batchSize);
}

export function normalizeWeekPlanShape(plan: WeekPlan): WeekPlan {
  return {
    batchIndex: plan.batchIndex ?? 0,
    wordIds: plan.wordIds ?? [],
    completedDays: plan.completedDays ?? [],
    examCompleted: plan.examCompleted ?? false,
  };
}

function isBatchComplete(plan: WeekPlan, wordsPerDay: WordsPerDay): boolean {
  const lessonsInBatch = getLessonsInBatch(plan, wordsPerDay);
  return lessonsInBatch > 0 && plan.completedDays.length >= lessonsInBatch;
}

/** Advance past fully completed batches (e.g. after migration or legacy data) */
export function normalizeWeekPlan(
  data: UserData,
  vocabularyId: VocabularyId,
  plan: WeekPlan
): WeekPlan {
  const wordsPerDay = getWordsPerDay(data);
  let current = normalizeWeekPlanShape(plan);

  if (current.wordIds.length === 0) {
    current.wordIds = pickBatchWordIds(data, vocabularyId, current.batchIndex);
  }

  while (isBatchComplete(current, wordsPerDay)) {
    const nextBatch = current.batchIndex + 1;
    const nextWordIds = pickBatchWordIds(data, vocabularyId, nextBatch);
    if (nextWordIds.length === 0) break;
    current = {
      batchIndex: nextBatch,
      wordIds: nextWordIds,
      completedDays: [],
      examCompleted: false,
    };
  }

  return current;
}

export function createWeekPlan(data: UserData, vocabularyId: VocabularyId): WeekPlan {
  return {
    batchIndex: 0,
    wordIds: pickBatchWordIds(data, vocabularyId, 0),
    completedDays: [],
    examCompleted: false,
  };
}

export function getWeekPlan(data: UserData, vocabularyId: VocabularyId): WeekPlan | null {
  return data[vocabularyId].weekPlan;
}

export function getGlobalLessonNumberForBatch(batchIndex: number, dayIndex: number): number {
  return batchIndex * WORK_DAYS_PER_WEEK + dayIndex + 1;
}

export function getGlobalLessonNumber(plan: WeekPlan | null, dayIndex: number): number {
  return getGlobalLessonNumberForBatch(plan?.batchIndex ?? 0, dayIndex);
}

export function getCurrentBatchIndex(data: UserData, vocabularyId: VocabularyId): number {
  return getWeekPlan(data, vocabularyId)?.batchIndex ?? 0;
}

export function getBatchWordIds(
  data: UserData,
  vocabularyId: VocabularyId,
  batchIndex: number,
  plan: WeekPlan | null
): number[] {
  if (plan && batchIndex === plan.batchIndex) return plan.wordIds;
  return pickBatchWordIds(data, vocabularyId, batchIndex);
}

export function getLessonWordIdsForBatch(
  data: UserData,
  vocabularyId: VocabularyId,
  batchIndex: number,
  dayIndex: number
): number[] {
  if (dayIndex < 0 || dayIndex >= WORK_DAYS_PER_WEEK) return [];
  const plan = getWeekPlan(data, vocabularyId);
  const perDay = getWordsPerDay(data);
  const batchWordIds = getBatchWordIds(data, vocabularyId, batchIndex, plan);
  const start = dayIndex * perDay;
  return batchWordIds.slice(start, start + perDay);
}

export function getLessonsInBatch(plan: WeekPlan | null, wordsPerDay: WordsPerDay): number {
  if (!plan || plan.wordIds.length === 0) return WORK_DAYS_PER_WEEK;
  return Math.min(WORK_DAYS_PER_WEEK, Math.ceil(plan.wordIds.length / wordsPerDay));
}

export function getNextLessonDayIndex(
  plan: WeekPlan | null,
  wordsPerDay: WordsPerDay = 10
): number | null {
  if (!plan || plan.wordIds.length === 0) return null;
  const lessonsInBatch = getLessonsInBatch(plan, wordsPerDay);
  for (let i = 0; i < lessonsInBatch; i++) {
    if (!plan.completedDays.includes(i)) return i;
  }
  return null;
}

export function getLessonWordIds(
  data: UserData,
  vocabularyId: VocabularyId,
  dayIndex: number,
  batchIndex?: number
): number[] {
  const plan = getWeekPlan(data, vocabularyId);
  const batch = batchIndex ?? plan?.batchIndex ?? 0;
  return getLessonWordIdsForBatch(data, vocabularyId, batch, dayIndex);
}

/** Words for the next uncompleted lesson in the current batch */
export function getTodaysNewWordIds(data: UserData, vocabularyId: VocabularyId): number[] {
  const plan = getWeekPlan(data, vocabularyId);
  const wordsPerDay = getWordsPerDay(data);
  const dayIndex = getNextLessonDayIndex(plan, wordsPerDay);
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
  const wordsPerDay = getWordsPerDay(data);
  return getNextLessonDayIndex(getWeekPlan(data, vocabularyId), wordsPerDay) === null;
}

export function hasMoreLessonsThisWeek(data: UserData, vocabularyId: VocabularyId): boolean {
  const wordsPerDay = getWordsPerDay(data);
  return getNextLessonDayIndex(getWeekPlan(data, vocabularyId), wordsPerDay) !== null;
}

export function isWeekExamAvailable(data: UserData, vocabularyId: VocabularyId): boolean {
  const plan = getWeekPlan(data, vocabularyId);
  if (!plan || plan.wordIds.length === 0 || plan.examCompleted) return false;
  return isBatchComplete(plan, getWordsPerDay(data));
}

export interface WeekProgressSummary {
  wordsPerDay: WordsPerDay;
  batchIndex: number;
  batchLessonTotal: number;
  completedDays: number;
  todaysNewCount: number;
  cumulativeCount: number;
  dailyDoneToday: boolean;
  moreLessonsAvailable: boolean;
  nextLessonDay: number | null;
  nextLessonNumber: number | null;
  examAvailable: boolean;
  examCompleted: boolean;
}

export type LessonSlotStatus = 'completed' | 'current' | 'locked';

export interface LessonSlot {
  index: number;
  number: number;
  status: LessonSlotStatus;
  wordCount: number;
}

export function getLessonSlots(
  data: UserData,
  vocabularyId: VocabularyId,
  viewingBatchIndex?: number
): LessonSlot[] {
  const plan = getWeekPlan(data, vocabularyId);
  const wordsPerDay = getWordsPerDay(data);
  const currentBatchIndex = plan?.batchIndex ?? 0;
  const batchIndex = viewingBatchIndex ?? currentBatchIndex;
  const isPastBatch = batchIndex < currentBatchIndex;
  const isCurrentBatch = batchIndex === currentBatchIndex;

  const wordIds = getBatchWordIds(data, vocabularyId, batchIndex, plan);
  const lessonsInBatch = Math.min(
    WORK_DAYS_PER_WEEK,
    wordIds.length > 0 ? Math.ceil(wordIds.length / wordsPerDay) : WORK_DAYS_PER_WEEK
  );

  const completed = isPastBatch
    ? new Set(Array.from({ length: lessonsInBatch }, (_, i) => i))
    : new Set(plan?.completedDays ?? []);

  const nextDay = isCurrentBatch && plan ? getNextLessonDayIndex(plan, wordsPerDay) : null;

  const slots: LessonSlot[] = [];
  for (let i = 0; i < lessonsInBatch; i++) {
    const start = i * wordsPerDay;
    const wordCount = Math.min(wordsPerDay, Math.max(0, wordIds.length - start));
    if (wordCount === 0) continue;

    let status: LessonSlotStatus;
    if (completed.has(i)) status = 'completed';
    else if (nextDay === i) status = 'current';
    else status = 'locked';

    slots.push({
      index: i,
      number: getGlobalLessonNumberForBatch(batchIndex, i),
      status,
      wordCount,
    });
  }
  return slots;
}

export function getWeekProgressSummary(
  data: UserData,
  vocabularyId: VocabularyId
): WeekProgressSummary {
  const plan = getWeekPlan(data, vocabularyId);
  const wordsPerDay = getWordsPerDay(data);
  const nextLessonDay = getNextLessonDayIndex(plan, wordsPerDay);

  return {
    wordsPerDay,
    batchIndex: plan?.batchIndex ?? 0,
    batchLessonTotal: plan ? getLessonsInBatch(plan, wordsPerDay) : WORK_DAYS_PER_WEEK,
    completedDays: plan?.completedDays.length ?? 0,
    todaysNewCount: getTodaysNewWordIds(data, vocabularyId).length,
    cumulativeCount: getCumulativeWeekWordIds(data, vocabularyId).length,
    dailyDoneToday: nextLessonDay === null,
    moreLessonsAvailable: nextLessonDay !== null,
    nextLessonDay,
    nextLessonNumber:
      nextLessonDay !== null ? getGlobalLessonNumber(plan, nextLessonDay) : null,
    examAvailable: isWeekExamAvailable(data, vocabularyId),
    examCompleted: plan?.examCompleted ?? false,
  };
}

function countLessonsForWordCount(wordCount: number, wordsPerDay: WordsPerDay): number {
  if (wordCount <= 0) return 0;
  return Math.min(WORK_DAYS_PER_WEEK, Math.ceil(wordCount / wordsPerDay));
}

export interface LessonProgressStats {
  wordsPerDay: WordsPerDay;
  completedLessons: number;
  totalLessons: number;
  currentLessonNumber: number | null;
  currentBatchIndex: number;
  percentComplete: number;
}

export function getCompletedLessonCount(data: UserData, vocabularyId: VocabularyId): number {
  const plan = getWeekPlan(data, vocabularyId);
  if (!plan) return 0;
  return plan.batchIndex * WORK_DAYS_PER_WEEK + plan.completedDays.length;
}

export function getTotalLessonCount(data: UserData, vocabularyId: VocabularyId): number {
  const wordsPerDay = getWordsPerDay(data);
  const plan = getWeekPlan(data, vocabularyId);
  const currentBatch = plan?.batchIndex ?? 0;
  let total = 0;

  for (let b = 0; b <= currentBatch; b++) {
    const ids = getBatchWordIds(data, vocabularyId, b, plan);
    total += countLessonsForWordCount(ids.length, wordsPerDay);
  }

  let batch = currentBatch + 1;
  while (true) {
    const ids = pickBatchWordIds(data, vocabularyId, batch);
    if (ids.length === 0) break;
    total += countLessonsForWordCount(ids.length, wordsPerDay);
    batch++;
  }

  return total;
}

export function getLessonProgressStats(
  data: UserData,
  vocabularyId: VocabularyId
): LessonProgressStats {
  const wordsPerDay = getWordsPerDay(data);
  const plan = getWeekPlan(data, vocabularyId);
  const completedLessons = getCompletedLessonCount(data, vocabularyId);
  const totalLessons = getTotalLessonCount(data, vocabularyId);
  const nextLessonNumber = getWeekProgressSummary(data, vocabularyId).nextLessonNumber;
  const percentComplete =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return {
    wordsPerDay,
    completedLessons,
    totalLessons,
    currentLessonNumber: nextLessonNumber,
    currentBatchIndex: plan?.batchIndex ?? 0,
    percentComplete,
  };
}

/** Build the next batch plan after completing all lessons in the current batch */
export function advanceToNextBatch(
  data: UserData,
  vocabularyId: VocabularyId,
  plan: WeekPlan
): WeekPlan {
  const nextBatch = plan.batchIndex + 1;
  const nextWordIds = pickBatchWordIds(data, vocabularyId, nextBatch);
  if (nextWordIds.length === 0) return plan;

  return {
    batchIndex: nextBatch,
    wordIds: nextWordIds,
    completedDays: [],
    examCompleted: false,
  };
}
