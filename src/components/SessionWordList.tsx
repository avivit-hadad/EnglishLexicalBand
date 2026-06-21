import { useTranslation } from 'react-i18next';
import type { Word } from '../types';

interface SessionWordListProps {
  words: Word[];
  variant: 'known' | 'missed';
}

export function SessionWordList({ words, variant }: SessionWordListProps) {
  const { t } = useTranslation();

  if (words.length === 0) return null;

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>
        {variant === 'known' ? t('wordsYouKnew') : t('wordsYouMissed')}
      </h3>
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
        {words.length} {t('wordsShort')}
      </p>
      <div className="word-table-header word-table-header-status">
        <span />
        <span>{t('wordEnglish')}</span>
        <span>{t('wordHebrew')}</span>
      </div>
      <div className="session-word-list">
        {words.map((word) => (
          <div className={`session-word-row session-word-row-with-status ${variant}`} key={word.id}>
            <span className="session-word-status">{variant === 'known' ? '✓' : '✗'}</span>
            <span className="session-word-en">{word.entry}</span>
            <span className="session-word-he">{word.translate}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
