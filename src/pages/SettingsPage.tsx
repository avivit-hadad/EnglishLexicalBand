import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { BottomNav, Header } from '../components/Layout';
import { setUiLanguage } from '../i18n';
import { scheduleReminder } from '../lib/session';
import type { UserData } from '../types';

export function SettingsPage() {
  const { t } = useTranslation();
  const { userData, updateData, logout } = useApp();
  const navigate = useNavigate();

  if (!userData) return null;

  async function updateProfile(patch: Partial<UserData['profile']>) {
    if (!userData) return;
    const updated: UserData = { ...userData, profile: { ...userData.profile, ...patch } };
    if (patch.uiLanguage) setUiLanguage(patch.uiLanguage);
    await updateData(updated);
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <Header title={t('settings')} />
      <main className="page">
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>{t('uiLanguage')}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['he', 'en'] as const).map((lang) => (
              <button
                key={lang}
                className={`btn btn-sm${userData.profile.uiLanguage === lang ? ' btn-secondary' : ' btn-ghost'}`}
                style={{ flex: 1 }}
                onClick={() => updateProfile({ uiLanguage: lang })}
              >
                {lang === 'he' ? t('hebrew') : t('english')}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="setting-row">
            <label>{t('reminderOn')}</label>
            <button
              className={`toggle${userData.profile.reminderEnabled ? ' on' : ''}`}
              onClick={() => {
                const enabled = !userData.profile.reminderEnabled;
                updateProfile({ reminderEnabled: enabled });
                scheduleReminder(userData.profile.reminderTime, enabled);
              }}
              aria-pressed={userData.profile.reminderEnabled}
            />
          </div>
          {userData.profile.reminderEnabled && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>{t('reminderTime')}</label>
              <input
                className="form-input"
                type="time"
                value={userData.profile.reminderTime}
                onChange={(e) => {
                  updateProfile({ reminderTime: e.target.value });
                  scheduleReminder(e.target.value, true);
                }}
              />
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 8 }}>{t('sessionLength')}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {([10, 15] as const).map((m) => (
              <button
                key={m}
                className={`btn btn-sm${userData.profile.sessionMinutes === m ? ' btn-secondary' : ' btn-ghost'}`}
                style={{ flex: 1 }}
                onClick={() => updateProfile({ sessionMinutes: m })}
              >
                {m === 10 ? t('minutes10') : t('minutes15')}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 8 }}>{t('account')}</h3>
          <div className="stat-row">
            <span>{t('name')}</span>
            <span>{userData.profile.name}</span>
          </div>
          <button className="btn btn-outline mt-12" onClick={handleLogout}>
            {t('signOut')}
          </button>
        </div>

        <div className="install-banner">
          <strong>{t('installHint')}</strong>
          {t('installSteps')}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
