import { useTranslation } from 'react-i18next';
import type { Word } from '../types';
import { speakEnglishWord, isSpeechSupported } from '../lib/speech';
import { DashboardStatItem } from './DashboardStatItem';

interface LearnWordsScreenProps {
  words: Word[];
  knownWordIds: number[];
  onToggleKnown: (wordId: number) => void;
  onNext: () => void;
}

export function LearnWordsScreen({
  words,
  knownWordIds,
  onToggleKnown,
  onNext,
}: LearnWordsScreenProps) {
  const { t } = useTranslation();
  const canSpeak = isSpeechSupported();
  const knownSet = new Set(knownWordIds);
  const practiceCount = words.filter((w) => !knownSet.has(w.id)).length;

  return (
    <div className="learn-words">
      <p className="learn-words-hint">{t('learnWordsHint')}</p>
      <div className="learn-words-summary">
        <DashboardStatItem icon="📖" title={t('learnWordsLessonTotal')} count={words.length} />
        {practiceCount < words.length && (
          <p className="learn-words-practice-count">
            {t('learnWordsPracticeCount', { count: practiceCount })}
          </p>
        )}
      </div>

      <div className="card learn-words-card">
        <div className="learn-words-table">
          <div className="learn-words-header">
            <span className="learn-words-col-known" aria-hidden="true" />
            <span className="learn-words-col-en">{t('wordEnglish')}</span>
            <span className="learn-words-col-he">{t('wordHebrew')}</span>
            <span className="learn-words-col-speak" aria-hidden="true" />
          </div>
          <div className="learn-words-list">
            {words.map((word) => {
              const isKnown = knownSet.has(word.id);
              return (
                <div
                  className={`learn-words-row${isKnown ? ' learn-words-row-known' : ''}`}
                  key={word.id}
                >
                  <div className="learn-words-known-cell">
                    <button
                      type="button"
                      className={`known-btn learn-words-known-btn${isKnown ? ' active' : ''}`}
                      onClick={() => onToggleKnown(word.id)}
                      aria-label={isKnown ? t('unmarkKnown') : t('markKnown')}
                      title={isKnown ? t('unmarkKnown') : t('markKnown')}
                    >
                      ✓
                    </button>
                  </div>
                  <span className="learn-words-en">{word.entry}</span>
                  <span className="learn-words-he">{word.translate}</span>
                  {canSpeak ? (
                    <button
                      type="button"
                      className="speaker-btn learn-words-speaker"
                      onClick={() => speakEnglishWord(word.entry)}
                      aria-label={t('speakWord')}
                      title={t('speakWord')}
                    >
                      🔊
                    </button>
                  ) : (
                    <span className="learn-words-speaker-spacer" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary learn-words-next"
        onClick={onNext}
        disabled={practiceCount === 0}
      >
        {practiceCount === 0 ? t('learnWordsAllKnown') : t('next')}
      </button>
    </div>
  );
}
