declare module 'expo-secure-store' {
  export type SecureStoreOptions = {
    keychainService?: string;
    keychainAccessible?: number;
    authenticationPrompt?: string;
    requireAuthentication?: boolean;
  };

  export function isAvailableAsync(): Promise<boolean>;

  export function setItemAsync(
    key: string,
    value: string,
    options?: SecureStoreOptions
  ): Promise<void>;

  export function getItemAsync(
    key: string,
    options?: SecureStoreOptions
  ): Promise<string | null>;

  export function deleteItemAsync(
    key: string,
    options?: SecureStoreOptions
  ): Promise<void>;
}
