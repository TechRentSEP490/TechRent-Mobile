import * as SecureStore from 'expo-secure-store';
import { type ReactNode } from 'react';
import { create } from 'zustand';

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

type AuthStore = {
  isSignedIn: boolean;
  isHydrating: boolean;
  session: AuthSession | null;
  accessToken: string | null;
  user: AuthenticatedUser | null;
  isFetchingProfile: boolean;
  isStorageAvailable: boolean;
  hydrate: () => Promise<AuthSession | null>;
  signIn: (payload: LoginPayload) => Promise<void>;
  refreshProfile: () => Promise<AuthenticatedUser | null>;
  ensureSession: () => Promise<AuthSession | null>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<AuthenticatedUser>;
  signOut: () => Promise<void>;
};

type ApiErrorWithStatus = Error & { status?: number };

type FetchProfileOptions = { silent?: boolean; skipRetry?: boolean };

type PerformLoginOptions = { persistStoredCredentials?: boolean };

type ClearSessionOptions = { clearCredentials?: boolean };

type StoredCredentials = LoginPayload;

type HydrationResult = AuthSession | null;

type ReauthenticatePromise = Promise<AuthSession | null>;

const AUTH_SESSION_KEY = 'techrent.auth.session';
const AUTH_CREDENTIALS_KEY = 'techrent.auth.credentials';

let sessionRef: AuthSession | null = null;
let credentialsRef: StoredCredentials | null = null;
let hydrationPromiseRef: Promise<HydrationResult> | null = null;
let ensureSessionPromiseRef: Promise<AuthSession | null> | null = null;
let reauthenticatePromiseRef: ReauthenticatePromise | null = null;

export const useAuthStore = create<AuthStore>()((set, get) => {
  const persistSession = async (nextSession: AuthSession | null) => {
    if (!get().isStorageAvailable) {
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
  };

  const persistCredentials = async (credentials: StoredCredentials | null) => {
    if (!get().isStorageAvailable) {
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
  };

  const applySession = async (nextSession: AuthSession | null) => {
    sessionRef = nextSession;

    set({
      session: nextSession,
      accessToken: nextSession?.accessToken ?? null,
      isSignedIn: Boolean(nextSession?.accessToken),
    });

    await persistSession(nextSession);
  };

  const clearSessionState = async ({ clearCredentials = false }: ClearSessionOptions = {}) => {
    set({ user: null, isFetchingProfile: false });
    ensureSessionPromiseRef = null;

    await applySession(null);

    if (clearCredentials) {
      credentialsRef = null;
      await persistCredentials(null);
    }
  };

  const performLogin = async (payload: LoginPayload, options: PerformLoginOptions = {}) => {
    const { persistStoredCredentials = true } = options;
    const response = await loginUser(payload);

    if (!response.accessToken) {
      throw new Error('Authentication failed. Please try again.');
    }

    const nextSession: AuthSession = {
      accessToken: response.accessToken,
      tokenType: response.tokenType && response.tokenType.length > 0 ? response.tokenType : 'Bearer',
    };

    credentialsRef = payload;

    if (persistStoredCredentials) {
      await persistCredentials(payload);
    }

    await applySession(nextSession);

    return nextSession;
  };

  const fetchProfile = async (sessionOverride?: AuthSession, options: FetchProfileOptions = {}) => {
    const activeSession = sessionOverride ?? sessionRef;

    if (!activeSession?.accessToken) {
      set({ user: null });
      return null;
    }

    const { silent = false, skipRetry = false } = options;

    if (!silent) {
      set({ isFetchingProfile: true });
    }

    try {
      const profile = await getCurrentUser({
        accessToken: activeSession.accessToken,
        tokenType: activeSession.tokenType,
      });

      set({ user: profile });

      return profile;
    } catch (error) {
      const normalizedError: ApiErrorWithStatus =
        error instanceof Error
          ? (error as ApiErrorWithStatus)
          : Object.assign(new Error('Failed to load profile. Please try again.'), { status: undefined });
      const status = normalizedError.status;

      if (status === 401 && !skipRetry) {
        const storedCredentials = credentialsRef;

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
      if (!silent) {
        set({ isFetchingProfile: false });
      }
    }
  };

  const attemptReauthenticate = async () => {
    if (reauthenticatePromiseRef) {
      return reauthenticatePromiseRef;
    }

    const storedCredentials = credentialsRef;

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
        reauthenticatePromiseRef = null;
      }
    })();

    reauthenticatePromiseRef = promise;

    return promise;
  };

  const hydrateImpl = async (): Promise<HydrationResult> => {
    set({ isHydrating: true });

    try {
      const storageAvailable =
        typeof SecureStore.isAvailableAsync === 'function' ? await SecureStore.isAvailableAsync() : true;

      set({ isStorageAvailable: storageAvailable });

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
            credentialsRef = {
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
            const tokenType = parsedSession.tokenType && parsedSession.tokenType.length > 0 ? parsedSession.tokenType : 'Bearer';
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

      if (credentialsRef) {
        try {
          const sessionFromCredentials = await performLogin(credentialsRef, {
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
    } finally {
      set({ isHydrating: false });
    }

    return null;
  };

  const hydrate = async () => {
    if (hydrationPromiseRef) {
      return hydrationPromiseRef;
    }

    const hydrationPromise = hydrateImpl()
      .catch((error) => {
        console.warn('Failed to hydrate auth session', error);
        return null;
      })
      .finally(() => {
        if (hydrationPromiseRef === hydrationPromise) {
          hydrationPromiseRef = null;
        }
      });

    hydrationPromiseRef = hydrationPromise;

    return hydrationPromise;
  };

  const ensureSession = async () => {
    const currentSession = sessionRef;

    if (currentSession?.accessToken) {
      return currentSession;
    }

    if (hydrationPromiseRef) {
      try {
        const hydrated = await hydrationPromiseRef;

        if (hydrated?.accessToken) {
          return hydrated;
        }
      } catch (error) {
        console.warn('Failed to await auth hydration', error);
      }
    }

    if (!get().isStorageAvailable) {
      return attemptReauthenticate();
    }

    if (ensureSessionPromiseRef) {
      return ensureSessionPromiseRef;
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

        if (!credentialsRef) {
          try {
            const storedCredentialsValue = await SecureStore.getItemAsync(AUTH_CREDENTIALS_KEY);

            if (storedCredentialsValue) {
              const parsedCredentials = JSON.parse(storedCredentialsValue) as Partial<StoredCredentials> | null;

              if (parsedCredentials?.usernameOrEmail && parsedCredentials?.password) {
                credentialsRef = {
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

    ensureSessionPromiseRef = promise;

    const result = await promise;

    if (ensureSessionPromiseRef === promise) {
      ensureSessionPromiseRef = null;
    }

    return result;
  };

  return {
    isSignedIn: false,
    isHydrating: true,
    session: null,
    accessToken: null,
    user: null,
    isFetchingProfile: false,
    isStorageAvailable: true,
    hydrate,
    signIn: async (payload) => {
      const nextSession = await performLogin(payload, { persistStoredCredentials: true });

      try {
        await fetchProfile(nextSession, { silent: false });
      } catch (error) {
        console.warn('Failed to load profile after sign-in', error);
      }
    },
    refreshProfile: () => fetchProfile(undefined, { silent: false }),
    ensureSession,
    updateProfile: async (payload) => {
      const updated = await updateCustomerProfile(payload);
      set({ user: updated });
      return updated;
    },
    signOut: async () => {
      await clearSessionState({ clearCredentials: true });
    },
  };
});

let hasHydratedStore = false;

const ensureAuthStoreHydration = () => {
  if (hasHydratedStore) {
    return;
  }

  hasHydratedStore = true;

  useAuthStore
    .getState()
    .hydrate()
    .catch((error) => {
      console.warn('Failed to hydrate auth store', error);
      hasHydratedStore = false;
    });
};

export function AuthProvider({ children }: { children: ReactNode }) {
  ensureAuthStoreHydration();
  return children;
}

export const useAuth = useAuthStore;
