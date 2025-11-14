declare module 'react-native-webview' {
  import type { ComponentType, ReactNode } from 'react';
  import type { ViewProps, NativeSyntheticEvent } from 'react-native';

  export type WebViewSource =
    | { uri: string; method?: string; headers?: Record<string, string>; body?: string }
    | { html: string; baseUrl?: string };

  export interface WebViewError {
    description?: string;
    domain?: string;
    code?: number;
    url?: string;
  }

  export interface WebViewNavigationState {
    url: string;
    title?: string;
    loading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
  }

  export interface WebViewProps extends ViewProps {
    source: WebViewSource;
    startInLoadingState?: boolean;
    renderLoading?: () => ReactNode;
    onError?: (event: NativeSyntheticEvent<WebViewError>) => void;
    onHttpError?: (event: NativeSyntheticEvent<WebViewError>) => void;
    onNavigationStateChange?: (event: WebViewNavigationState) => void;
  }

  export const WebView: ComponentType<WebViewProps>;
  export default WebView;
}

declare module 'react-native-webview/lib/WebViewTypes' {
  import type { NativeSyntheticEvent } from 'react-native';

  export interface WebViewError {
    description?: string;
    domain?: string;
    code?: number;
    url?: string;
  }

  export type WebViewErrorEvent = NativeSyntheticEvent<WebViewError>;
}
