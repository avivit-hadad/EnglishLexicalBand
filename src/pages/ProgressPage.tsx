import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { BottomNav, Header } from '../components/Layout';
import {
  getWeeklyActivity,
  getAllSessions,
  getLearnedCount,
  getActiveVocabulary,
  getVocabState,
} from '../lib/progress';
import { getWordCount } from '../lib/vocabulary';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_LABELS_HE = ['ב', 'ג', 'ד', 'ה', 'ו', 'ש', 'א'];

export function ProgressPage() {
  const { t, i18n } = useTranslation();
  const { userData } = useApp();

  if (!userData) return null;

  const vocabularyId = getActiveVocabulary(userData);
  const vocabState = getVocabState(userData, vocabularyId);
  const weekly = getWeeklyActivity(userData, vocabularyId);
  const maxMin = Math.max(...weekly, 1);
  const learned = getLearnedCount(userData, vocabularyId);
  const totalWords = getWordCount(vocabularyId);
  const labels = i18n.language === 'he' ? DAY_LABELS_HE : DAY_LABELS;
  const sessions = getAllSessions(userData, vocabularyId);
  const vocabularyLabel =
    vocabularyId === 'elementary' ? t('vocabularyElementary') : t('vocabularyMiddle');

  return (
    <div className="app-shell">
      <Header title={t('progress')} />
      <main className="page">
        <p className="vocabulary-active-label">{vocabularyLabel}</p>

        <div className="card">
          <h3 style={{ marginBottom: 16 }}>{t('weeklyActivity')}</h3>
          <div className="chart-bars">
            {weekly.map((min, i) => (
              <div className="chart-bar-col" key={i}>
                <div
                  className="chart-bar"
                  style={{ height: `${Math.max(4, (min / maxMin) * 80)}px` }}
                  title={`${min} min`}
                />
                <span className="chart-label">{labels[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="stat-row">
            <span>{t('totalLearned')}</span>
            <strong>{learned} / {totalWords}</strong>
          </div>
          <div className="stat-row">
            <span>🔥 {t('streak', { count: userData.streak.currentStreak })}</span>
          </div>
          <div className="stat-row">
            <span>{t('longestStreak')}</span>
            <strong>{userData.streak.longestStreak}</strong>
          </div>
          <div className="stat-row">
            <span>{t('knownWords')}</span>
            <strong>{vocabState.knownWords.length}</strong>
          </div>
          <div className="stat-row">
            <span>{t('myList')}</span>
            <strong>{vocabState.myList.length}</strong>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>{t('sessionHistory')}</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
            {t('sessionHistoryHint')}
          </p>
          {sessions.slice(0, 20).map((s) => (
            <Link
              key={s.id}
              to={`/progress/session/${s.id}`}
              className="session-row"
            >
              <div className="session-row-main">
                <span className="session-row-date">
                  {s.type === 'mylist' ? '⭐' : '📅'}{' '}
                  {new Date(s.startedAt).toLocaleDateString()}{' '}
                  {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="session-row-meta">
                  {Math.round(s.durationSec / 60)} {t('minutesShort')} · {s.wordsCount} {t('wordsShort')}
                </span>
              </div>
              <span className="session-row-arrow">→</span>
            </Link>
          ))}
          {sessions.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 16 }}>
              {t('noSessionsYet')}
            </p>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
