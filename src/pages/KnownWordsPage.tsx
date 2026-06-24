import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { BottomNav, Header } from '../components/Layout';
import { searchWords, getWordById } from '../lib/words';
import { toggleKnownWord, isWordKnown, getActiveVocabulary, getVocabState } from '../lib/progress';
import { vocabularyDashboardPath } from '../lib/homeNav';

export function KnownWordsPage() {
  const { t } = useTranslation();
  const { userData, updateData } = useApp();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  if (!userData) return null;

  const vocabularyId = getActiveVocabulary(userData);
  const vocabState = getVocabState(userData, vocabularyId);
  const knownWords = vocabState.knownWords
    .map((id) => getWordById(id, vocabularyId))
    .filter(Boolean)
    .sort((a, b) => a!.entry.localeCompare(b!.entry));

  const searchResults = adding
    ? searchWords(search, vocabularyId, 30).filter((w) => !isWordKnown(userData, w.id, vocabularyId))
    : [];

  async function handleToggle(wordId: number) {
    if (!userData) return;
    await updateData(toggleKnownWord(userData, wordId));
  }

  return (
    <div className="app-shell">
      <Header title={t('knownWords')} backTo={vocabularyDashboardPath(vocabularyId)} />
      <main className="page page-full">
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
          {t('knownWordsHint')}
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            className="form-input"
            style={{ flex: 1, minHeight: 44 }}
            placeholder={t('searchWords')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setAdding(true);
            }}
            onFocus={() => setAdding(true)}
          />
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: 'auto', minWidth: 44 }}
            onClick={() => setAdding(!adding)}
          >
            {adding ? '✕' : '+'}
          </button>
        </div>

        {adding && search && (
          <div className="card" style={{ marginBottom: 12 }}>
            {searchResults.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>...</p>
            ) : (
              searchResults.map((word) => (
                <div className="word-list-item" key={word.id}>
                  <div className="word-list-main">
                    <div className="word-list-en">{word.entry}</div>
                    <div className="word-list-he">{word.translate}</div>
                    <div className="word-list-meta">{word.band}</div>
                  </div>
                  <button className="icon-btn known-add" onClick={() => handleToggle(word.id)}>
                    ✓
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <div className="card known-card">
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
            {t('knownWordsCount', { count: knownWords.length })}
          </p>
          {knownWords.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <p>{t('knownWordsEmpty')}</p>
            </div>
          ) : (
            knownWords.map((word) => {
              if (!word) return null;
              return (
                <div className="word-list-item" key={word.id}>
                  <div className="word-list-main">
                    <div className="word-list-en">{word.entry}</div>
                    <div className="word-list-he">{word.translate}</div>
                    <div className="word-list-meta">{word.band}</div>
                  </div>
                  <button
                    className="icon-btn danger"
                    onClick={() => handleToggle(word.id)}
                    aria-label={t('unmarkKnown')}
                  >
                    {t('unmarkKnown')}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
