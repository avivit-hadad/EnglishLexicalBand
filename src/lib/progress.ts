import type {
  WordProgress,
  UserData,
  Word,
  PracticeSession,
  VocabularyId,
  VocabularyState,
} from '../types';
import { emptyVocabularyState } from '../types';
import { getWords, getBands } from './vocabulary';
import { todayStr, getWordById } from './words';
import { randomUUID } from './uuid';
import {
  createWeekPlan,
  normalizeWeekPlan,
  normalizeWeekPlanShape,
  advanceToNextBatch,
  pickBatchWordIds,
  getTodaysNewWordIds,
  getCumulativeWeekWordIds,
  getWordsPerDay,
  getNextLessonDayIndex,
  getLessonsInBatch,
  wordIdsToWords,
  WORK_DAYS_PER_WEEK,
} from './weekPlan';

const STORAGE_PREFIX = 'lexical_band_';

function defaultWordProgress(wordId: number): WordProgress {
  return {
    wordId,
    ease: 2.5,
    intervalDays: 0,
    nextReview: todayStr(),
    correctCount: 0,
    wrongCount: 0,
    lastSeen: null,
    mastered: false,
  };
}

export function getActiveVocabulary(data: UserData): VocabularyId {
  return data.profile.activeVocabulary ?? 'elementary';
}

export function getVocabState(data: UserData, vocabularyId?: VocabularyId): VocabularyState {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  return data[vocab];
}

function withVocabState(
  data: UserData,
  vocabularyId: VocabularyId,
  state: VocabularyState
): UserData {
  return { ...data, [vocabularyId]: state };
}

export function migrateLegacyUserData(raw: Record<string, unknown>): UserData {
  const profile = raw.profile as UserData['profile'] & { email?: string };
  if (profile && !profile.name && profile.email) {
    profile.name = profile.email.split('@')[0];
  }
  if (!profile.activeVocabulary) {
    profile.activeVocabulary = 'elementary';
  }
  if (!profile.wordsPerDay) {
    profile.wordsPerDay = profile.sessionMinutes === 15 ? 12 : 10;
  }

  const migrateVocab = (state: Record<string, unknown> | VocabularyState): VocabularyState => {
    const s = state as VocabularyState;
    return {
      wordProgress: s.wordProgress ?? {},
      myList: s.myList ?? [],
      knownWords: s.knownWords ?? [],
      sessions: (s.sessions ?? []).map((sess) => ({
        ...sess,
        vocabularyId: sess.vocabularyId ?? 'elementary',
      })),
      myListPracticedToday: s.myListPracticedToday ?? [],
      weekPlan: s.weekPlan ?? null,
    };
  };

  if (raw.elementary && raw.middle) {
    const data = raw as unknown as UserData;
    return {
      ...data,
      elementary: migrateVocab(data.elementary),
      middle: migrateVocab(data.middle),
    };
  }

  const legacyState: VocabularyState = migrateVocab({
    wordProgress: (raw.wordProgress as VocabularyState['wordProgress']) ?? {},
    myList: (raw.myList as number[]) ?? [],
    knownWords: (raw.knownWords as number[]) ?? [],
    sessions: ((raw.sessions as PracticeSession[]) ?? []).map((s) => ({
      ...s,
      vocabularyId: s.vocabularyId ?? 'elementary',
    })),
    myListPracticedToday: (raw.myListPracticedToday as number[]) ?? [],
  });

  return {
    profile,
    elementary: legacyState,
    middle: emptyVocabularyState(),
    streak: raw.streak as UserData['streak'],
    todayMinutes: (raw.todayMinutes as number) ?? 0,
    todayDate: (raw.todayDate as string) ?? todayStr(),
  };
}

export function createDefaultUserData(profile: UserData['profile']): UserData {
  return {
    profile: { ...profile, activeVocabulary: profile.activeVocabulary ?? 'elementary' },
    elementary: emptyVocabularyState(),
    middle: emptyVocabularyState(),
    streak: { currentStreak: 0, longestStreak: 0, lastPracticeDate: null },
    todayMinutes: 0,
    todayDate: todayStr(),
  };
}

export function isWordKnown(
  data: UserData,
  wordId: number,
  vocabularyId?: VocabularyId
): boolean {
  const state = getVocabState(data, vocabularyId);
  return state.knownWords.includes(wordId);
}

export function isWordActive(
  data: UserData,
  wordId: number,
  vocabularyId?: VocabularyId
): boolean {
  return !isWordKnown(data, wordId, vocabularyId);
}

export function ensureWeekPlan(data: UserData, vocabularyId?: VocabularyId): UserData {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const state = getVocabState(data, vocab);

  if (!state.weekPlan) {
    return withVocabState(data, vocab, {
      ...state,
      weekPlan: createWeekPlan(data, vocab),
    });
  }

  const normalized = normalizeWeekPlan(data, vocab, normalizeWeekPlanShape(state.weekPlan));
  const prev = state.weekPlan;
  const same =
    (prev.batchIndex ?? 0) === normalized.batchIndex &&
    prev.examCompleted === normalized.examCompleted &&
    prev.completedDays.length === normalized.completedDays.length &&
    prev.completedDays.every((d, i) => d === normalized.completedDays[i]) &&
    prev.wordIds.length === normalized.wordIds.length &&
    prev.wordIds.every((id, i) => id === normalized.wordIds[i]);

  if (same) return data;

  return withVocabState(data, vocab, {
    ...state,
    weekPlan: normalized,
  });
}

export function markDailyDayComplete(
  data: UserData,
  vocabularyId: VocabularyId,
  lessonDayIndex: number
): UserData {
  const state = getVocabState(data, vocabularyId);
  const plan = state.weekPlan;
  if (!plan || lessonDayIndex < 0 || lessonDayIndex >= WORK_DAYS_PER_WEEK) return data;
  if (plan.completedDays.includes(lessonDayIndex)) return data;

  const wordsPerDay = getWordsPerDay(data);
  const completedDays = [...plan.completedDays, lessonDayIndex].sort((a, b) => a - b);
  let nextPlan: typeof plan = { ...plan, completedDays };

  if (nextPlan.completedDays.length >= getLessonsInBatch(nextPlan, wordsPerDay)) {
    nextPlan = advanceToNextBatch(data, vocabularyId, nextPlan);
  }

  return withVocabState(data, vocabularyId, {
    ...state,
    weekPlan: nextPlan,
  });
}

export function markWeekExamComplete(data: UserData, vocabularyId?: VocabularyId): UserData {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const state = getVocabState(data, vocab);
  const plan = state.weekPlan;
  if (!plan) return data;

  return withVocabState(data, vocab, {
    ...state,
    weekPlan: { ...plan, examCompleted: true },
  });
}

export function loadUserData(userId: string): UserData | null {
  const raw = localStorage.getItem(STORAGE_PREFIX + userId);
  if (!raw) return null;
  try {
    let data = migrateLegacyUserData(JSON.parse(raw) as Record<string, unknown>);
    if (data.todayDate !== todayStr()) {
      data.todayMinutes = 0;
      data.todayDate = todayStr();
      data.elementary = { ...data.elementary, myListPracticedToday: [] };
      data.middle = { ...data.middle, myListPracticedToday: [] };
    }
    data = ensureWeekPlan(data, 'elementary');
    data = ensureWeekPlan(data, 'middle');
    return data;
  } catch {
    return null;
  }
}

export function saveUserData(userId: string, data: UserData): void {
  localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(data));
}

export function setActiveVocabulary(data: UserData, vocabularyId: VocabularyId): UserData {
  return {
    ...data,
    profile: { ...data.profile, activeVocabulary: vocabularyId },
  };
}

export function getWordProgress(
  data: UserData,
  wordId: number,
  vocabularyId?: VocabularyId
): WordProgress {
  const state = getVocabState(data, vocabularyId);
  return state.wordProgress[wordId] ?? defaultWordProgress(wordId);
}

export function updateWordProgress(
  data: UserData,
  wordId: number,
  correct: boolean,
  vocabularyId?: VocabularyId
): UserData {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const state = getVocabState(data, vocab);
  const wp = { ...getWordProgress(data, wordId, vocab) };
  wp.lastSeen = new Date().toISOString();

  if (correct) {
    wp.correctCount++;
    if (wp.intervalDays === 0) wp.intervalDays = 1;
    else if (wp.intervalDays === 1) wp.intervalDays = 3;
    else wp.intervalDays = Math.round(wp.intervalDays * wp.ease);
    wp.ease = Math.min(3.0, wp.ease + 0.1);
    if (wp.correctCount >= 3 && wp.wrongCount === 0) wp.mastered = true;
  } else {
    wp.wrongCount++;
    wp.intervalDays = 0;
    wp.ease = Math.max(1.3, wp.ease - 0.2);
    wp.mastered = false;
  }

  const next = new Date();
  next.setDate(next.getDate() + wp.intervalDays);
  wp.nextReview = next.toISOString().slice(0, 10);

  return withVocabState(data, vocab, {
    ...state,
    wordProgress: { ...state.wordProgress, [wordId]: wp },
  });
}

export function getDueWords(
  data: UserData,
  limit: number,
  vocabularyId?: VocabularyId
): Word[] {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const words = getWords(vocab);
  const today = todayStr();
  const due = words.filter((w) => {
    if (!isWordActive(data, w.id, vocab)) return false;
    const wp = getWordProgress(data, w.id, vocab);
    return !wp.mastered && wp.nextReview <= today;
  });
  due.sort((a, b) => {
    const pa = getWordProgress(data, a.id, vocab);
    const pb = getWordProgress(data, b.id, vocab);
    return pa.nextReview.localeCompare(pb.nextReview);
  });
  return due.slice(0, limit);
}

export function getNewWords(
  data: UserData,
  band: string,
  limit: number,
  vocabularyId?: VocabularyId
): Word[] {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const state = getVocabState(data, vocab);
  return getWords(vocab)
    .filter((w) => w.band === band && isWordActive(data, w.id, vocab) && !state.wordProgress[w.id])
    .slice(0, limit);
}

export function getCurrentBand(data: UserData, vocabularyId?: VocabularyId): string {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const bands = getBands(vocab);
  for (const band of bands) {
    const bandWords = getWords(vocab).filter((w) => w.band === band);
    const done = bandWords.filter(
      (w) => isWordKnown(data, w.id, vocab) || getWordProgress(data, w.id, vocab).mastered
    ).length;
    if (done < bandWords.length * 0.85) return band;
  }
  return bands[bands.length - 1];
}

export function getBandProgress(
  data: UserData,
  band: string,
  vocabularyId?: VocabularyId
): number {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const bandWords = getWords(vocab).filter((w) => w.band === band);
  if (bandWords.length === 0) return 0;
  const done = bandWords.filter(
    (w) => isWordKnown(data, w.id, vocab) || getWordProgress(data, w.id, vocab).mastered
  ).length;
  return Math.round((done / bandWords.length) * 100);
}

export function getDueCount(data: UserData, vocabularyId?: VocabularyId): number {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const today = todayStr();
  return getWords(vocab).filter((w) => {
    if (!isWordActive(data, w.id, vocab)) return false;
    const wp = getWordProgress(data, w.id, vocab);
    return !wp.mastered && wp.nextReview <= today;
  }).length;
}

export function buildDailyWordQueue(data: UserData, vocabularyId?: VocabularyId): Word[] {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const ids = getTodaysNewWordIds(data, vocab);
  return wordIdsToWords(ids, vocab);
}

export function buildReviewWordQueue(data: UserData, vocabularyId?: VocabularyId): Word[] {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const ids = getCumulativeWeekWordIds(data, vocab);
  return wordIdsToWords(ids, vocab);
}

export function buildExamWordQueue(data: UserData, vocabularyId?: VocabularyId): Word[] {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const plan = getVocabState(data, vocab).weekPlan;
  return wordIdsToWords(plan?.wordIds ?? [], vocab);
}

/** Words practiced in daily lessons, excluding those marked as known */
export function getLearnedWordIds(data: UserData, vocabularyId: VocabularyId): number[] {
  const state = getVocabState(data, vocabularyId);
  const known = new Set(state.knownWords);
  const ids = new Set<number>();

  for (const session of state.sessions) {
    if (session.type === 'daily' && session.wordIds?.length) {
      for (const id of session.wordIds) ids.add(id);
    }
  }

  const plan = state.weekPlan;
  if (plan) {
    const perDay = getWordsPerDay(data);
    for (let batch = 0; batch < (plan.batchIndex ?? 0); batch++) {
      for (const id of pickBatchWordIds(data, vocabularyId, batch)) ids.add(id);
    }
    for (const dayIdx of plan.completedDays) {
      const chunk = plan.wordIds.slice(dayIdx * perDay, dayIdx * perDay + perDay);
      for (const id of chunk) ids.add(id);
    }
  }

  return [...ids].filter((id) => !known.has(id));
}

export function getLearnedWords(data: UserData, vocabularyId: VocabularyId): Word[] {
  return getLearnedWordIds(data, vocabularyId)
    .map((id) => getWordById(id, vocabularyId))
    .filter(Boolean)
    .sort((a, b) => a!.entry.localeCompare(b!.entry)) as Word[];
}

/** Unique words touched so far: learned in lessons + known + on practice list */
export function getProgressWordTotal(data: UserData, vocabularyId: VocabularyId): number {
  const state = getVocabState(data, vocabularyId);
  const ids = new Set<number>();
  for (const id of getLearnedWordIds(data, vocabularyId)) ids.add(id);
  for (const id of state.knownWords) ids.add(id);
  for (const id of state.myList) ids.add(id);
  return ids.size;
}

export interface VocabularyProgressStats {
  learned: number;
  toPractice: number;
  known: number;
  totalSoFar: number;
}

export function getVocabularyProgressStats(
  data: UserData,
  vocabularyId: VocabularyId
): VocabularyProgressStats {
  const state = getVocabState(data, vocabularyId);
  const learned = getLearnedWordIds(data, vocabularyId).length;
  const toPractice = state.myList.length;
  const known = state.knownWords.length;
  return {
    learned,
    toPractice,
    known,
    totalSoFar: getProgressWordTotal(data, vocabularyId),
  };
}

export interface DailySessionBreakdown {
  newCount: number;
  reviewCount: number;
  myListCount: number;
  totalCount: number;
  weekDay: number;
  weekTotal: number;
  cumulativeCount: number;
}

export function getDailySessionBreakdown(
  data: UserData,
  vocabularyId?: VocabularyId
): DailySessionBreakdown {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const newWords = buildDailyWordQueue(data, vocab);
  const cumulativeCount = getCumulativeWeekWordIds(data, vocab).length;
  const wordsPerDay = getWordsPerDay(data);
  const weekTotal = wordsPerDay * WORK_DAYS_PER_WEEK;
  const plan = getVocabState(data, vocab).weekPlan;
  const nextLessonDay = getNextLessonDayIndex(plan, wordsPerDay);

  return {
    newCount: newWords.length,
    reviewCount: cumulativeCount,
    myListCount: 0,
    totalCount: newWords.length,
    weekDay: nextLessonDay !== null ? nextLessonDay + 1 : 5,
    weekTotal,
    cumulativeCount,
  };
}

export function buildMyListQueue(data: UserData, vocabularyId?: VocabularyId): Word[] {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const state = getVocabState(data, vocab);
  const listWords = state.myList
    .map((id) => getWords(vocab).find((w) => w.id === id))
    .filter(Boolean) as Word[];
  const notToday = listWords.filter((w) => !state.myListPracticedToday.includes(w.id));
  const pool = notToday.length > 0 ? notToday : listWords;
  return pool.slice(0, 10);
}

export function recordSession(
  data: UserData,
  type: 'daily' | 'mylist' | 'review' | 'exam',
  durationSec: number,
  wordsCount: number,
  score: number,
  practicedWordIds: number[],
  missedWordIds: number[] = [],
  vocabularyId?: VocabularyId,
  lessonDayIndex?: number
): UserData {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const state = getVocabState(data, vocab);
  const today = todayStr();
  let streak = { ...data.streak };

  if (streak.lastPracticeDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);
    if (streak.lastPracticeDate === yStr) {
      streak.currentStreak++;
    } else {
      streak.currentStreak = 1;
    }
    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
    streak.lastPracticeDate = today;
  }

  const uniquePracticed = [...new Set(practicedWordIds)];
  const missed = [...new Set(missedWordIds)];
  const missedSet = new Set(missed);
  const correct = uniquePracticed.filter((id) => !missedSet.has(id));

  const session: PracticeSession = {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    durationSec,
    wordsCount,
    score,
    type,
    vocabularyId: vocab,
    wordIds: uniquePracticed,
    correctWordIds: correct,
    missedWordIds: missed,
  };

  const myListPracticedToday =
    type === 'mylist'
      ? [...new Set([...state.myListPracticedToday, ...practicedWordIds])]
      : state.myListPracticedToday;

  let next = withVocabState(data, vocab, {
    ...state,
    sessions: [session, ...state.sessions].slice(0, 100),
    myListPracticedToday,
  });

  if (type === 'daily' && lessonDayIndex !== undefined) {
    next = markDailyDayComplete(next, vocab, lessonDayIndex);
  }
  if (type === 'exam') {
    next = markWeekExamComplete(next, vocab);
  }

  return {
    ...next,
    streak,
    todayMinutes: data.todayMinutes + Math.round(durationSec / 60),
    todayDate: today,
  };
}

export function toggleMyList(
  data: UserData,
  wordId: number,
  vocabularyId?: VocabularyId
): UserData {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const state = getVocabState(data, vocab);
  const has = state.myList.includes(wordId);
  return withVocabState(data, vocab, {
    ...state,
    myList: has ? state.myList.filter((id) => id !== wordId) : [...state.myList, wordId],
  });
}

export function toggleKnownWord(
  data: UserData,
  wordId: number,
  vocabularyId?: VocabularyId
): UserData {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const state = getVocabState(data, vocab);
  const has = state.knownWords.includes(wordId);
  return withVocabState(data, vocab, {
    ...state,
    knownWords: has
      ? state.knownWords.filter((id) => id !== wordId)
      : [...state.knownWords, wordId],
  });
}

export function markWordKnown(
  data: UserData,
  wordId: number,
  vocabularyId?: VocabularyId
): UserData {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const state = getVocabState(data, vocab);
  if (state.knownWords.includes(wordId)) return data;
  return withVocabState(data, vocab, {
    ...state,
    knownWords: [...state.knownWords, wordId],
  });
}

export function getWeeklyActivity(
  data: UserData,
  vocabularyId?: VocabularyId
): number[] {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const sessions = getVocabState(data, vocab).sessions;
  const days = [0, 0, 0, 0, 0, 0, 0];
  const now = new Date();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff >= 0 && diff < 7) {
      days[6 - diff] += Math.round(s.durationSec / 60);
    }
  }
  return days;
}

export function getAllSessions(data: UserData, vocabularyId?: VocabularyId): PracticeSession[] {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  return getVocabState(data, vocab).sessions;
}

export function getSessionWordBreakdown(
  session: PracticeSession
): {
  knownWords: Word[];
  missedWords: Word[];
  hasBreakdown: boolean;
} {
  const vocab = session.vocabularyId ?? 'elementary';
  const toWords = (ids: number[]) =>
    ids
      .map((id) => getWordById(id, vocab))
      .filter(Boolean)
      .sort((a, b) => a!.entry.localeCompare(b!.entry)) as Word[];

  if (session.correctWordIds !== undefined && session.missedWordIds !== undefined) {
    return {
      knownWords: toWords(session.correctWordIds),
      missedWords: toWords(session.missedWordIds),
      hasBreakdown: true,
    };
  }

  const allWords = toWords(session.wordIds ?? []);
  return { knownWords: allWords, missedWords: [], hasBreakdown: false };
}

export function getLearnedCount(data: UserData, vocabularyId?: VocabularyId): number {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const state = getVocabState(data, vocab);
  return Object.values(state.wordProgress).filter((p) => p.mastered).length;
}
