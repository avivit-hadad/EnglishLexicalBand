import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { supabaseConfigured } from '../lib/auth';

export function LoginPage() {
  const { t } = useTranslation();
  const { login, register } = useApp();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(name, password);
      } else {
        await login(name, password);
      }
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('error');
      if (msg.toLowerCase().includes('already')) setError(t('nameExists'));
      else if (msg.toLowerCase().includes('invalid')) setError(t('invalidCredentials'));
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">📚 {t('appName')}</div>
      <p className="auth-sub">{isRegister ? t('createAccount') : t('signIn')}</p>
      {supabaseConfigured ? (
        <p className="auth-cloud-badge">{t('cloudAuthEnabled')}</p>
      ) : (
        <p className="auth-cloud-warning">{t('cloudAuthDisabled')}</p>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <p className="error-msg">{error}</p>}
        <div className="form-group">
          <label htmlFor="name">{t('name')}</label>
          <input
            id="name"
            className="form-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="username"
            autoCapitalize="words"
            spellCheck={false}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">{t('password')}</label>
          <div className="password-input-wrap">
            <input
              id="password"
              className="form-input password-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={1}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
          <p className="form-hint">{t('passwordHint')}</p>
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? t('loading') : isRegister ? t('signUp') : t('signIn')}
        </button>
      </form>
      <button
        className="auth-link"
        onClick={() => {
          setIsRegister(!isRegister);
          setError('');
        }}
        style={{ background: 'none', border: 'none', color: 'var(--color-primary-light)' }}
      >
        {isRegister ? t('haveAccount') : t('noAccount')}
      </button>
    </div>
  );
}

export function OnboardingPage() {
  const { t } = useTranslation();
  const { userData, updateData } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<'he' | 'en'>(userData?.profile.uiLanguage ?? 'he');
  const [reminderTime, setReminderTime] = useState(userData?.profile.reminderTime ?? '20:00');
  const [reminderEnabled, setReminderEnabled] = useState(userData?.profile.reminderEnabled ?? false);
  const [sessionMinutes, setSessionMinutes] = useState<10 | 15>(userData?.profile.sessionMinutes ?? 10);

  if (!userData) return null;

  async function finish() {
    if (!userData) return;
    const updated: typeof userData = {
      ...userData,
      profile: {
        ...userData.profile,
        uiLanguage: lang,
        reminderTime,
        reminderEnabled,
        sessionMinutes,
        onboarded: true,
      },
    };
    await updateData(updated);
    if (reminderEnabled) {
      const { scheduleReminder } = await import('../lib/session');
      scheduleReminder(reminderTime, true);
    }
    navigate('/');
  }

  return (
    <div className="app-shell">
      <main className="page page-full" style={{ paddingBottom: 32 }}>
        {step === 0 && (
          <div className="onboard-step">
            <h2>{t('chooseLanguage')}</h2>
            <div className="lang-cards">
              {(['he', 'en'] as const).map((l) => (
                <button
                  key={l}
                  className={`lang-card${lang === l ? ' selected' : ''}`}
                  onClick={() => setLang(l)}
                >
                  {l === 'he' ? `🇮🇱 ${t('hebrew')}` : `🇬🇧 ${t('english')}`}
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary mt-12"
              onClick={() => {
                import('../i18n').then(({ setUiLanguage }) => setUiLanguage(lang));
                setStep(1);
              }}
            >
              {t('next')}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="onboard-step">
            <h2>{t('dailyReminder')}</h2>
            <div className="card">
              <div className="setting-row">
                <label>{t('reminderOn')}</label>
                <button
                  className={`toggle${reminderEnabled ? ' on' : ''}`}
                  onClick={() => setReminderEnabled(!reminderEnabled)}
                  aria-pressed={reminderEnabled}
                />
              </div>
              {reminderEnabled && (
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>{t('reminderTime')}</label>
                  <input
                    className="form-input"
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                  />
                </div>
              )}
            </div>
            <button className="btn btn-primary mt-12" onClick={() => setStep(2)}>
              {t('next')}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboard-step">
            <h2>{t('sessionLength')}</h2>
            <div className="lang-cards">
              {([10, 15] as const).map((m) => (
                <button
                  key={m}
                  className={`lang-card${sessionMinutes === m ? ' selected' : ''}`}
                  onClick={() => setSessionMinutes(m)}
                >
                  {m === 10 ? t('minutes10') : t('minutes15')}
                </button>
              ))}
            </div>
            <button className="btn btn-primary mt-12" onClick={finish}>
              {t('getStarted')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
