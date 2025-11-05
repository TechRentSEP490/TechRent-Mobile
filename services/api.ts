const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.toLowerCase() === 'undefined') {
    throw new Error('API URL is not configured. Please set EXPO_PUBLIC_API_URL.');
  }

  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const normalized = hasProtocol ? trimmed : `http://${trimmed}`;

  return normalized.replace(/\/+$/, '');
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
