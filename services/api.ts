const normalizeBaseUrl = (value: string) => value.replace(/\/$/, '');

export const ensureApiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL;

  if (!url) {
    throw new Error('API URL is not configured. Please set EXPO_PUBLIC_API_URL.');
  }

  return normalizeBaseUrl(url);
};

export const buildApiUrl = (...segments: Array<string | number>) => {
  const baseUrl = ensureApiUrl();
  const path = segments
    .map((segment) => String(segment).replace(/^\/+|\/+$/g, ''))
    .filter((segment) => segment.length > 0)
    .join('/');

  return path.length > 0 ? `${baseUrl}/${path}` : baseUrl;
};

type FetchWithRetryOptions = {
  maxAttempts?: number;
  onRetry?: (nextUrl: string, error: unknown, attempt: number) => void;
};

const swapToHttps = (url: string) =>
  url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url;

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { maxAttempts = 2, onRetry } = options;
  let attempt = 0;
  let currentUrl = url;
  let lastError: unknown = null;

  while (attempt < maxAttempts) {
    try {
      return await fetch(currentUrl, init);
    } catch (error) {
      lastError = error;
      attempt += 1;

      if (attempt >= maxAttempts) {
        throw error;
      }

      const nextUrl = swapToHttps(currentUrl);

      if (nextUrl === currentUrl) {
        throw error;
      }

      onRetry?.(nextUrl, error, attempt);
      currentUrl = nextUrl;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('fetchWithRetry failed to resolve request.');
}
