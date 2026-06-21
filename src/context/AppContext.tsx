import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { UserData, VocabularyId } from '../types';
import {
  getCurrentUser,
  signIn,
  signUp,
  signOut,
  persistUserData,
  loadUserDataFromCloud,
  type AuthUser,
} from '../lib/auth';
import { createDefaultUserData, loadUserData, setActiveVocabulary as setVocabulary } from '../lib/progress';
import { initUiLanguage, setUiLanguage } from '../i18n';

interface AppContextValue {
  user: AuthUser | null;
  userData: UserData | null;
  loading: boolean;
  login: (name: string, password: string) => Promise<void>;
  register: (name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateData: (data: UserData) => Promise<void>;
  refreshData: () => Promise<void>;
  setActiveVocabulary: (vocabularyId: VocabularyId) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (authUser: AuthUser) => {
    let data = await loadUserDataFromCloud(authUser.id);
    if (!data) {
      data = loadUserData(authUser.id);
    }
    if (!data) {
      data = createDefaultUserData({
        id: authUser.id,
        name: authUser.name,
        uiLanguage: 'he',
        reminderTime: '20:00',
        reminderEnabled: false,
        sessionMinutes: 10,
        onboarded: false,
        activeVocabulary: 'elementary',
      });
      await persistUserData(authUser.id, data);
    }
    if (!data.profile.name && (data.profile as { email?: string }).email) {
      data.profile.name = (data.profile as { email?: string }).email!.split('@')[0];
    }
    if (!data.profile.activeVocabulary) {
      data.profile.activeVocabulary = 'elementary';
    }
    initUiLanguage(data.profile.uiLanguage);
    setUserData(data);
  }, []);

  useEffect(() => {
    getCurrentUser().then(async (u) => {
      setUser(u);
      if (u) await loadData(u);
      setLoading(false);
    });
  }, [loadData]);

  const login = async (name: string, password: string) => {
    const u = await signIn(name, password);
    setUser(u);
    await loadData(u);
  };

  const register = async (name: string, password: string) => {
    const u = await signUp(name, password);
    setUser(u);
    await loadData(u);
  };

  const logout = async () => {
    await signOut();
    setUser(null);
    setUserData(null);
  };

  const updateData = async (data: UserData) => {
    if (!user) return;
    setUserData(data);
    setUiLanguage(data.profile.uiLanguage);
    await persistUserData(user.id, data);
  };

  const refreshData = async () => {
    if (user) await loadData(user);
  };

  const setActiveVocabulary = async (vocabularyId: VocabularyId) => {
    if (!userData) return;
    await updateData(setVocabulary(userData, vocabularyId));
  };

  return (
    <AppContext.Provider
      value={{
        user,
        userData,
        loading,
        login,
        register,
        logout,
        updateData,
        refreshData,
        setActiveVocabulary,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
