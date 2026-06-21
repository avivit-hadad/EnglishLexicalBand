import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { BottomNav, Header } from '../components/Layout';
import { SessionWordList } from '../components/SessionWordList';
import { getSessionWordBreakdown } from '../lib/progress';

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useTranslation();
  const { userData } = useApp();
  const navigate = useNavigate();

  if (!userData || !sessionId) return null;

  const session =
    userData.elementary.sessions.find((s) => s.id === sessionId) ??
    userData.middle.sessions.find((s) => s.id === sessionId);

  if (!session) {
    return (
      <div className="app-shell">
        <Header title={t('sessionDetail')} backTo="/progress" />
        <main className="page">
          <div className="empty-state">
            <p>{t('sessionNotFound')}</p>
            <Link to="/progress" className="btn btn-primary mt-12" style={{ textDecoration: 'none' }}>
              {t('backToProgress')}
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const { knownWords, missedWords, hasBreakdown } = getSessionWordBreakdown(session);

  const date = new Date(session.startedAt);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  function startPractice(wordIds: number[]) {
    if (wordIds.length === 0 || !session) return;
    navigate('/practice/custom', {
      state: {
        wordIds,
        returnTo: `/progress/session/${sessionId}`,
        vocabularyId: session.vocabularyId,
      },
    });
  }

  return (
    <div className="app-shell">
      <Header title={t('sessionDetail')} backTo="/progress" />
      <main className="page session-summary-page">
        <div className="card">
          <div className="stat-row">
            <span>{t('sessionDate')}</span>
            <span>{dateStr} {timeStr}</span>
          </div>
          <div className="stat-row">
            <span>{t('sessionType')}</span>
            <span>{session.type === 'mylist' ? t('myListOnly') : t('dailyPractice')}</span>
          </div>
          <div className="stat-row">
            <span>{t('sessionDuration')}</span>
            <span>{Math.max(1, Math.round(session.durationSec / 60))} {t('minutesShort')}</span>
          </div>
          <div className="stat-row">
            <span>{t('wordsPracticed', { count: session.wordsCount })}</span>
            <span>+{session.score} XP</span>
          </div>
        </div>

        {!hasBreakdown && knownWords.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: 4 }}>{t('sessionWords')}</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
              {knownWords.length} {t('wordsShort')} · {t('sessionWordsBreakdownUnavailable')}
            </p>
            <div className="word-table-header">
              <span>{t('wordEnglish')}</span>
              <span>{t('wordHebrew')}</span>
            </div>
            <div className="session-word-list">
              {knownWords.map((word) => (
                <div className="session-word-row" key={word.id}>
                  <span className="session-word-en">{word.entry}</span>
                  <span className="session-word-he">{word.translate}</span>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary mt-12"
              type="button"
              onClick={() => startPractice(knownWords.map((w) => w.id))}
            >
              {t('practiceAllSessionWords')}
            </button>
          </div>
        )}

        {hasBreakdown && (
          <div className="session-summary-lists">
            <SessionWordList words={knownWords} variant="known" />
            <SessionWordList words={missedWords} variant="missed" />
          </div>
        )}

        {hasBreakdown && (knownWords.length > 0 || missedWords.length > 0) && (
          <div className="session-summary-actions">
            {missedWords.length > 0 && (
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => startPractice(missedWords.map((w) => w.id))}
              >
                {t('recheckMissed')}
              </button>
            )}
            {(knownWords.length > 0 || missedWords.length > 0) && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  startPractice([...knownWords, ...missedWords].map((w) => w.id))
                }
              >
                {t('practiceAllSessionWords')}
              </button>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
