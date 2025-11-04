declare module 'expo-file-system' {
  export type CopyOptions = {
    from: string;
    to: string;
  };

  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;
  export function copyAsync(options: CopyOptions): Promise<void>;
}
