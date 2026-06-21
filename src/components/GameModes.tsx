import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Word } from '../types';
import { speakEnglishWord, isSpeechSupported } from '../lib/speech';

interface GameCardProps {
  inMyList: boolean;
  onToggleList: () => void;
  onMarkKnown?: () => void;
  englishWord?: string;
  children: React.ReactNode;
}

export function GameCard({
  inMyList,
  onToggleList,
  onMarkKnown,
  englishWord,
  children,
}: GameCardProps) {
  const { t } = useTranslation();
  const canSpeak = isSpeechSupported() && Boolean(englishWord);

  return (
    <div className="game-card">
      {onMarkKnown && (
        <div className="known-actions">
          <button
            className="known-btn"
            onClick={onMarkKnown}
            type="button"
            aria-label={t('markKnown')}
          >
            ✓
          </button>
          <span className="known-help" tabIndex={0} aria-label={t('markKnownHint')}>
            <span className="known-help-icon" aria-hidden="true">ⓘ</span>
            <span className="known-help-tooltip" role="tooltip">
              {t('markKnownHint')}
            </span>
          </span>
        </div>
      )}
      <div className="game-card-actions">
        {canSpeak && (
          <button
            className="speaker-btn"
            onClick={() => speakEnglishWord(englishWord!)}
            type="button"
            aria-label={t('speakWord')}
            title={t('speakWord')}
          >
            🔊
          </button>
        )}
        <button
          className="star-btn"
          onClick={onToggleList}
          aria-label={inMyList ? t('removeFromList') : t('addToList')}
          title={inMyList ? t('removeFromList') : t('addToList')}
        >
          {inMyList ? '⭐' : '☆'}
        </button>
      </div>
      {children}
    </div>
  );
}

interface GameModeBase {
  inMyList: boolean;
  onToggleList: () => void;
  onMarkKnown?: () => void;
}

interface FlashMatchProps extends GameModeBase {
  word: Word;
  options: string[];
  correctOption: string;
  onAnswer: (correct: boolean) => void;
  promptHebrew?: boolean;
}

export function FlashMatch({
  word,
  options,
  correctOption,
  onAnswer,
  inMyList,
  onToggleList,
  onMarkKnown,
  promptHebrew = false,
}: FlashMatchProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  function handleSelect(option: string) {
    if (selected) return;
    setSelected(option);
    const correct = option === correctOption;
    setFeedback(correct ? 'correct' : 'wrong');
    setTimeout(() => onAnswer(correct), 1200);
  }

  return (
    <GameCard
      inMyList={inMyList}
      onToggleList={onToggleList}
      onMarkKnown={onMarkKnown}
      englishWord={word.entry}
    >
      <div className="game-word">
        {promptHebrew ? (
          <div className="game-word-he">{word.translate}</div>
        ) : (
          <>
            <div className="game-word-en">{word.entry}</div>
            {word.pos && <div className="game-word-pos">({word.pos})</div>}
          </>
        )}
      </div>
      {feedback && (
        <div className={`feedback-banner ${feedback}`}>
          {feedback === 'correct'
            ? t('correct')
            : t('correctAnswer', { answer: correctOption })}
        </div>
      )}
      <div className="options-grid">
        {options.map((opt, idx) => (
          <button
            key={`${opt}-${idx}`}
            className={`option-card${
              selected
                ? opt === correctOption
                  ? ' correct'
                  : opt === selected
                    ? ' wrong'
                    : ''
                : ''
            }`}
            onClick={() => handleSelect(opt)}
            disabled={!!selected}
          >
            {opt}
          </button>
        ))}
      </div>
    </GameCard>
  );
}
