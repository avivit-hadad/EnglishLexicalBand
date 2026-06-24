import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { BottomNav, Header } from '../components/Layout';
import { getLearnedWords, getActiveVocabulary } from '../lib/progress';
import { vocabularyDashboardPath } from '../lib/homeNav';

export function LearnedWordsPage() {
  const { t } = useTranslation();
  const { userData } = useApp();

  if (!userData) return null;

  const vocabularyId = getActiveVocabulary(userData);
  const words = getLearnedWords(userData, vocabularyId);

  return (
    <div className="app-shell">
      <Header title={t('learnedWordsSoFar')} backTo={vocabularyDashboardPath(vocabularyId)} />
      <main className="page page-full">
        <p className="word-list-page-hint">{t('learnedWordsHint')}</p>

        {words.length === 0 ? (
          <div className="empty-state">
            <p>{t('learnedWordsEmpty')}</p>
          </div>
        ) : (
          <div className="card word-list-page-card">
            <p className="word-list-page-count">{t('wordListCount', { count: words.length })}</p>
            <div className="word-table-header dashboard-word-table-header">
              <span>{t('wordEnglish')}</span>
              <span>{t('wordHebrew')}</span>
            </div>
            <div className="word-list-page-rows">
              {words.map((word) => (
                <div className="dashboard-word-row" key={word.id}>
                  <span className="dashboard-word-en">{word.entry}</span>
                  <span className="dashboard-word-he">{word.translate}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
