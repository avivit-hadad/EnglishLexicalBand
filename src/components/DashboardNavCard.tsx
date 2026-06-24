import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface DashboardNavCardProps {
  to: string;
  title: string;
  icon: string;
  count: number;
}

export function DashboardNavCard({ to, title, icon, count }: DashboardNavCardProps) {
  const { t } = useTranslation();

  return (
    <Link to={to} className="dashboard-nav-card">
      <span className="dashboard-nav-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="dashboard-nav-body">
        <span className="dashboard-nav-title">{title}</span>
        <span className="dashboard-nav-count">{t('wordListCount', { count })}</span>
      </span>
      <span className="dashboard-nav-arrow" aria-hidden="true">
        {document.documentElement.dir === 'rtl' ? '←' : '→'}
      </span>
    </Link>
  );
}
