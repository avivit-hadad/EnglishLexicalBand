import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Word } from '../types';
import { shuffle } from '../lib/words';

interface MatchDragDropProps {
  words: Word[];
  onComplete: () => void;
}

export function MatchDragDrop({ words, onComplete }: MatchDragDropProps) {
  const { t } = useTranslation();
  const hebrewSlots = useMemo(() => shuffle([...words]), [words]);

  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [wrongPair, setWrongPair] = useState<{ en: number; he: number } | null>(null);

  const englishWords = useMemo(
    () => [...words].sort((a, b) => a.entry.localeCompare(b.entry)),
    [words]
  );

  const unmatchedEnglish = englishWords.filter((w) => !matched.has(w.id));
  const doneCount = matched.size;

  function tryMatch(englishId: number, hebrewWordId: number) {
    if (matched.has(englishId) || matched.has(hebrewWordId)) return;

    if (englishId === hebrewWordId) {
      const next = new Set(matched);
      next.add(englishId);
      setMatched(next);
      setSelectedId(null);
      setDraggingId(null);
      if (next.size === words.length) {
        setTimeout(onComplete, 700);
      }
      return;
    }

    setWrongPair({ en: englishId, he: hebrewWordId });
    setSelectedId(null);
    setDraggingId(null);
    setTimeout(() => setWrongPair(null), 700);
  }

  function handleEnglishTap(wordId: number) {
    if (matched.has(wordId)) return;
    setSelectedId((prev) => (prev === wordId ? null : wordId));
  }

  function handleHebrewTap(hebrewWordId: number) {
    if (matched.has(hebrewWordId)) return;
    if (selectedId !== null) {
      tryMatch(selectedId, hebrewWordId);
    }
  }

  function handleDragStart(wordId: number) {
    if (matched.has(wordId)) return;
    setDraggingId(wordId);
    setSelectedId(wordId);
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  function handleDrop(hebrewWordId: number, event: React.DragEvent) {
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    const englishId = Number(raw);
    if (!Number.isFinite(englishId)) return;
    tryMatch(englishId, hebrewWordId);
  }

  return (
    <div className="match-drag">
      <p className="match-drag-hint">{t('matchDragHint')}</p>
      <p className="match-drag-progress">
        {t('matchDragProgress', { done: doneCount, total: words.length })}
      </p>

      <div className="match-drag-board">
        <div className="match-drag-column">
          <h3 className="match-drag-heading">{t('wordEnglish')}</h3>
          <ul className="match-drag-list">
            {unmatchedEnglish.map((word) => {
              const isSelected = selectedId === word.id;
              const isDragging = draggingId === word.id;
              const isWrong = wrongPair?.en === word.id;

              return (
                <li key={word.id}>
                  <button
                    type="button"
                    className={`match-drag-chip match-drag-chip-en${isSelected ? ' selected' : ''}${isDragging ? ' dragging' : ''}${isWrong ? ' wrong' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(word.id));
                      e.dataTransfer.effectAllowed = 'move';
                      handleDragStart(word.id);
                    }}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleEnglishTap(word.id)}
                  >
                    <span dir="ltr">{word.entry}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="match-drag-column">
          <h3 className="match-drag-heading">{t('wordHebrew')}</h3>
          <ul className="match-drag-list">
            {hebrewSlots.map((word) => {
              const isMatched = matched.has(word.id);
              const isWrongTarget = wrongPair?.he === word.id;
              const pairedEnglish = isMatched
                ? englishWords.find((w) => w.id === word.id)
                : null;

              return (
                <li key={word.id}>
                  <div
                    className={`match-drag-drop${isMatched ? ' matched' : ''}${isWrongTarget ? ' wrong' : ''}${selectedId !== null && !isMatched ? ' drop-ready' : ''}`}
                    onDragOver={(e) => {
                      if (!isMatched) e.preventDefault();
                    }}
                    onDrop={(e) => handleDrop(word.id, e)}
                    onClick={() => handleHebrewTap(word.id)}
                    role="button"
                    tabIndex={isMatched ? -1 : 0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleHebrewTap(word.id);
                      }
                    }}
                  >
                    <span className="match-drag-he" dir="rtl">
                      {word.translate}
                    </span>
                    {pairedEnglish && (
                      <span className="match-drag-paired" dir="ltr">
                        ✓ {pairedEnglish.entry}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {doneCount === words.length && (
        <p className="match-drag-done">{t('matchDragComplete')}</p>
      )}

      <button type="button" className="btn btn-secondary match-drag-skip" onClick={onComplete}>
        {t('skipMatching')}
      </button>
    </div>
  );
}
