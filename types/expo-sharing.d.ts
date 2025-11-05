declare module 'expo-sharing' {
  export type ShareOptions = {
    dialogTitle?: string;
    mimeType?: string;
    UTI?: string;
  };

  export function isAvailableAsync(): Promise<boolean>;
  export function shareAsync(url: string, options?: ShareOptions): Promise<void>;
}
