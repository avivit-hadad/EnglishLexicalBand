import type { Word, GameQuestion, GameMode, SessionType, UserData, VocabularyId } from '../types';
import { getWords } from './vocabulary';
import { shuffle, getDistractors } from './words';
import {
  buildDailyWordQueue,
  buildMyListQueue,
  buildReviewWordQueue,
  buildExamWordQueue,
  getActiveVocabulary,
  getVocabState,
} from './progress';
import { getNextLessonDayIndex } from './weekPlan';

export interface SessionPlan {
  rounds: { mode: GameMode; label: string; words: Word[] }[];
  sessionType: SessionType;
  vocabularyId: VocabularyId;
  lessonDayIndex?: number;
}

export function buildSessionPlan(sessionType: SessionType, data: UserData): SessionPlan {
  const vocabularyId = getActiveVocabulary(data);

  if (sessionType === 'mylist') {
    const words = buildMyListQueue(data, vocabularyId);
    return {
      sessionType,
      vocabularyId,
      rounds:
        words.length > 0
          ? [{ mode: 'flash' as GameMode, label: 'flashMatch', words }]
          : [],
    };
  }

  if (sessionType === 'review') {
    const words = buildReviewWordQueue(data, vocabularyId);
    return {
      sessionType,
      vocabularyId,
      rounds:
        words.length > 0
          ? [{ mode: 'flash' as GameMode, label: 'weekReview', words }]
          : [],
    };
  }

  if (sessionType === 'exam') {
    const words = buildExamWordQueue(data, vocabularyId);
    return {
      sessionType,
      vocabularyId,
      rounds:
        words.length > 0
          ? [{ mode: 'flash' as GameMode, label: 'weekExam', words }]
          : [],
    };
  }

  const words = buildDailyWordQueue(data, vocabularyId);
  const lessonDayIndex = getNextLessonDayIndex(getVocabState(data, vocabularyId).weekPlan);

  return {
    sessionType: 'daily',
    vocabularyId,
    lessonDayIndex: lessonDayIndex ?? undefined,
    rounds:
      words.length > 0
        ? [{ mode: 'flash' as GameMode, label: 'flashMatch', words }]
        : [],
  };
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
