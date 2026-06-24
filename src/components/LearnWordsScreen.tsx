import { useTranslation } from 'react-i18next';
import type { Word } from '../types';
import { speakEnglishWord, isSpeechSupported } from '../lib/speech';

interface LearnWordsScreenProps {
  words: Word[];
  onNext: () => void;
}

export function LearnWordsScreen({ words, onNext }: LearnWordsScreenProps) {
  const { t } = useTranslation();
  const canSpeak = isSpeechSupported();

  return (
    <div className="learn-words">
      <p className="learn-words-hint">{t('learnWordsHint')}</p>
      <p className="learn-words-count">
        {t('learnWordsCount', { count: words.length })}
      </p>

      <div className="card learn-words-card">
        <div className="learn-words-table">
          <div className="learn-words-header">
            <span className="learn-words-col-en">{t('wordEnglish')}</span>
            <span className="learn-words-col-he">{t('wordHebrew')}</span>
            <span className="learn-words-col-speak" aria-hidden="true" />
          </div>
          <div className="learn-words-list">
            {words.map((word) => (
              <div className="learn-words-row" key={word.id}>
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
            ))}
          </div>
        </div>
      </div>

      <button type="button" className="btn btn-primary learn-words-next" onClick={onNext}>
        {t('next')}
      </button>
    </div>
  );
}
