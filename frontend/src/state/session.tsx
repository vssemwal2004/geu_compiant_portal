import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { users, locations, assetTypes, routingRules } from '../data/referenceData';
import { api } from '../api';
import type { Role, User } from '../domain/types';

export const roleHome: Record<Role, string> = {
  MAIN_ADMIN: '/admin',
  ADMIN: '/viewer-admin',
  SUB_ADMIN: '/sub-admin',
  LAB_ASSISTANT: '/app',
};

export const roleLabel: Record<Role, string> = {
  MAIN_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  SUB_ADMIN: 'Sub-Admin',
  LAB_ASSISTANT: 'Lab Assistant',
};

interface SessionValue {
  user: User | null;
  signIn: (identifier: string, password: string) => Promise<User>;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<User>;
  signOut: () => void;
  refreshReference: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const loadReference = useCallback(async () => {
    const data = await api<{ users: User[]; locations: typeof locations; assetTypes: typeof assetTypes; routingRules: typeof routingRules }>('/reference');
    users.splice(0, users.length, ...data.users);
    locations.splice(0, locations.length, ...data.locations);
    assetTypes.splice(0, assetTypes.length, ...data.assetTypes);
    routingRules.splice(0, routingRules.length, ...data.routingRules);
  }, []);

  useEffect(() => {
    api<{ user: User }>('/auth/me').then(async ({ user }) => {
      if (!user.passwordChangeRequired) await loadReference();
      setUser(user);
    }).catch(() => setUser(null)).finally(() => setReady(true));
  }, [loadReference]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const { user } = await api<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
    if (!user.passwordChangeRequired) await loadReference();
    setUser(user);
    return user;
  }, [loadReference]);

  const requestOtp = useCallback(async (phone: string) => {
    await api('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) });
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    const { user } = await api<{ user: User }>('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, code }) });
    await loadReference();
    setUser(user);
    return user;
  }, [loadReference]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const { user } = await api<{ user: User }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    await loadReference();
    setUser(user);
    return user;
  }, [loadReference]);

  const signOut = useCallback(() => {
    void api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, signIn, requestOtp, verifyOtp, changePassword, signOut, refreshReference: loadReference }), [user, signIn, requestOtp, verifyOtp, changePassword, signOut, loadReference]);
  return <SessionContext.Provider value={value}>{ready ? children : <div className="loading-screen">Loading portal…</div>}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** For pages rendered inside a role layout, where a user is guaranteed. */
export function useCurrentUser(): User {
  const { user } = useSession();
  if (!user) throw new Error('No signed-in user');
  return user;
}
