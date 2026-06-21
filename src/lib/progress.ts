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

  if (raw.elementary && raw.middle) {
    return raw as unknown as UserData;
  }

  const legacyState: VocabularyState = {
    wordProgress: (raw.wordProgress as VocabularyState['wordProgress']) ?? {},
    myList: (raw.myList as number[]) ?? [],
    knownWords: (raw.knownWords as number[]) ?? [],
    sessions: ((raw.sessions as PracticeSession[]) ?? []).map((s) => ({
      ...s,
      vocabularyId: s.vocabularyId ?? 'elementary',
    })),
    myListPracticedToday: (raw.myListPracticedToday as number[]) ?? [],
  };

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

export function loadUserData(userId: string): UserData | null {
  const raw = localStorage.getItem(STORAGE_PREFIX + userId);
  if (!raw) return null;
  try {
    const data = migrateLegacyUserData(JSON.parse(raw) as Record<string, unknown>);
    if (data.todayDate !== todayStr()) {
      data.todayMinutes = 0;
      data.todayDate = todayStr();
      data.elementary = { ...data.elementary, myListPracticedToday: [] };
      data.middle = { ...data.middle, myListPracticedToday: [] };
    }
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
  const due = getDueWords(data, 12, vocabularyId);
  const band = getCurrentBand(data, vocabularyId);
  const newWords = getNewWords(data, band, Math.max(0, 15 - due.length), vocabularyId);
  return [...due, ...newWords].slice(0, 15);
}

export interface DailySessionBreakdown {
  newCount: number;
  reviewCount: number;
  myListCount: number;
  totalCount: number;
}

export function getDailySessionBreakdown(
  data: UserData,
  vocabularyId?: VocabularyId
): DailySessionBreakdown {
  const due = getDueWords(data, 12, vocabularyId);
  const band = getCurrentBand(data, vocabularyId);
  const newWords = getNewWords(data, band, Math.max(0, 15 - due.length), vocabularyId);
  const myListCount =
    getVocabState(data, vocabularyId).myList.length > 0
      ? Math.min(5, buildMyListQueue(data, vocabularyId).length)
      : 0;

  return {
    newCount: newWords.length,
    reviewCount: due.length,
    myListCount,
    totalCount: due.length + newWords.length + myListCount,
  };
}

export function buildMyListQueue(data: UserData, vocabularyId?: VocabularyId): Word[] {
  const vocab = vocabularyId ?? getActiveVocabulary(data);
  const state = getVocabState(data, vocab);
  const listWords = state.myList
    .map((id) => getWords(vocab).find((w) => w.id === id))
    .filter(Boolean)
    .filter((w) => isWordActive(data, w!.id, vocab)) as Word[];
  const notToday = listWords.filter((w) => !state.myListPracticedToday.includes(w.id));
  const pool = notToday.length > 0 ? notToday : listWords;
  return pool.slice(0, 10);
}

export function recordSession(
  data: UserData,
  type: 'daily' | 'mylist',
  durationSec: number,
  wordsCount: number,
  score: number,
  practicedWordIds: number[],
  missedWordIds: number[] = [],
  vocabularyId?: VocabularyId
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

  return {
    ...withVocabState(data, vocab, {
      ...state,
      sessions: [session, ...state.sessions].slice(0, 100),
      myListPracticedToday,
    }),
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
