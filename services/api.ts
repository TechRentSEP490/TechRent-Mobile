const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.toLowerCase() === 'undefined') {
    throw new Error('API URL is not configured. Please set EXPO_PUBLIC_API_URL.');
  }

  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const normalized = hasProtocol ? trimmed : `http://${trimmed}`;

  return normalized.replace(/\/+$/, '');
};

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
