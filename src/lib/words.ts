import type { Word, WordProgress, VocabularyId } from '../types';
import { getWords } from './vocabulary';

export function getWordById(id: number, vocabularyId: VocabularyId): Word | undefined {
  return getWords(vocabularyId).find((w) => w.id === id);
}

export function searchWords(query: string, vocabularyId: VocabularyId, limit = 50): Word[] {
  const words = getWords(vocabularyId);
  const q = query.trim().toLowerCase();
  if (!q) return words.slice(0, limit);
  return words
    .filter(
      (w) =>
        w.entry.toLowerCase().includes(q) ||
        w.translate.includes(q) ||
        w.band.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

export function getDistractors(word: Word, count: number, pool: Word[]): string[] {
  const sameBand = pool.filter((w) => w.id !== word.id && w.band === word.band);
  const others = pool.filter((w) => w.id !== word.id && w.band !== word.band);
  const candidates = [...sameBand, ...others];
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((w) => w.translate);
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getMasteryPercent(progress: WordProgress | undefined): number {
  if (!progress) return 0;
  return progress.mastered ? 100 : Math.min(90, progress.correctCount * 20);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
