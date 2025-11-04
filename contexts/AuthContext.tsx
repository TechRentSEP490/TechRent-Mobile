import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { getCurrentUser, loginUser, type AuthenticatedUser, type LoginPayload } from '@/services/auth';

export type AuthSession = {
  accessToken: string;
  tokenType: string;
};

type AuthContextType = {
  isSignedIn: boolean;
  isHydrating: boolean;
  session: AuthSession | null;
  accessToken: string | null;
  user: AuthenticatedUser | null;
  isFetchingProfile: boolean;
  signIn: (payload: LoginPayload) => Promise<void>;
  refreshProfile: () => Promise<AuthenticatedUser | null>;
  ensureSession: () => Promise<AuthSession | null>;
  signOut: () => Promise<void>;
};

const AUTH_SESSION_KEY = 'techrent.auth.session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isStorageAvailable, setIsStorageAvailable] = useState(true);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const isMountedRef = useRef(true);

  type ApiErrorWithStatus = Error & { status?: number };

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
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

  const clearSessionState = useCallback(async () => {
    if (isMountedRef.current) {
      setSession(null);
      setUser(null);
      setIsFetchingProfile(false);
    }

    await persistSession(null);
  }, [persistSession]);

  type FetchProfileOptions = { silent?: boolean };

  const fetchProfile = useCallback(
    async (sessionOverride?: AuthSession, options: FetchProfileOptions = {}) => {
      const activeSession = sessionOverride ?? session;

      if (!activeSession?.accessToken) {
        if (isMountedRef.current) {
          setUser(null);
        }
        return null;
      }

      const { silent = false } = options;

      if (!silent && isMountedRef.current) {
        setIsFetchingProfile(true);
      }

      try {
        const profile = await getCurrentUser({
          accessToken: activeSession.accessToken,
          tokenType: activeSession.tokenType,
        });

        if (isMountedRef.current) {
          setUser(profile);
        }

        return profile;
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error('Failed to load profile. Please try again.');
        const status = (normalizedError as ApiErrorWithStatus).status;

        if (status === 401) {
          await clearSessionState();
        }

        throw normalizedError;
      } finally {
        if (!silent && isMountedRef.current) {
          setIsFetchingProfile(false);
        }
      }
    },
    [session, clearSessionState]
  );

  useEffect(() => {
    let isActive = true;

    const finishHydration = () => {
      if (isActive && isMountedRef.current) {
        setIsHydrating(false);
      }
    };

    const hydrate = async () => {
      try {
        const storageAvailable =
          typeof SecureStore.isAvailableAsync === 'function'
            ? await SecureStore.isAvailableAsync()
            : true;

        if (isActive && isMountedRef.current) {
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
          const nextSession: AuthSession = { accessToken: parsed.accessToken, tokenType };

          if (isActive && isMountedRef.current) {
            setSession(nextSession);
          }

          try {
            await fetchProfile(nextSession, { silent: true });
          } catch (error) {
            console.warn('Failed to restore user profile', error);

            const normalizedError =
              error instanceof Error
                ? (error as ApiErrorWithStatus)
                : ({ message: String(error) } as ApiErrorWithStatus);

            if (normalizedError.status === 401) {
              await clearSessionState();
            }
          }
        }
      } catch (error) {
        console.warn('Failed to restore auth session', error);
      }
    };

    Promise.resolve(hydrate()).finally(finishHydration);

    return () => {
      isActive = false;
    };
  }, [fetchProfile, clearSessionState]);

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

      if (isMountedRef.current) {
        setSession(nextSession);
      }
      if (!isStorageAvailable) {
        console.warn('Secure storage is unavailable. Session will not persist across restarts.');
      } else {
        await persistSession(nextSession);
      }

      try {
        await fetchProfile(nextSession);
      } catch (error) {
        if ((error as ApiErrorWithStatus).status === 401) {
          throw error;
        }

        console.warn('Sign in succeeded but loading the user profile failed.', error);
      }
    },
    [fetchProfile, isStorageAvailable, persistSession]
  );

  const signOut = useCallback(async () => {
    await clearSessionState();
  }, [clearSessionState]);

  const refreshProfile = useCallback(() => fetchProfile(), [fetchProfile]);

  const ensureSession = useCallback(async () => {
    if (session?.accessToken) {
      return session;
    }

    if (!isStorageAvailable) {
      return null;
    }

    try {
      const storedValue = await SecureStore.getItemAsync(AUTH_SESSION_KEY);

      if (!storedValue) {
        return null;
      }

      const parsed = JSON.parse(storedValue) as Partial<AuthSession> | null;

      if (parsed?.accessToken) {
        const tokenType = parsed.tokenType && parsed.tokenType.length > 0 ? parsed.tokenType : 'Bearer';
        const restoredSession: AuthSession = { accessToken: parsed.accessToken, tokenType };

        if (isMountedRef.current) {
          setSession(restoredSession);
        }

        return restoredSession;
      }
    } catch (error) {
      console.warn('Failed to ensure auth session', error);
    }

    return null;
  }, [session, isStorageAvailable]);

  const value = useMemo(
    () => ({
      isSignedIn: Boolean(session),
      isHydrating,
      session,
      accessToken: session?.accessToken ?? null,
      user,
      isFetchingProfile,
      signIn,
      refreshProfile,
      ensureSession,
      signOut,
    }),
    [session, isHydrating, user, isFetchingProfile, signIn, refreshProfile, ensureSession, signOut]
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
