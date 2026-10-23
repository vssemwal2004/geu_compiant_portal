import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { users } from '../data/mockData';
import type { Role, User } from '../domain/types';

// Stand-in for the backend session (HttpOnly cookie + GET /auth/me).
// Only the user id is kept in sessionStorage, and only so a page refresh keeps you signed in.

const KEY = 'geu.session';

export const roleHome: Record<Role, string> = {
  MAIN_ADMIN: '/admin',
  SUB_ADMIN: '/sub-admin',
  LAB_ASSISTANT: '/app',
};

export const roleLabel: Record<Role, string> = {
  MAIN_ADMIN: 'Main Admin',
  SUB_ADMIN: 'Sub-Admin',
  LAB_ASSISTANT: 'Lab Assistant',
};

interface SessionValue {
  user: User | null;
  signIn: (identifier: string) => User | null;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

function restore(): User | null {
  try {
    const id = sessionStorage.getItem(KEY);
    return users.find((u) => u.id === id) ?? null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(restore);

  const signIn = useCallback((identifier: string) => {
    const needle = identifier.trim().toLowerCase();
    const found = users.find((u) => u.email === needle || u.employeeId.toLowerCase() === needle) ?? null;
    if (found) {
      setUser(found);
      try {
        sessionStorage.setItem(KEY, found.id);
      } catch {
        /* storage unavailable: session lasts until reload */
      }
    }
    return found;
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
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
