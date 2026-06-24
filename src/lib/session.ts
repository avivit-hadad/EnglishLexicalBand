import type { Word, GameQuestion, GameMode, SessionType, UserData, VocabularyId } from '../types';
import { getWords } from './vocabulary';
import { shuffle, getDistractors } from './words';
import {
  buildMyListQueue,
  buildReviewWordQueue,
  buildExamWordQueue,
  getActiveVocabulary,
  getVocabState,
} from './progress';
import { getNextLessonDayIndex, getLessonWordIds, wordIdsToWords, getGlobalLessonNumberForBatch, getWeekPlan, getWordsPerDay } from './weekPlan';

export interface SessionPlan {
  rounds: { mode: GameMode; label: string; words: Word[] }[];
  sessionType: SessionType;
  vocabularyId: VocabularyId;
  lessonDayIndex?: number;
  lessonNumber?: number;
  viewBatchIndex?: number;
}

export function buildDailySessionPlan(
  data: UserData,
  vocabularyId: VocabularyId,
  lessonDayIndex: number,
  batchIndex?: number
): SessionPlan {
  const plan = getWeekPlan(data, vocabularyId);
  const batch = batchIndex ?? plan?.batchIndex ?? 0;
  const words = wordIdsToWords(
    getLessonWordIds(data, vocabularyId, lessonDayIndex, batch),
    vocabularyId
  );
  return {
    sessionType: 'daily',
    vocabularyId,
    lessonDayIndex,
    lessonNumber: getGlobalLessonNumberForBatch(batch, lessonDayIndex),
    viewBatchIndex: batch,
    rounds:
      words.length > 0
        ? [{ mode: 'flash' as GameMode, label: 'flashMatch', words }]
        : [],
  };
}

export function buildSessionPlan(
  sessionType: SessionType,
  data: UserData,
  vocabularyId?: VocabularyId
): SessionPlan {
  const vocab = vocabularyId ?? getActiveVocabulary(data);

  if (sessionType === 'mylist') {
    const words = buildMyListQueue(data, vocab);
    return {
      sessionType,
      vocabularyId: vocab,
      rounds:
        words.length > 0
          ? [{ mode: 'flash' as GameMode, label: 'flashMatch', words }]
          : [],
    };
  }

  if (sessionType === 'review') {
    const words = buildReviewWordQueue(data, vocab);
    return {
      sessionType,
      vocabularyId: vocab,
      rounds:
        words.length > 0
          ? [{ mode: 'flash' as GameMode, label: 'weekReview', words }]
          : [],
    };
  }

  if (sessionType === 'exam') {
    const words = buildExamWordQueue(data, vocab);
    return {
      sessionType,
      vocabularyId: vocab,
      rounds:
        words.length > 0
          ? [{ mode: 'flash' as GameMode, label: 'weekExam', words }]
          : [],
    };
  }

  const weekPlan = getVocabState(data, vocab).weekPlan;
  const wordsPerDay = getWordsPerDay(data);
  const lessonDayIndex = getNextLessonDayIndex(weekPlan, wordsPerDay);
  if (lessonDayIndex === null) {
    return { sessionType: 'daily', vocabularyId: vocab, rounds: [] };
  }
  return buildDailySessionPlan(data, vocab, lessonDayIndex);
}

/** All unique words in a session plan, in play order */
export function getSessionWords(plan: SessionPlan): Word[] {
  const seen = new Set<number>();
  const words: Word[] = [];
  for (const round of plan.rounds) {
    for (const word of round.words) {
      if (seen.has(word.id)) continue;
      seen.add(word.id);
      words.push(word);
    }
  }
  return words;
}

export function buildWordListPlan(wordIds: number[], vocabularyId: VocabularyId): SessionPlan {
  const words = wordIds
    .map((id) => getWords(vocabularyId).find((w) => w.id === id))
    .filter(Boolean) as Word[];

  return {
    sessionType: 'mylist',
    vocabularyId,
    rounds:
      words.length > 0
        ? [{ mode: 'flash' as GameMode, label: 'flashMatch', words }]
        : [],
  };
}

/** Remove words the user marked as known from a session plan */
export function filterKnownWordsFromPlan(plan: SessionPlan, data: UserData): SessionPlan {
  const known = new Set(getVocabState(data, plan.vocabularyId).knownWords);
  const rounds = plan.rounds
    .map((round) => ({
      ...round,
      words: round.words.filter((w) => !known.has(w.id)),
    }))
    .filter((round) => round.words.length > 0);

  return { ...plan, rounds };
}

export function buildQuestion(
  word: Word,
  _mode: GameMode,
  vocabularyId: VocabularyId
): GameQuestion {
  const pool = getWords(vocabularyId);
  const distractors = getDistractors(word, 3, pool);
  const options = shuffle([word.translate, ...distractors]);
  return { word, mode: 'flash', options, correctOption: word.translate };
}

export function scheduleReminder(time: string, enabled: boolean): void {
  if (!enabled || !('Notification' in window)) return;

  Notification.requestPermission().then((perm) => {
    if (perm !== 'granted') return;
    localStorage.setItem(
      'lexical_band_reminder',
      JSON.stringify({ time, enabled, lastSent: null })
    );
  });
}

export function checkLocalReminder(): void {
  const raw = localStorage.getItem('lexical_band_reminder');
  if (!raw || !('Notification' in window)) return;

  try {
    const { time, enabled, lastSent } = JSON.parse(raw);
    if (!enabled || Notification.permission !== 'granted') return;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (lastSent === today) return;

    const [h, m] = time.split(':').map(Number);
    if (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) {
      new Notification('Lexical Band', {
        body:
          document.documentElement.lang === 'he'
            ? 'הגיע זמן לתרגל אנגלית!'
            : 'Time for your English practice!',
        icon: '/icons/icon-192.png',
      });
      localStorage.setItem(
        'lexical_band_reminder',
        JSON.stringify({ time, enabled, lastSent: today })
      );
    }
  } catch {
    /* ignore */
  }
}
