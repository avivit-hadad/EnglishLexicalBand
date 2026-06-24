import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LessonSlot } from '../lib/weekPlan';

interface LessonProgressGridProps {
  slots: LessonSlot[];
  returnTo?: string;
  viewBatchIndex?: number;
}

export function LessonProgressGrid({ slots, returnTo = '/', viewBatchIndex }: LessonProgressGridProps) {
  const { t } = useTranslation();

  return (
    <div className="lesson-progress">
      <div className="lesson-grid" role="list">
        {slots.map((slot) => {
          const className = `lesson-tile lesson-tile-${slot.status}`;
          const label = t('lessonTileLabel', { number: slot.number });

          if (slot.status === 'locked') {
            return (
              <div
                key={slot.index}
                className={className}
                role="listitem"
                aria-label={label}
                aria-disabled
                title={t('lessonLocked')}
              >
                <div className="lesson-tile-locked-content">
                  <span className="lesson-tile-lock-icon" aria-hidden="true">
                    🔒
                  </span>
                  <span className="lesson-tile-number">{slot.number}</span>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={slot.index}
              to="/practice/daily"
              state={{
                lessonDayIndex: slot.index,
                startAtLearn: true,
                returnTo,
                viewBatchIndex,
              }}
              className={className}
              role="listitem"
              aria-label={label}
              title={label}
            >
              <span className="lesson-tile-number">{slot.number}</span>
              {slot.status === 'completed' && (
                <span className="lesson-tile-badge" aria-hidden="true">
                  ✓
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
