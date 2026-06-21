import type { Word, GameQuestion, GameMode, SessionType, UserData, VocabularyId } from '../types';
import { getWords } from './vocabulary';
import { shuffle, getDistractors } from './words';
import {
  buildDailyWordQueue,
  buildMyListQueue,
  getActiveVocabulary,
  getVocabState,
} from './progress';

export interface SessionPlan {
  rounds: { mode: GameMode; label: string; words: Word[] }[];
  sessionType: SessionType;
  targetMinutes: number;
  vocabularyId: VocabularyId;
}

export function buildSessionPlan(
  sessionType: SessionType,
  data: UserData,
  targetMinutes: number
): SessionPlan {
  const vocabularyId = getActiveVocabulary(data);
  const state = getVocabState(data, vocabularyId);

  if (sessionType === 'mylist') {
    const words = buildMyListQueue(data, vocabularyId);
    return {
      sessionType,
      targetMinutes,
      vocabularyId,
      rounds: words.length > 0
        ? [{ mode: 'flash' as GameMode, label: 'flashMatch', words }]
        : [],
    };
  }

  const myListWords = state.myList.length > 0 ? buildMyListQueue(data, vocabularyId).slice(0, 5) : [];
  const systemWords = buildDailyWordQueue(data, vocabularyId);

  const rounds: SessionPlan['rounds'] = [];

  if (myListWords.length > 0) {
    rounds.push({ mode: 'flash' as GameMode, label: 'myListRound', words: myListWords });
  }

  rounds.push({
    mode: 'flash' as GameMode,
    label: 'flashMatch',
    words: systemWords.slice(0, 15),
  });

  return {
    sessionType,
    targetMinutes,
    vocabularyId,
    rounds: rounds.filter((r) => r.words.length > 0),
  };
}

export function buildWordListPlan(wordIds: number[], vocabularyId: VocabularyId): SessionPlan {
  const words = wordIds
    .map((id) => getWords(vocabularyId).find((w) => w.id === id))
    .filter(Boolean) as Word[];

  return {
    sessionType: 'mylist',
    targetMinutes: 10,
    vocabularyId,
    rounds: words.length > 0
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
        body: document.documentElement.lang === 'he'
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
