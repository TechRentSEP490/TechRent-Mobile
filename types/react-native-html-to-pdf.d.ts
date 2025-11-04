declare module 'react-native-html-to-pdf' {
  export type HTMLToPDFOptions = {
    html: string;
    fileName?: string;
    base64?: boolean;
    directory?: string;
    width?: number;
    height?: number;
    bgColor?: string;
    fonts?: Record<string, string>;
  };

  export type HTMLToPDFResult = {
    filePath?: string | null;
    path?: string | null;
    base64?: string | null;
  };

  type HTMLToPDFModule = {
    convert(options: HTMLToPDFOptions): Promise<HTMLToPDFResult>;
  };

  const RNHTMLtoPDF: HTMLToPDFModule | null | undefined;
  export default RNHTMLtoPDF;
}
