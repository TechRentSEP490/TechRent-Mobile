declare module 'react-native-toast-message' {
  import * as React from 'react';

  export type ToastShowParams = {
    type?: string;
    text1?: string;
    text2?: string;
    visibilityTime?: number;
    topOffset?: number;
  };

  interface ToastComponent extends React.ComponentType<{ topOffset?: number }> {
    show(params: ToastShowParams): void;
    hide(): void;
  }

  const Toast: ToastComponent;

  export default Toast;
}
