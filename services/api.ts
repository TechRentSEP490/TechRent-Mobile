const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.toLowerCase() === 'undefined') {
    throw new Error('API URL is not configured. Please set EXPO_PUBLIC_API_URL.');
  }

  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const normalized = hasProtocol ? trimmed : `http://${trimmed}`;

  return normalized.replace(/\/+$/, '');
};

const HTTP_PROTOCOL_REGEX = /^http:\/\//i;

const upgradeHttpToHttps = (url: string) => {
  try {
    const parsed = new URL(url);

    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
      return parsed.toString();
    }
  } catch (error) {
    console.warn('Failed to parse URL for HTTPS upgrade', error);
  }

  if (HTTP_PROTOCOL_REGEX.test(url)) {
    return url.replace(HTTP_PROTOCOL_REGEX, 'https://');
  }

  return url;
};

let cachedRawBaseUrl: string | null = null;
let cachedNormalizedBaseUrl: string | null = null;

const describeEndpoint = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return url;
  }
};

const isNetworkRequestFailed = (error: unknown) =>
  error instanceof TypeError && /network request failed/i.test(error.message);

export const enhanceNetworkError = (error: unknown, url: string) => {
  const baseDescription = describeEndpoint(url);
  const hint =
    ' Ensure the device can reach the API host and that cleartext HTTP traffic is enabled (set `usesCleartextTraffic` to true or use HTTPS).';

  if (isNetworkRequestFailed(error)) {
    const enhanced = new Error(`Unable to reach ${baseDescription}.${hint}`);
    (enhanced as Error & { cause?: unknown }).cause = error;
    return enhanced;
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(`Failed to reach ${baseDescription}.${hint}`);
};

export const ensureApiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL;

  if (!url) {
    throw new Error('API URL is not configured. Please set EXPO_PUBLIC_API_URL.');
  }

  if (cachedRawBaseUrl === url && cachedNormalizedBaseUrl) {
    return cachedNormalizedBaseUrl;
  }

  const normalized = normalizeBaseUrl(url);

  cachedRawBaseUrl = url;
  cachedNormalizedBaseUrl = normalized;

  return normalized;
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
  retryHttpToHttps?: boolean;
  onRetry?: (nextUrl: string, previousError: unknown) => void;
};

export const fetchWithRetry = async (
  url: string,
  init?: RequestInit,
  options: FetchWithRetryOptions = {}
) => {
  const { retryHttpToHttps = true, onRetry } = options;

  try {
    return await fetch(url, init);
  } catch (error) {
    if (retryHttpToHttps && isNetworkRequestFailed(error) && HTTP_PROTOCOL_REGEX.test(url)) {
      const upgradedUrl = upgradeHttpToHttps(url);

      if (upgradedUrl !== url) {
        onRetry?.(upgradedUrl, error);

        try {
          return await fetch(upgradedUrl, init);
        } catch (retryError) {
          throw enhanceNetworkError(retryError, upgradedUrl);
        }
      }
    }

    throw enhanceNetworkError(error, url);
  }
};

const defaultJsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

type PostJsonWithRetryOptions = {
  description?: string;
  headers?: Record<string, string>;
};

export const postJsonWithRetry = async (
  url: string,
  body: unknown,
  { description = 'API endpoint', headers = {} }: PostJsonWithRetryOptions = {},
) => {
  const label = description.trim().length > 0 ? description : 'API endpoint';
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      ...defaultJsonHeaders,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };

  try {
    return await fetchWithRetry(url, requestInit, {
      onRetry: (nextUrl, networkError) => {
        console.warn(`Failed to reach ${label}, retrying with HTTPS`, networkError, {
          retryUrl: nextUrl,
        });
      },
    });
  } catch (networkError) {
    console.warn(`Failed to reach ${label}`, networkError);
    throw networkError;
  }
};
