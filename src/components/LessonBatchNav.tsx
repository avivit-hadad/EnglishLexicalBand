import { useTranslation } from 'react-i18next';
import { getGlobalLessonNumberForBatch, WORK_DAYS_PER_WEEK } from '../lib/weekPlan';

interface LessonBatchNavProps {
  viewingBatch: number;
  currentBatch: number;
  onChange: (batch: number) => void;
}

export function LessonBatchNav({ viewingBatch, currentBatch, onChange }: LessonBatchNavProps) {
  const { t } = useTranslation();
  const firstLesson = getGlobalLessonNumberForBatch(viewingBatch, 0);
  const lastLesson = getGlobalLessonNumberForBatch(viewingBatch, WORK_DAYS_PER_WEEK - 1);

  return (
    <div className="lesson-batch-nav" dir="ltr">
      <button
        type="button"
        className="lesson-batch-arrow"
        disabled={viewingBatch >= currentBatch}
        onClick={() => onChange(viewingBatch + 1)}
        aria-label={t('nextLessonBatch')}
      >
        ‹
      </button>
      <span className="lesson-batch-label" dir="auto">
        {t('lessonBatchRange', { from: firstLesson, to: lastLesson })}
        {viewingBatch < currentBatch && (
          <span className="lesson-batch-past">{t('lessonBatchPast')}</span>
        )}
      </span>
      <button
        type="button"
        className="lesson-batch-arrow"
        disabled={viewingBatch <= 0}
        onClick={() => onChange(viewingBatch - 1)}
        aria-label={t('previousLessonBatch')}
      >
        ›
      </button>
    </div>
  );
}
