import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { BottomNav } from '../components/Layout';
import { LessonProgressGrid } from '../components/LessonProgressGrid';
import { LessonBatchNav } from '../components/LessonBatchNav';
import { DashboardNavCard } from '../components/DashboardNavCard';
import { DashboardStatItem } from '../components/DashboardStatItem';
import { getVocabState, getLearnedWordIds, getProgressWordTotal } from '../lib/progress';
import { getLessonSlots, getWordsPerDay, getCurrentBatchIndex } from '../lib/weekPlan';
import { parseVocabularyId, vocabularyDashboardPath } from '../lib/homeNav';

export function VocabularyDashboardPage() {
  const { t } = useTranslation();
  const { userData, setActiveVocabulary } = useApp();
  const { vocabularyId: vocabParam } = useParams<{ vocabularyId: string }>();
  const vocabularyId = parseVocabularyId(vocabParam);
  const currentBatchIndex =
    userData && vocabularyId ? getCurrentBatchIndex(userData, vocabularyId) : 0;
  const [viewingBatch, setViewingBatch] = useState(0);

  useEffect(() => {
    if (vocabularyId) setActiveVocabulary(vocabularyId);
  }, [vocabularyId, setActiveVocabulary]);

  useEffect(() => {
    if (vocabularyId) setViewingBatch(currentBatchIndex);
  }, [vocabularyId]);

  useEffect(() => {
    setViewingBatch((prev) => Math.min(prev, currentBatchIndex));
  }, [currentBatchIndex]);

  if (!userData) return null;
  if (!vocabularyId) return <Navigate to="/" replace />;

  const vocabState = getVocabState(userData, vocabularyId);
  const lessonSlots = getLessonSlots(userData, vocabularyId, viewingBatch);
  const wordsPerDay = getWordsPerDay(userData);
  const learnedCount = getLearnedWordIds(userData, vocabularyId).length;
  const myListCount = vocabState.myList.length;
  const knownCount = vocabState.knownWords.length;
  const totalSoFar = getProgressWordTotal(userData, vocabularyId);
  const dashboardPath = vocabularyDashboardPath(vocabularyId);
  const dashboardTitle =
    vocabularyId === 'elementary' ? t('vocabularyElementary') : t('vocabularyMiddle');

  return (
    <div className="app-shell">
      <header className="header">
        <Link to="/" className="header-back" aria-label={t('backToVocabularyPicker')}>
          {document.documentElement.dir === 'rtl' ? '→' : '←'}
        </Link>
        <h1>{dashboardTitle}</h1>
        <span style={{ width: 44 }} />
      </header>
      <main className="page">
        <div className="card lesson-progress-card">
          <div className="lesson-progress-header">
            <h3>{t('wordsPerDaySetting', { count: wordsPerDay })}</h3>
          </div>
          {currentBatchIndex > 0 && (
            <LessonBatchNav
              viewingBatch={viewingBatch}
              currentBatch={currentBatchIndex}
              onChange={setViewingBatch}
            />
          )}
          <LessonProgressGrid
            slots={lessonSlots}
            returnTo={dashboardPath}
            viewBatchIndex={viewingBatch}
          />        </div>

        <div className="dashboard-nav-list">
          <DashboardNavCard
            to="/learned"
            title={t('learnedWordsSoFar')}
            icon="📚"
            count={learnedCount}
          />
          <DashboardNavCard
            to="/mylist"
            title={t('myList')}
            icon="⭐"
            count={myListCount}
          />
          <DashboardNavCard
            to="/known"
            title={t('knownWords')}
            icon="✓"
            count={knownCount}
          />
          <DashboardStatItem
            icon="📖"
            title={t('progressTotalSoFar')}
            count={totalSoFar}
          />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const { userData } = useApp();
  const [privateNotice, setPrivateNotice] = useState(false);

  if (!userData) return null;

  return (
    <div className="app-shell">
      <main className="page vocabulary-picker-page">
        <h1 className="vocabulary-picker-title">{t('selectVocabulary')}</h1>
        <div className="vocabulary-picker-main">
          <Link
            to="/vocabulary/elementary"
            className="vocabulary-card vocabulary-card-large"
          >
            <span className="vocabulary-card-icon">📘</span>
            <span className="vocabulary-card-title">{t('vocabularyElementary')}</span>
          </Link>
          <Link
            to="/vocabulary/middle"
            className="vocabulary-card vocabulary-card-large"
          >
            <span className="vocabulary-card-icon">📗</span>
            <span className="vocabulary-card-title">{t('vocabularyMiddle')}</span>
          </Link>
          <button
            type="button"
            className="vocabulary-card vocabulary-card-large vocabulary-card-soon"
            onClick={() => setPrivateNotice(true)}
          >
            <span className="vocabulary-card-icon">📂</span>
            <span className="vocabulary-card-title">{t('vocabularyPrivate')}</span>
            <span className="vocabulary-card-subtitle">{t('comingSoon')}</span>
          </button>
        </div>
        {privateNotice && (
          <p className="vocabulary-picker-notice" role="status">
            {t('vocabularyPrivateComingSoon')}
          </p>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
