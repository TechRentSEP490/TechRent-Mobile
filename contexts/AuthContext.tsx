import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { loginUser, type LoginPayload } from '@/services/auth';

type AuthSession = {
  accessToken: string;
  tokenType: string;
};

type AuthContextType = {
  isSignedIn: boolean;
  isHydrating: boolean;
  session: AuthSession | null;
  accessToken: string | null;
  signIn: (payload: LoginPayload) => Promise<void>;
  signOut: () => Promise<void>;
};

const AUTH_SESSION_KEY = 'techrent.auth.session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isStorageAvailable, setIsStorageAvailable] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const storageAvailable =
          typeof SecureStore.isAvailableAsync === 'function'
            ? await SecureStore.isAvailableAsync()
            : true;

        if (isMounted) {
          setIsStorageAvailable(storageAvailable);
        }

        if (!storageAvailable) {
          return;
        }

        const storedValue = await SecureStore.getItemAsync(AUTH_SESSION_KEY);

        if (!storedValue) {
          return;
        }

        const parsed = JSON.parse(storedValue) as Partial<AuthSession> | null;

        if (parsed?.accessToken) {
          const tokenType = parsed.tokenType && parsed.tokenType.length > 0 ? parsed.tokenType : 'Bearer';
          if (isMounted) {
            setSession({ accessToken: parsed.accessToken, tokenType });
          }
        }
      } catch (error) {
        console.warn('Failed to restore auth session', error);
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistSession = useCallback(async (nextSession: AuthSession | null) => {
    if (!isStorageAvailable) {
      return;
    }

    if (!nextSession) {
      try {
        await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
      } catch (error) {
        console.warn('Failed to clear auth session', error);
      }
      return;
    }

    try {
      await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(nextSession));
    } catch (error) {
      console.warn('Failed to persist auth session', error);
    }
  }, [isStorageAvailable]);

  const signIn = useCallback(
    async (payload: LoginPayload) => {
      const response = await loginUser(payload);

      if (!response.accessToken) {
        throw new Error('Authentication failed. Please try again.');
      }

      const nextSession: AuthSession = {
        accessToken: response.accessToken,
        tokenType: response.tokenType && response.tokenType.length > 0 ? response.tokenType : 'Bearer',
      };

      setSession(nextSession);
      if (!isStorageAvailable) {
        console.warn('Secure storage is unavailable. Session will not persist across restarts.');
      } else {
        await persistSession(nextSession);
      }
    },
    [isStorageAvailable, persistSession]
  );

  const signOut = useCallback(async () => {
    setSession(null);
    await persistSession(null);
  }, [persistSession]);

  const value = useMemo(
    () => ({
      isSignedIn: Boolean(session),
      isHydrating,
      session,
      accessToken: session?.accessToken ?? null,
      signIn,
      signOut,
    }),
    [session, isHydrating, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
