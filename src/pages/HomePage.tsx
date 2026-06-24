import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { BottomNav } from '../components/Layout';
import { getBandProgress, getActiveVocabulary, getVocabState } from '../lib/progress';
import { getWeekProgressSummary } from '../lib/weekPlan';
import { getBands } from '../lib/vocabulary';
import type { VocabularyId } from '../types';

function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const ELEMENTARY_BAND_KEYS = ['bandPre', 'bandCore1', 'bandCore2'] as const;
const MIDDLE_BAND_KEYS = ['bandMiddle1', 'bandMiddle2', 'bandMiddle3'] as const;
const BAND_CLASSES = ['pre', 'core1', 'core2'] as const;

export function HomePage() {
  const { t } = useTranslation();
  const { userData, setActiveVocabulary } = useApp();
  const [showInstall, setShowInstall] = useState(
    () => !localStorage.getItem('lexical_band_install_dismissed')
  );

  if (!userData) return null;

  const activeVocabulary = getActiveVocabulary(userData);
  const vocabState = getVocabState(userData, activeVocabulary);
  const week = getWeekProgressSummary(userData, activeVocabulary);
  const name = userData.profile.name;
  const myListCount = vocabState.myList.length;
  const notPracticedToday = vocabState.myList.filter(
    (id) => !vocabState.myListPracticedToday.includes(id)
  ).length;

  const bandKeys = activeVocabulary === 'elementary' ? ELEMENTARY_BAND_KEYS : MIDDLE_BAND_KEYS;
  const bands = getBands(activeVocabulary).map((band, i) => ({
    key: bandKeys[i],
    band,
    cls: BAND_CLASSES[i] ?? 'core2',
  }));

  async function selectVocabulary(vocabularyId: VocabularyId) {
    await setActiveVocabulary(vocabularyId);
  }

  const dailyDisabled = !week.moreLessonsAvailable || week.todaysNewCount === 0;

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <div className="greeting">
            {t('greeting', { time: t(getGreetingKey()), name })}
          </div>
          <div className="streak-badge">🔥 {t('streak', { count: userData.streak.currentStreak })}</div>
        </div>
      </header>

      <main className="page">
        {showInstall && (
          <div className="install-banner">
            <strong>{t('installHint')}</strong>
            {t('installSteps')}
            <button
              style={{ float: 'inline-end', marginTop: 4, fontSize: '0.75rem' }}
              onClick={() => {
                localStorage.setItem('lexical_band_install_dismissed', '1');
                setShowInstall(false);
              }}
            >
              ✕
            </button>
          </div>
        )}

        <div className="vocabulary-picker">
          <button
            type="button"
            className={`vocabulary-card${activeVocabulary === 'elementary' ? ' selected' : ''}`}
            onClick={() => selectVocabulary('elementary')}
          >
            <span className="vocabulary-card-icon">📘</span>
            <span className="vocabulary-card-title">{t('vocabularyElementary')}</span>
          </button>
          <button
            type="button"
            className={`vocabulary-card${activeVocabulary === 'middle' ? ' selected' : ''}`}
            onClick={() => selectVocabulary('middle')}
          >
            <span className="vocabulary-card-icon">📗</span>
            <span className="vocabulary-card-title">{t('vocabularyMiddle')}</span>
          </button>
        </div>

        <p className="vocabulary-active-label">
          {activeVocabulary === 'elementary' ? t('vocabularyElementary') : t('vocabularyMiddle')}
        </p>

        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>{t('weekPlanTitle')}</h3>
          <div className="daily-breakdown">
            <div className="daily-breakdown-row">
              <span className="daily-breakdown-label">{t('weekDayLabel', { day: week.schoolDayLabel, total: 5 })}</span>
              <strong>{week.completedDays}/5</strong>
            </div>
            <div className="daily-breakdown-row">
              <span className="daily-breakdown-label">🆕 {t('newWordsToday')}</span>
              <strong>{week.todaysNewCount}</strong>
            </div>
            <div className="daily-breakdown-row">
              <span className="daily-breakdown-label">📚 {t('weekTotalWords')}</span>
              <strong>{week.weekTotal}</strong>
            </div>
            <div className="daily-breakdown-row">
              <span className="daily-breakdown-label">🔁 {t('cumulativeWeekWords')}</span>
              <strong>{week.cumulativeCount}</strong>
            </div>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 12 }}>
            {t('wordsPerDaySetting', { count: week.wordsPerDay })}
          </p>

          <Link
            to="/practice/daily"
            className={`btn btn-primary mt-12${dailyDisabled ? ' disabled' : ''}`}
            style={{
              textDecoration: 'none',
              display: 'block',
              textAlign: 'center',
              opacity: dailyDisabled ? 0.5 : 1,
              pointerEvents: dailyDisabled ? 'none' : 'auto',
            }}
          >
            {week.dailyDoneToday
              ? t('weekLessonsComplete')
              : week.completedDays > 0
                ? t('continueNextLessonHome', {
                    day: week.nextLessonDay !== null ? week.nextLessonDay + 1 : week.schoolDayLabel,
                    count: week.todaysNewCount,
                  })
                : t('startDaily')}
          </Link>

          {week.cumulativeCount > 0 && (
            <Link
              to="/practice/review"
              className="btn btn-secondary mt-12"
              style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}
            >
              {t('startWeekReview', { count: week.cumulativeCount })}
            </Link>
          )}

          {week.examAvailable && !week.examCompleted && (
            <Link
              to="/practice/exam"
              className="btn btn-secondary mt-12"
              style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}
            >
              {t('startWeekExam', { count: week.weekTotal })}
            </Link>
          )}

          {week.examCompleted && (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-success)', marginTop: 12, textAlign: 'center' }}>
              ✓ {t('weekExamDone')}
            </p>
          )}
        </div>

        <div className="card mylist-card">
          <h3 style={{ marginBottom: 8 }}>⭐ {t('myList')}</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
            {t('myListCount', { count: myListCount })}
            {myListCount > 0 && (
              <> · {t('myListNotToday', { count: notPracticedToday })}</>
            )}
          </p>
          <div className="flex-gap">
            <Link
              to="/practice/mylist"
              className={`btn btn-secondary${myListCount === 0 ? ' disabled' : ''}`}
              style={{
                textDecoration: 'none',
                opacity: myListCount === 0 ? 0.5 : 1,
                pointerEvents: myListCount === 0 ? 'none' : 'auto',
              }}
            >
              {t('practiceMyList')}
            </Link>
            <Link to="/mylist" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              {t('manageList')} →
            </Link>
          </div>
        </div>

        <div className="card known-card">
          <h3 style={{ marginBottom: 8 }}>✓ {t('knownWords')}</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
            {t('knownWordsCount', { count: vocabState.knownWords.length })}
          </p>
          <Link to="/known" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            {t('manageKnown')} →
          </Link>
        </div>

        <div className="card">
          {bands.map(({ key, band, cls }) => (
            <div className="progress-bar-wrap" key={band}>
              <div className="progress-label">
                <span>{t(key)}</span>
                <span>{getBandProgress(userData, band, activeVocabulary)}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-fill ${cls}`}
                  style={{ width: `${getBandProgress(userData, band, activeVocabulary)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="progress-label">
            <span>{t('weekProgressLabel')}</span>
            <span>
              {week.completedDays}/5 {t('daysShort')}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill goal"
              style={{ width: `${(week.completedDays / 5) * 100}%` }}
            />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
