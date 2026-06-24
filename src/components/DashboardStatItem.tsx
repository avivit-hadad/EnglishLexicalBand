import { useTranslation } from 'react-i18next';

interface DashboardStatItemProps {
  title: string;
  icon: string;
  count: number;
}

export function DashboardStatItem({ title, icon, count }: DashboardStatItemProps) {
  const { t } = useTranslation();

  return (
    <div className="dashboard-stat-item">
      <span className="dashboard-nav-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="dashboard-nav-body">
        <span className="dashboard-nav-title">{title}</span>
        <span className="dashboard-nav-count">{t('wordListCount', { count })}</span>
      </span>
    </div>
  );
}
