import type { VocabularyId } from '../types';

export function parseVocabularyId(param: string | undefined): VocabularyId | null {
  if (param === 'elementary' || param === 'middle') return param;
  return null;
}

export function vocabularyDashboardPath(vocabularyId: VocabularyId): string {
  return `/vocabulary/${vocabularyId}`;
}
