import * as FileSystem from 'expo-file-system/legacy';

const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image';
const MAX_IMAGE_SIZE_BYTES = 1024 * 1024; // 1MB limit from OCR.space free tier

type OcrSpaceParsedResult = {
  ParsedText?: string | null;
  ErrorMessage?: string | string[] | null;
};

type OcrSpaceResponse = {
  IsErroredOnProcessing?: boolean;
  ParsedResults?: OcrSpaceParsedResult[] | null;
  ErrorMessage?: string | string[] | null;
  ErrorDetails?: string | string[] | null;
};

const normalizeErrorMessage = (input?: string | string[] | null) => {
  if (!input) {
    return null;
  }

  if (Array.isArray(input)) {
    const first = input.find((value) => value && value.length > 0);
    return first ?? null;
  }

  return input.length > 0 ? input : null;
};

type ExtractTextArgs = {
  uri: string;
  mimeType?: string;
};

export const extractTextFromImage = async ({ uri, mimeType }: ExtractTextArgs) => {
  if (!uri) {
    throw new Error('Image URI is required for OCR extraction.');
  }

  const apiKey = process.env.EXPO_PUBLIC_OCR_API_KEY;

  if (!apiKey) {
    throw new Error('OCR API key is not configured. Please set EXPO_PUBLIC_OCR_API_KEY.');
  }

  const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });

  if (!fileInfo.exists) {
    throw new Error('Selected image could not be found for OCR processing.');
  }

  if (typeof fileInfo.size === 'number' && fileInfo.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image is too large. Please select a file under 1MB for OCR extraction.');
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });

  const dataUri = `data:${mimeType ?? 'image/jpeg'};base64,${base64}`;
  const formData = new FormData();

  formData.append('apikey', apiKey);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2');
  formData.append('base64Image', dataUri);

  const response = await fetch(OCR_SPACE_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to process OCR request.');
  }

  const payload = (await response.json()) as OcrSpaceResponse;

  if (payload.IsErroredOnProcessing) {
    const message =
      normalizeErrorMessage(payload.ErrorMessage) || normalizeErrorMessage(payload.ErrorDetails);
    throw new Error(message ?? 'The OCR service could not process this image.');
  }

  const parsedText =
    payload.ParsedResults?.map((result) => result.ParsedText ?? '')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join('\n') ?? '';

  return parsedText;
};
