import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { getCurrentUser, loginUser, type AuthenticatedUser, type LoginPayload } from '@/services/auth';

type ApiErrorWithStatus = Error & { status?: number };

const PROFILE_FETCH_TIMEOUT_MS = 15000;
const PROFILE_TIMEOUT_ERROR_NAME = 'ProfileTimeoutError';

const createProfileTimeout = () => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new Error(
        'Your session expired because we could not load your profile. Please sign in again.'
      ) as ApiErrorWithStatus;
      timeoutError.name = PROFILE_TIMEOUT_ERROR_NAME;
      timeoutError.status = 440;
      reject(timeoutError);
    }, PROFILE_FETCH_TIMEOUT_MS);
  });

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return { promise, cancel };
};

const isProfileTimeoutError = (error: unknown): error is ApiErrorWithStatus =>
  error instanceof Error && error.name === PROFILE_TIMEOUT_ERROR_NAME;

type AuthSession = {
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

  const clearSessionState = useCallback(
    async ({ redirectToSignIn = false }: { redirectToSignIn?: boolean } = {}) => {
      if (isMountedRef.current) {
        setSession(null);
        setUser(null);
        setIsFetchingProfile(false);
      }

      await persistSession(null);

      if (redirectToSignIn) {
        router.replace('/(auth)/sign-in');
      }
    },
    [persistSession, router]
  );

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

      const { promise: timeoutPromise, cancel: cancelTimeout } = createProfileTimeout();

      try {
        const profile = await Promise.race([
          getCurrentUser({
            accessToken: activeSession.accessToken,
            tokenType: activeSession.tokenType,
          }),
          timeoutPromise,
        ]);

        if (isMountedRef.current) {
          setUser(profile);
        }

        return profile;
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error('Failed to load profile. Please try again.');

        if (isProfileTimeoutError(normalizedError) || (normalizedError as ApiErrorWithStatus).status === 401) {
          await clearSessionState({ redirectToSignIn: true });
        } else if (isMountedRef.current) {
          setUser(null);
        }

        throw normalizedError;
      } finally {
        cancelTimeout();

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
  }, [fetchProfile]);

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
        const normalizedError: ApiErrorWithStatus =
          error instanceof Error
            ? (error as ApiErrorWithStatus)
            : Object.assign(new Error('Failed to load profile.'), { status: undefined });

        if (isProfileTimeoutError(normalizedError) || normalizedError.status === 401) {
          throw normalizedError;
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
      signOut,
    }),
    [session, isHydrating, user, isFetchingProfile, signIn, refreshProfile, signOut]
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
