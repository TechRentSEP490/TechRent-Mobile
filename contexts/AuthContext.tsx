import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  getCurrentUser,
  loginUser,
  updateCustomerProfile,
  type AuthenticatedUser,
  type LoginPayload,
  type UpdateProfilePayload,
} from '@/services/auth';

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
  updateProfile: (payload: UpdateProfilePayload) => Promise<AuthenticatedUser>;
  signOut: () => Promise<void>;
};

const AUTH_SESSION_KEY = 'techrent.auth.session';
const AUTH_CREDENTIALS_KEY = 'techrent.auth.credentials';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type ApiErrorWithStatus = Error & { status?: number };

type FetchProfileOptions = { silent?: boolean; skipRetry?: boolean };

type PerformLoginOptions = { persistStoredCredentials?: boolean };

type ClearSessionOptions = { clearCredentials?: boolean };

type StoredCredentials = LoginPayload;

type HydrationResult = AuthSession | null;

type ReauthenticatePromise = Promise<AuthSession | null>;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isStorageAvailable, setIsStorageAvailable] = useState(true);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  const isMountedRef = useRef(true);
  const sessionRef = useRef<AuthSession | null>(null);
  const credentialsRef = useRef<StoredCredentials | null>(null);
  const hydrationPromiseRef = useRef<Promise<HydrationResult> | null>(null);
  const ensureSessionPromiseRef = useRef<Promise<AuthSession | null> | null>(null);
  const reauthenticatePromiseRef = useRef<ReauthenticatePromise | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const persistSession = useCallback(
    async (nextSession: AuthSession | null) => {
      if (!isStorageAvailable) {
        if (nextSession) {
          console.warn('Secure storage is unavailable. Session will not persist across restarts.');
        }
        return;
      }

      try {
        if (!nextSession) {
          await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
          return;
        }

        await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(nextSession));
      } catch (error) {
        console.warn('Failed to persist auth session', error);
      }
    },
    [isStorageAvailable]
  );

  const persistCredentials = useCallback(
    async (credentials: StoredCredentials | null) => {
      if (!isStorageAvailable) {
        if (credentials) {
          console.warn('Secure storage is unavailable. Credentials will not persist across restarts.');
        }
        return;
      }

      try {
        if (!credentials) {
          await SecureStore.deleteItemAsync(AUTH_CREDENTIALS_KEY);
          return;
        }

        await SecureStore.setItemAsync(AUTH_CREDENTIALS_KEY, JSON.stringify(credentials));
      } catch (error) {
        console.warn('Failed to persist auth credentials', error);
      }
    },
    [isStorageAvailable]
  );

  const applySession = useCallback(
    async (nextSession: AuthSession | null) => {
      sessionRef.current = nextSession;

      if (isMountedRef.current) {
        setSession(nextSession);
      }

      await persistSession(nextSession);
    },
    [persistSession]
  );

  const clearSessionState = useCallback(
    async ({ clearCredentials = false }: ClearSessionOptions = {}) => {
      if (isMountedRef.current) {
        setUser(null);
        setIsFetchingProfile(false);
      }

      ensureSessionPromiseRef.current = null;

      await applySession(null);

      if (clearCredentials) {
        credentialsRef.current = null;
        await persistCredentials(null);
      }
    },
    [applySession, persistCredentials]
  );

  const performLogin = useCallback(
    async (payload: LoginPayload, options: PerformLoginOptions = {}) => {
      const { persistStoredCredentials = true } = options;

      const response = await loginUser(payload);

      if (!response.accessToken) {
        throw new Error('Authentication failed. Please try again.');
      }

      const nextSession: AuthSession = {
        accessToken: response.accessToken,
        tokenType: response.tokenType && response.tokenType.length > 0 ? response.tokenType : 'Bearer',
      };

      credentialsRef.current = payload;

      if (persistStoredCredentials) {
        await persistCredentials(payload);
      }

      await applySession(nextSession);

      return nextSession;
    },
    [applySession, persistCredentials]
  );

  const fetchProfile = useCallback(
    async (sessionOverride?: AuthSession, options: FetchProfileOptions = {}) => {
      const activeSession = sessionOverride ?? sessionRef.current;

      if (!activeSession?.accessToken) {
        if (isMountedRef.current) {
          setUser(null);
        }
        return null;
      }

      const { silent = false, skipRetry = false } = options;

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
        const normalizedError: ApiErrorWithStatus =
          error instanceof Error
            ? (error as ApiErrorWithStatus)
            : Object.assign(new Error('Failed to load profile. Please try again.'), { status: undefined });
        const status = normalizedError.status;

        if (status === 401 && !skipRetry) {
          const storedCredentials = credentialsRef.current;

          if (storedCredentials) {
            try {
              const refreshedSession = await performLogin(storedCredentials, { persistStoredCredentials: true });
              return fetchProfile(refreshedSession, { ...options, skipRetry: true });
            } catch (reauthError) {
              console.warn('Failed to refresh session from stored credentials', reauthError);

              if ((reauthError as ApiErrorWithStatus).status === 401) {
                await clearSessionState({ clearCredentials: false });
              }
            }
          } else {
            await clearSessionState({ clearCredentials: false });
          }
        }

        throw normalizedError;
      } finally {
        if (!silent && isMountedRef.current) {
          setIsFetchingProfile(false);
        }
      }
    },
    [clearSessionState, performLogin]
  );

  useEffect(() => {
    let isActive = true;

    const hydrate = async (): Promise<HydrationResult> => {
      try {
        const storageAvailable =
          typeof SecureStore.isAvailableAsync === 'function' ? await SecureStore.isAvailableAsync() : true;

        if (isActive && isMountedRef.current) {
          setIsStorageAvailable(storageAvailable);
        }

        if (!storageAvailable) {
          return null;
        }

        const [storedSessionValue, storedCredentialsValue] = await Promise.all([
          SecureStore.getItemAsync(AUTH_SESSION_KEY),
          SecureStore.getItemAsync(AUTH_CREDENTIALS_KEY),
        ]);

        if (storedCredentialsValue) {
          try {
            const parsedCredentials = JSON.parse(storedCredentialsValue) as Partial<StoredCredentials> | null;

            if (parsedCredentials?.usernameOrEmail && parsedCredentials?.password) {
              credentialsRef.current = {
                usernameOrEmail: parsedCredentials.usernameOrEmail,
                password: parsedCredentials.password,
              };
            }
          } catch (error) {
            console.warn('Failed to parse stored credentials', error);
          }
        }

        if (storedSessionValue) {
          try {
            const parsedSession = JSON.parse(storedSessionValue) as Partial<AuthSession> | null;

            if (parsedSession?.accessToken) {
              const tokenType =
                parsedSession.tokenType && parsedSession.tokenType.length > 0 ? parsedSession.tokenType : 'Bearer';

              const restoredSession: AuthSession = { accessToken: parsedSession.accessToken, tokenType };

              await applySession(restoredSession);

              try {
                await fetchProfile(restoredSession, { silent: true });
              } catch (error) {
                console.warn('Failed to restore user profile', error);
              }

              return restoredSession;
            }
          } catch (error) {
            console.warn('Failed to parse stored session', error);
          }
        }

        if (credentialsRef.current) {
          try {
            const sessionFromCredentials = await performLogin(credentialsRef.current, {
              persistStoredCredentials: true,
            });

            try {
              await fetchProfile(sessionFromCredentials, { silent: true });
            } catch (error) {
              console.warn('Failed to load profile after restoring session from credentials', error);
            }

            return sessionFromCredentials;
          } catch (error) {
            console.warn('Failed to restore session from stored credentials', error);
          }
        }
      } catch (error) {
        console.warn('Failed to restore auth session', error);
      }

      return null;
    };

    const hydrationPromise = hydrate();
    hydrationPromiseRef.current = hydrationPromise;

    hydrationPromise
      .catch((error) => {
        console.warn('Failed to hydrate auth session', error);
        return null;
      })
      .finally(() => {
        if (hydrationPromiseRef.current === hydrationPromise) {
          hydrationPromiseRef.current = null;
        }

        if (isActive && isMountedRef.current) {
          setIsHydrating(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [applySession, fetchProfile, performLogin]);

  const signIn = useCallback(
    async (payload: LoginPayload) => {
      const sessionResult = await performLogin(payload, { persistStoredCredentials: true });

      try {
        await fetchProfile(sessionResult);
      } catch (error) {
        if ((error as ApiErrorWithStatus).status === 401) {
          throw error;
        }

        console.warn('Sign in succeeded but loading the user profile failed.', error);
      }
    },
    [fetchProfile, performLogin]
  );

  const signOut = useCallback(async () => {
    await clearSessionState({ clearCredentials: true });
  }, [clearSessionState]);

  const refreshProfile = useCallback(() => fetchProfile(), [fetchProfile]);

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      const sessionValue = await ensureSession();

      if (!sessionValue?.accessToken) {
        throw new Error('Please sign in again to update your profile.');
      }

      const updatedUser = await updateCustomerProfile({
        accessToken: sessionValue.accessToken,
        tokenType: sessionValue.tokenType,
        payload,
      });

      if (isMountedRef.current) {
        setUser(updatedUser);
      }

      return updatedUser;
    },
    [ensureSession]
  );

  const attemptReauthenticate = useCallback(async () => {
    if (reauthenticatePromiseRef.current) {
      return reauthenticatePromiseRef.current;
    }

    const storedCredentials = credentialsRef.current;

    if (!storedCredentials) {
      return null;
    }

    const promise: ReauthenticatePromise = (async () => {
      try {
        const refreshed = await performLogin(storedCredentials, { persistStoredCredentials: true });

        try {
          await fetchProfile(refreshed, { silent: true, skipRetry: true });
        } catch (error) {
          console.warn('Failed to load profile after reauthentication', error);
        }

        return refreshed;
      } catch (error) {
        console.warn('Reauthentication failed', error);
        return null;
      } finally {
        reauthenticatePromiseRef.current = null;
      }
    })();

    reauthenticatePromiseRef.current = promise;

    return promise;
  }, [fetchProfile, performLogin]);

  const ensureSession = useCallback(async () => {
    const currentSession = sessionRef.current;

    if (currentSession?.accessToken) {
      return currentSession;
    }

    if (hydrationPromiseRef.current) {
      try {
        const hydrated = await hydrationPromiseRef.current;

        if (hydrated?.accessToken) {
          return hydrated;
        }
      } catch (error) {
        console.warn('Failed to await auth hydration', error);
      }
    }

    if (!isStorageAvailable) {
      return attemptReauthenticate();
    }

    if (ensureSessionPromiseRef.current) {
      return ensureSessionPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const storedValue = await SecureStore.getItemAsync(AUTH_SESSION_KEY);

        if (storedValue) {
          const parsed = JSON.parse(storedValue) as Partial<AuthSession> | null;

          if (parsed?.accessToken) {
            const tokenType = parsed.tokenType && parsed.tokenType.length > 0 ? parsed.tokenType : 'Bearer';
            const restoredSession: AuthSession = { accessToken: parsed.accessToken, tokenType };

            await applySession(restoredSession);

            return restoredSession;
          }
        }

        if (!credentialsRef.current) {
          try {
            const storedCredentialsValue = await SecureStore.getItemAsync(AUTH_CREDENTIALS_KEY);

            if (storedCredentialsValue) {
              const parsedCredentials = JSON.parse(storedCredentialsValue) as Partial<StoredCredentials> | null;

              if (parsedCredentials?.usernameOrEmail && parsedCredentials?.password) {
                credentialsRef.current = {
                  usernameOrEmail: parsedCredentials.usernameOrEmail,
                  password: parsedCredentials.password,
                };
              }
            }
          } catch (credentialsError) {
            console.warn('Failed to read stored credentials while ensuring session', credentialsError);
          }
        }

        return attemptReauthenticate();
      } catch (error) {
        console.warn('Failed to ensure auth session', error);
      }

      return null;
    })();

    ensureSessionPromiseRef.current = promise;

    const result = await promise;

    if (ensureSessionPromiseRef.current === promise) {
      ensureSessionPromiseRef.current = null;
    }

    return result;
  }, [applySession, attemptReauthenticate, isStorageAvailable]);

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
      updateProfile,
      signOut,
    }),
    [
      session,
      isHydrating,
      user,
      isFetchingProfile,
      signIn,
      refreshProfile,
      ensureSession,
      updateProfile,
      signOut,
    ]
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