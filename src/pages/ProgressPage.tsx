import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { BottomNav, Header } from '../components/Layout';
import { getVocabularyProgressStats } from '../lib/progress';
import { getLessonProgressStats } from '../lib/weekPlan';
import type { VocabularyId } from '../types';

const VOCABULARY_IDS: VocabularyId[] = ['elementary', 'middle'];

function vocabularyTitle(t: (key: string) => string, vocabularyId: VocabularyId): string {
  return vocabularyId === 'elementary' ? t('vocabularyElementary') : t('vocabularyMiddle');
}

export function ProgressPage() {
  const { t } = useTranslation();
  const { userData } = useApp();

  if (!userData) return null;

  return (
    <div className="app-shell">
      <Header title={t('progress')} />
      <main className="page">
        {VOCABULARY_IDS.map((vocabularyId) => {
          const lessonStats = getLessonProgressStats(userData, vocabularyId);
          const wordStats = getVocabularyProgressStats(userData, vocabularyId);

          return (
            <section key={vocabularyId} className="progress-section">
              <h2 className="progress-section-title">{vocabularyTitle(t, vocabularyId)}</h2>
              <table className="progress-table">
                <tbody>
                  <tr>
                    <th scope="row">{t('progressLessons')}</th>
                    <td>
                      {t('lessonsCompletedCount', {
                        completed: lessonStats.completedLessons,
                        total: lessonStats.totalLessons,
                      })}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t('learnedWordsSoFar')}</th>
                    <td>{wordStats.learned}</td>
                  </tr>
                  <tr>
                    <th scope="row">{t('myList')}</th>
                    <td>{wordStats.toPractice}</td>
                  </tr>
                  <tr>
                    <th scope="row">{t('knownWords')}</th>
                    <td>{wordStats.known}</td>
                  </tr>
                  <tr>
                    <th scope="row">{t('progressTotalSoFar')}</th>
                    <td>{wordStats.totalSoFar}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          );
        })}
      </main>
      <BottomNav />
    </div>
  );
}
