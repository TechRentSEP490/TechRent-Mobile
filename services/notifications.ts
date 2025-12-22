import { ensureApiUrl } from './api';
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

const buildAuthHeader = (session: SessionCredentials) => {
  const tokenType = session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer';
  return `${tokenType} ${session.accessToken}`;
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
