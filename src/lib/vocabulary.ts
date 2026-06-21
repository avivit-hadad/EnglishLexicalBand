import type { VocabularyId } from '../types';
import elementaryWords from '../data/words-elementary.json';
import middleWords from '../data/words-middle.json';
import type { Word } from '../types';

const WORD_SETS: Record<VocabularyId, Word[]> = {
  elementary: elementaryWords as Word[],
  middle: middleWords as Word[],
};

export const ELEMENTARY_BANDS = ['Pre-Band I', 'Band I Core I', 'Band I Core II'] as const;
export const MIDDLE_BANDS = ['Band II Core I', 'Band II Core II', 'Band II Core III'] as const;

export function getWords(vocabularyId: VocabularyId): Word[] {
  return WORD_SETS[vocabularyId];
}

export function getBands(vocabularyId: VocabularyId): readonly string[] {
  return vocabularyId === 'elementary' ? ELEMENTARY_BANDS : MIDDLE_BANDS;
}

export function getWordCount(vocabularyId: VocabularyId): number {
  return getWords(vocabularyId).length;
}

/** @deprecated Use getWords(vocabularyId) */
export const WORDS = WORD_SETS.elementary;
