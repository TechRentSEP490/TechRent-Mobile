declare module 'expo-print' {
  export type PrintToFileOptions = {
    html: string;
    base64?: boolean;
    fileName?: string;
    height?: number;
    width?: number;
  };

  export type PrintToFileResult = {
    uri: string;
    numberOfPages?: number;
    base64?: string;
  };

  export function printToFileAsync(options: PrintToFileOptions): Promise<PrintToFileResult>;
}
