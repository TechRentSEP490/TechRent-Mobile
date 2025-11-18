import { buildApiUrl, ensureApiUrl } from './api';
import type { SessionCredentials } from './chat';

export type NotificationType =
  | 'ORDER_REJECTED'
  | 'ORDER_PROCESSING'
  | 'ORDER_CONFIRMED'
  | 'ORDER_IN_DELIVERY'
  | 'ORDER_ACTIVE'
  | 'ORDER_NEAR_DUE'
  | string;

export type CustomerNotification = {
  notificationId: number;
  customerId: number;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string | null;
};

type ApiEnvelope<TData> = {
  status: string;
  message?: string | null;
  details?: string | null;
  code?: number;
  data: TData | null;
};

type PaginatedResponse<TItem> = {
  content: TItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  numberOfElements: number;
  last: boolean;
};

export type CustomerNotificationsPage = PaginatedResponse<CustomerNotification>;

const jsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const buildAuthHeader = (session: SessionCredentials) => {
  const tokenType = session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer';
  return `${tokenType} ${session.accessToken}`;
};

const parseErrorMessage = async (response: Response) => {
  try {
    const json = (await response.json()) as Partial<{ message: string; details: string; error: string }>;
    return json?.message ?? json?.details ?? json?.error ?? null;
  } catch (error) {
    console.warn('Failed to parse notification API error', error);
    return null;
  }
};

export const normalizeNotification = (
  payload: Partial<CustomerNotification> | null | undefined,
): CustomerNotification | null => {
  if (!payload) {
    return null;
  }

  const notificationId = Number(payload.notificationId);
  const customerId = Number(payload.customerId);
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const type = typeof payload.type === 'string' && payload.type.length > 0 ? payload.type : 'ORDER_PROCESSING';

  if (!Number.isFinite(notificationId) || notificationId <= 0) {
    return null;
  }

  if (!Number.isFinite(customerId) || customerId <= 0) {
    return null;
  }

  if (title.length === 0 && message.length === 0) {
    return null;
  }

  return {
    notificationId,
    customerId,
    title: title.length > 0 ? title : message,
    message: message.length > 0 ? message : title,
    type,
    read: Boolean(payload.read),
    createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : null,
  };
};

const buildNotificationListEndpoints = (customerId: number) => {
  const endpoints = [buildApiUrl('customers', 'me', 'notifications')];

  if (Number.isFinite(customerId) && customerId > 0) {
    endpoints.push(
      buildApiUrl('notifications', 'customer', customerId),
      buildApiUrl('customers', customerId, 'notifications'),
    );
  }

  return endpoints;
};

const buildMarkAllEndpoints = (customerId: number) => {
  const endpoints = [buildApiUrl('customers', 'me', 'notifications', 'read')];

  if (Number.isFinite(customerId) && customerId > 0) {
    endpoints.push(
      buildApiUrl('notifications', 'customer', customerId, 'read'),
      buildApiUrl('customers', customerId, 'notifications', 'read'),
    );
  }

  return endpoints;
};

export async function fetchCustomerNotifications({
  customerId,
  session,
  page = 0,
  size = 20,
}: {
  customerId: number;
  session: SessionCredentials;
  page?: number;
  size?: number;
}): Promise<CustomerNotificationsPage> {
  if (!session?.accessToken) {
    throw new Error('An authenticated session is required to load notifications.');
  }

  if (!Number.isFinite(customerId) || customerId <= 0) {
    throw new Error('A valid customer identifier is required.');
  }

  const resolvedPage = Number.isFinite(page) && page >= 0 ? page : 0;
  const resolvedSize = Number.isFinite(size) && size > 0 ? size : 20;

  const candidateUrls = buildNotificationListEndpoints(customerId).map((endpoint) => {
    const url = new URL(endpoint);
    url.searchParams.set('page', String(resolvedPage));
    url.searchParams.set('size', String(resolvedSize));
    return url;
  });

  let lastError: Error | null = null;

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: buildAuthHeader(session),
        },
      });

      if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        throw new Error(apiMessage ?? `Unable to load notifications (status ${response.status}).`);
      }

      const json = (await response.json()) as ApiEnvelope<PaginatedResponse<CustomerNotification>> | null;

      if (!json || json.status !== 'SUCCESS' || !json.data) {
        throw new Error(json?.message ?? 'Failed to load notifications. Please try again.');
      }

      const normalizedContent = Array.isArray(json.data.content)
        ? json.data.content
            .map((item) => normalizeNotification(item) ?? null)
            .filter((item): item is CustomerNotification => item !== null)
        : [];

      return {
        ...json.data,
        content: normalizedContent,
      };
    } catch (error) {
      const capturedError = error instanceof Error ? error : new Error('Unable to load notifications.');
      console.warn('Notification list request failed', { url: url.toString(), message: capturedError.message });
      lastError = capturedError;
    }
  }

  throw lastError ?? new Error('Unable to load notifications.');
}

export async function markNotificationRead(notificationId: number, session: SessionCredentials) {
  if (!session?.accessToken) {
    throw new Error('You must be signed in to mark notifications as read.');
  }

  if (!Number.isFinite(notificationId) || notificationId <= 0) {
    throw new Error('A valid notification identifier is required.');
  }

  const response = await fetch(buildApiUrl('notifications', notificationId, 'read'), {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: buildAuthHeader(session),
    },
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Failed to update notification (status ${response.status}).`);
  }
}

export async function markAllNotificationsRead(customerId: number, session: SessionCredentials) {
  if (!session?.accessToken) {
    throw new Error('You must be signed in to mark notifications as read.');
  }

  if (!Number.isFinite(customerId) || customerId <= 0) {
    throw new Error('A valid customer identifier is required.');
  }

  const endpoints = buildMarkAllEndpoints(customerId);
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...jsonHeaders,
          Authorization: buildAuthHeader(session),
        },
      });

      if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        throw new Error(apiMessage ?? `Failed to update notifications (status ${response.status}).`);
      }

      return;
    } catch (error) {
      const capturedError = error instanceof Error ? error : new Error('Failed to update notifications.');
      console.warn('Notification mark-all request failed', { url: endpoint, message: capturedError.message });
      lastError = capturedError;
    }
  }

  throw lastError ?? new Error('Failed to update notifications.');
}

const normalizeRealtimeBase = (value: string) => value.replace(/\/$/, '');

const convertToWebSocketScheme = (value: string) => {
  if (value.startsWith('http://')) {
    return `ws://${value.slice('http://'.length)}`;
  }

  if (value.startsWith('https://')) {
    return `wss://${value.slice('https://'.length)}`;
  }

  return value;
};

const ensureSockJsPath = (value: string) => {
  const normalized = value.replace(/\/$/, '');

  if (normalized.endsWith('/ws/websocket')) {
    return normalized;
  }

  if (normalized.endsWith('/ws')) {
    return `${normalized}/websocket`;
  }

  return `${normalized}/ws/websocket`;
};

const resolveNotificationSocketCandidates = (): string[] => {
  const candidates: string[] = [];
  const explicit = process.env.EXPO_PUBLIC_NOTIFICATIONS_WS_URL?.trim();

  if (explicit) {
    candidates.push(ensureSockJsPath(convertToWebSocketScheme(normalizeRealtimeBase(explicit))));
  }

  try {
    const apiBase = ensureApiUrl();
    const baseWithoutApi = apiBase.endsWith('/api') ? apiBase.slice(0, -'/api'.length) : apiBase;
    const converted = convertToWebSocketScheme(normalizeRealtimeBase(baseWithoutApi));
    candidates.push(ensureSockJsPath(`${converted}/ws`));
  } catch (error) {
    console.warn('Unable to derive notification websocket endpoint from API base URL', error);
  }

  return Array.from(new Set(candidates));
};

export const buildNotificationStompUrls = () => {
  const candidates = resolveNotificationSocketCandidates();

  if (candidates.length === 0) {
    throw new Error('No notification websocket endpoint configured. Please set EXPO_PUBLIC_NOTIFICATIONS_WS_URL.');
  }

  return candidates;
};

export const buildNotificationRealtimeHeaders = (session: SessionCredentials | null) => {
  if (!session?.accessToken) {
    return null;
  }

  return {
    Authorization: buildAuthHeader(session),
  } as const;
};
