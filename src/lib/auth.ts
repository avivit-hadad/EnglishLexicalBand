import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { UserData } from '../types';
import { randomUUID } from './uuid';
import {
  saveUserData,
  loadUserData,
  createDefaultUserData,
  migrateLegacyUserData,
} from './progress';

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Project URL only — strip /rest/v1/ if pasted from API docs by mistake */
function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

const url = rawUrl ? normalizeSupabaseUrl(rawUrl) : undefined;

export const supabaseConfigured = Boolean(url && key);
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export interface AuthUser {
  id: string;
  name: string;
}

const USERS_KEY = 'lexical_band_users';
const SESSION_KEY = 'lexical_band_session';
const CLOUD_USER_KEY = 'lexical_band_cloud_user';

interface LocalUser {
  id: string;
  name: string;
  passwordHash: string;
  email?: string;
}

interface CloudSession {
  id: string;
  name: string;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function displayName(name: string): string {
  return name.trim();
}

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = (hash << 5) - hash + password.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

function getLocalUsers(): LocalUser[] {
  try {
    const raw = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as Array<
      LocalUser & { email?: string }
    >;
    return raw.map((user) => ({
      id: user.id,
      name: user.name ?? user.email?.split('@')[0] ?? 'User',
      passwordHash: user.passwordHash,
    }));
  } catch {
    return [];
  }
}

function saveLocalUsers(users: LocalUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function saveCloudSession(user: CloudSession): void {
  localStorage.setItem(CLOUD_USER_KEY, JSON.stringify(user));
  localStorage.removeItem(SESSION_KEY);
}

function getCloudSession(): CloudSession | null {
  try {
    const raw = localStorage.getItem(CLOUD_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CloudSession;
  } catch {
    return null;
  }
}

function clearCloudSession(): void {
  localStorage.removeItem(CLOUD_USER_KEY);
}

function mapRpcError(error: { message?: string; code?: string }): Error {
  const msg = error.message ?? 'Request failed';
  if (msg.includes('already in use')) return new Error('Name already in use');
  if (msg.includes('Invalid name or password')) return new Error('Invalid name or password');
  if (msg.includes('Could not find the function') || msg.includes('register_account')) {
    return new Error('Cloud database not set up — run supabase/migrations SQL in Supabase');
  }
  if (msg.includes('fetch failed') || msg.includes('Failed to fetch')) {
    return new Error('Cannot reach Supabase — check internet and VITE_SUPABASE_URL in .env.local');
  }
  return new Error(msg);
}

async function cloudRegister(name: string, password: string): Promise<AuthUser> {
  if (!supabase) throw new Error('Cloud auth is not configured');

  const trimmedName = displayName(name);
  const { data, error } = await supabase.rpc('register_account', {
    p_name: trimmedName,
    p_password: password,
  });

  if (error) throw mapRpcError(error);
  if (!data) throw new Error('Sign up failed');

  const userId = data as string;
  const profile = {
    id: userId,
    name: trimmedName,
    uiLanguage: 'he' as const,
    reminderTime: '20:00',
    reminderEnabled: false,
    wordsPerDay: 10 as const,
    onboarded: false,
    activeVocabulary: 'elementary' as const,
  };
  const userData = createDefaultUserData(profile);
  await persistUserData(userId, userData);
  saveCloudSession({ id: userId, name: trimmedName });
  return { id: userId, name: trimmedName };
}

async function cloudSignIn(name: string, password: string): Promise<AuthUser> {
  if (!supabase) throw new Error('Cloud auth is not configured');

  const trimmedName = displayName(name);
  const { data, error } = await supabase.rpc('login_account', {
    p_name: trimmedName,
    p_password: password,
  });

  if (error) throw mapRpcError(error);
  if (!data) throw new Error('Invalid name or password');

  const userId = data as string;
  const stored = await loadUserDataFromCloud(userId);
  const resolvedName = stored?.profile.name ?? trimmedName;
  saveCloudSession({ id: userId, name: resolvedName });
  return { id: userId, name: resolvedName };
}

export async function signUp(name: string, password: string): Promise<AuthUser> {
  const trimmedName = displayName(name);
  if (!trimmedName) throw new Error('Name is required');

  if (supabase) {
    return cloudRegister(trimmedName, password);
  }

  const users = getLocalUsers();
  const normalized = normalizeName(trimmedName);
  if (users.some((u) => normalizeName(u.name) === normalized)) {
    throw new Error('Name already in use');
  }

  const user: LocalUser = {
    id: randomUUID(),
    name: trimmedName,
    passwordHash: hashPassword(password),
  };
  users.push(user);
  saveLocalUsers(users);
  const profile = {
    id: user.id,
    name: trimmedName,
    uiLanguage: 'he' as const,
    reminderTime: '20:00',
    reminderEnabled: false,
    wordsPerDay: 10 as const,
    onboarded: false,
    activeVocabulary: 'elementary' as const,
  };
  saveUserData(user.id, createDefaultUserData(profile));
  localStorage.setItem(SESSION_KEY, user.id);
  return { id: user.id, name: trimmedName };
}

export async function signIn(name: string, password: string): Promise<AuthUser> {
  const trimmedName = displayName(name);
  if (!trimmedName) throw new Error('Name is required');

  if (supabase) {
    return cloudSignIn(trimmedName, password);
  }

  const users = getLocalUsers();
  const normalized = normalizeName(trimmedName);
  const user = users.find((u) => normalizeName(u.name) === normalized);
  if (!user || user.passwordHash !== hashPassword(password)) {
    throw new Error('Invalid name or password');
  }
  localStorage.setItem(SESSION_KEY, user.id);
  return { id: user.id, name: user.name };
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
  localStorage.removeItem(SESSION_KEY);
  clearCloudSession();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cloudSession = getCloudSession();
  if (cloudSession) {
    return cloudSession;
  }

  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const users = getLocalUsers();
  const user = users.find((u) => u.id === id);
  return user ? { id: user.id, name: user.name } : null;
}

export async function syncUserDataToCloud(userId: string, data: UserData): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('user_data').upsert(
    {
      user_id: userId,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) console.error('Cloud sync failed:', error.message);
}

export async function loadUserDataFromCloud(userId: string): Promise<UserData | null> {
  if (!supabase) return loadUserData(userId);
  const { data, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Cloud load failed:', error.message);
    return loadUserData(userId);
  }

  if (data?.data) {
    const userData = migrateLegacyUserData(data.data as Record<string, unknown>);
    saveUserData(userId, userData);
    return userData;
  }

  return loadUserData(userId);
}

export async function persistUserData(userId: string, data: UserData): Promise<void> {
  saveUserData(userId, data);
  await syncUserDataToCloud(userId, data);
}
