import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { BottomNav, Header } from '../components/Layout';
import { searchWords, getWordById, getMasteryPercent } from '../lib/words';
import { getWordProgress, toggleMyList, toggleKnownWord, isWordKnown, getActiveVocabulary, getVocabState } from '../lib/progress';
import { vocabularyDashboardPath } from '../lib/homeNav';

export function MyListPage() {
  const { t } = useTranslation();
  const { userData, updateData } = useApp();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  if (!userData) return null;

  const vocabularyId = getActiveVocabulary(userData);
  const vocabState = getVocabState(userData, vocabularyId);

  const listWords = vocabState.myList
    .map((id) => getWordById(id, vocabularyId))
    .filter(Boolean)
    .sort((a, b) => a!.entry.localeCompare(b!.entry));

  const searchResults = adding ? searchWords(search, vocabularyId, 30) : [];

  async function handleToggle(wordId: number) {
    if (!userData) return;
    await updateData(toggleMyList(userData, wordId, vocabularyId));
  }

  const dashboardPath = vocabularyDashboardPath(vocabularyId);

  return (
    <div className="app-shell">
      <Header title={t('myList')} backTo={dashboardPath} />
      <main className="page page-full">
        {listWords.length > 0 && (
          <Link
            to="/practice/mylist"
            state={{ vocabularyId, returnTo: dashboardPath }}
            className="btn btn-primary"
            style={{ textDecoration: 'none', display: 'block', textAlign: 'center', marginBottom: 12 }}
          >
            {t('practiceMyList')}
          </Link>
        )}
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
              searchResults.map((word) => {
                const inList = vocabState.myList.includes(word.id);
                const known = isWordKnown(userData, word.id, vocabularyId);
                return (
                  <div className="word-list-item" key={word.id}>
                    <div className="word-list-main">
                      <div className="word-list-en">{word.entry}</div>
                      <div className="word-list-he">{word.translate}</div>
                      <div className="word-list-meta">{word.band}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!known && (
                        <button
                          className="icon-btn known-add"
                          onClick={() => userData && updateData(toggleKnownWord(userData, word.id, vocabularyId))}
                          title={t('markKnown')}
                        >
                          ✓
                        </button>
                      )}
                      <button
                        className={`icon-btn${inList ? ' active' : ''}`}
                        onClick={() => handleToggle(word.id)}
                      >
                        {inList ? '⭐' : '+'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="card">
          {listWords.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <p>{t('myListEmpty')}</p>
            </div>
          ) : (
            listWords.map((word) => {
              if (!word) return null;
              const progress = getWordProgress(userData, word.id, vocabularyId);
              return (
                <div className="word-list-item" key={word.id}>
                  <div className="word-list-main">
                    <div className="word-list-en">{word.entry}</div>
                    <div className="word-list-he">{word.translate}</div>
                    <div className="word-list-meta">
                      {word.band} · {getMasteryPercent(progress)}%
                    </div>
                  </div>
                  <button
                    className="icon-btn danger"
                    onClick={() => handleToggle(word.id)}
                    aria-label={t('remove')}
                  >
                    −
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
