export interface Word {
  id: number;
  entry: string;
  pos: string;
  translate: string;
  meaning: string;
  recProd: string;
  band: string;
}

export interface WordProgress {
  wordId: number;
  ease: number;
  intervalDays: number;
  nextReview: string;
  correctCount: number;
  wrongCount: number;
  lastSeen: string | null;
  mastered: boolean;
}

export type VocabularyId = 'elementary' | 'middle';

export interface UserProfile {
  id: string;
  name: string;
  uiLanguage: 'he' | 'en';
  reminderTime: string;
  reminderEnabled: boolean;
  wordsPerDay: 5 | 8 | 10 | 12 | 15;
  /** @deprecated migrated to wordsPerDay */
  sessionMinutes?: 10 | 15;
  onboarded: boolean;
  activeVocabulary: VocabularyId;
}

export interface UserStreak {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
}

export interface PracticeSession {
  id: string;
  startedAt: string;
  durationSec: number;
  wordsCount: number;
  score: number;
  type: 'daily' | 'mylist' | 'review' | 'exam';
  vocabularyId: VocabularyId;
  wordIds?: number[];
  correctWordIds?: number[];
  missedWordIds?: number[];
}

export interface WeekPlan {
  /** Which group of 5 lessons (0 = lessons 1–5, 1 = lessons 6–10, …) */
  batchIndex: number;
  wordIds: number[];
  /** Lesson index within the current batch (0–4) */
  completedDays: number[];
  examCompleted: boolean;
  /** @deprecated Calendar week; no longer resets progress */
  weekKey?: string;
}

export interface VocabularyState {
  wordProgress: Record<number, WordProgress>;
  myList: number[];
  knownWords: number[];
  sessions: PracticeSession[];
  myListPracticedToday: number[];
  weekPlan: WeekPlan | null;
}

export interface UserData {
  profile: UserProfile;
  elementary: VocabularyState;
  middle: VocabularyState;
  streak: UserStreak;
  todayMinutes: number;
  todayDate: string;
}

export type GameMode = 'flash';

export interface GameQuestion {
  word: Word;
  mode: GameMode;
  options?: string[];
  correctOption?: string;
}

export type SessionType = 'daily' | 'mylist' | 'review' | 'exam';

export function emptyVocabularyState(): VocabularyState {
  return {
    wordProgress: {},
    myList: [],
    knownWords: [],
    sessions: [],
    myListPracticedToday: [],
    weekPlan: null,
  };
}
