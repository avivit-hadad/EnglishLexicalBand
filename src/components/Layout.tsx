import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function BottomNav() {
  const { t } = useTranslation();

  const tabs = [
    { to: '/', icon: '🏠', label: t('home') },
    { to: '/progress', icon: '📊', label: t('progress') },
    { to: '/settings', icon: '⚙️', label: t('settings') },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          end={tab.to === '/'}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function Header({
  title,
  backTo,
  onBack,
}: {
  title: string;
  backTo?: string;
  onBack?: () => void;
}) {
  const backArrow = document.documentElement.dir === 'rtl' ? '→' : '←';

  return (
    <header className="header">
      {onBack ? (
        <button type="button" className="header-back" onClick={onBack} aria-label="Back">
          {backArrow}
        </button>
      ) : backTo ? (
        <NavLink to={backTo} className="header-back">
          {backArrow}
        </NavLink>
      ) : (
        <span style={{ width: 44 }} />
      )}
      <h1>{title}</h1>
      <span style={{ width: 44 }} />
    </header>
  );
}
