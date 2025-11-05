declare module 'expo-image-picker' {
  export type MediaTypeOption = 'All' | 'Images' | 'Videos';

  export const MediaTypeOptions: {
    All: MediaTypeOption;
    Images: MediaTypeOption;
    Videos: MediaTypeOption;
  };

  export type ImagePickerAsset = {
    uri: string;
    width: number;
    height: number;
    fileName?: string;
    duration?: number;
    mimeType?: string;
  };

  export type ImagePickerResult =
    | {
        canceled: true;
        assets: [];
      }
    | {
        canceled: false;
        assets: ImagePickerAsset[];
      };

  export type ImagePickerOptions = {
    mediaTypes?: MediaTypeOption;
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
    base64?: boolean;
    exif?: boolean;
  };

  export function launchCameraAsync(options?: ImagePickerOptions): Promise<ImagePickerResult>;

  export function launchImageLibraryAsync(options?: ImagePickerOptions): Promise<ImagePickerResult>;

  export type PermissionStatus = 'undetermined' | 'granted' | 'denied';

  export type PermissionResponse = {
    status: PermissionStatus;
    canAskAgain: boolean;
    granted: boolean;
    expires: 'never' | number;
  };

  export function requestCameraPermissionsAsync(): Promise<PermissionResponse>;

  export function requestMediaLibraryPermissionsAsync(): Promise<PermissionResponse>;
}
