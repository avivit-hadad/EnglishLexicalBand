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
  sessionMinutes: 10 | 15;
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
  type: 'daily' | 'mylist';
  vocabularyId: VocabularyId;
  wordIds?: number[];
  correctWordIds?: number[];
  missedWordIds?: number[];
}

export interface VocabularyState {
  wordProgress: Record<number, WordProgress>;
  myList: number[];
  knownWords: number[];
  sessions: PracticeSession[];
  myListPracticedToday: number[];
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

export type SessionType = 'daily' | 'mylist';

export function emptyVocabularyState(): VocabularyState {
  return {
    wordProgress: {},
    myList: [],
    knownWords: [],
    sessions: [],
    myListPracticedToday: [],
  };
}
