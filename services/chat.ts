import { buildApiUrl, ensureApiUrl } from './api';

export type SessionCredentials = {
  accessToken: string;
  tokenType?: string | null;
};

export type ChatConversation = {
  conversationId: number;
  disputeId: number | null;
  customerId: number;
  staffId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SenderType = 'CUSTOMER' | 'STAFF' | string;

export type ChatMessage = {
  messageId: number;
  conversationId: number;
  senderType: SenderType;
  senderId: number;
  content: string;
  isRead: boolean;
  readAt: string | null;
  sentAt: string | null;
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

export type ChatMessagesPage = PaginatedResponse<ChatMessage>;

export type SendChatMessagePayload = {
  conversationId: number;
  senderType?: SenderType;
  senderId: number;
  content: string;
};

const jsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const buildAuthHeader = (session: SessionCredentials) =>
  `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken}`;

const parseErrorMessage = async (response: Response) => {
  try {
    const json = (await response.json()) as Partial<{ message: string; details: string; error: string }>;
    return json?.message ?? json?.details ?? json?.error ?? null;
  } catch (error) {
    console.warn('Failed to parse chat API error', error);
    return null;
  }
};

const normalizeConversation = (payload: Partial<ChatConversation> | null | undefined): ChatConversation | null => {
  if (!payload) {
    return null;
  }

  const id = Number(payload.conversationId);
  const customerId = Number(payload.customerId);
  const staffId = payload.staffId != null ? Number(payload.staffId) : null;
  const disputeId = payload.disputeId != null ? Number(payload.disputeId) : null;

  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(customerId) || customerId <= 0) {
    return null;
  }

  return {
    conversationId: id,
    customerId,
    staffId: Number.isFinite(staffId) && (staffId as number) > 0 ? (staffId as number) : null,
    disputeId: Number.isFinite(disputeId) && (disputeId as number) > 0 ? (disputeId as number) : null,
    createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : null,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
  };
};

const normalizeMessage = (payload: Partial<ChatMessage> | null | undefined): ChatMessage | null => {
  if (!payload) {
    return null;
  }

  const messageId = Number(payload.messageId);
  const conversationId = Number(payload.conversationId);
  const senderId = Number(payload.senderId);
  const content = typeof payload.content === 'string' ? payload.content.trim() : '';

  if (
    !Number.isFinite(messageId) ||
    messageId <= 0 ||
    !Number.isFinite(conversationId) ||
    conversationId <= 0 ||
    !Number.isFinite(senderId) ||
    senderId <= 0 ||
    content.length === 0
  ) {
    return null;
  }

  return {
    messageId,
    conversationId,
    senderId,
    senderType: typeof payload.senderType === 'string' ? payload.senderType : 'CUSTOMER',
    content,
    isRead: Boolean(payload.isRead),
    readAt: typeof payload.readAt === 'string' ? payload.readAt : null,
    sentAt: typeof payload.sentAt === 'string' ? payload.sentAt : null,
  };
};

export async function ensureCustomerConversation(
  customerId: number,
  session: SessionCredentials,
): Promise<ChatConversation> {
  if (!session?.accessToken) {
    throw new Error('An authenticated session is required to access chat.');
  }

  if (!Number.isFinite(customerId) || customerId <= 0) {
    throw new Error('A valid customer identifier is required to start chat.');
  }

  const response = await fetch(buildApiUrl('chat', 'conversations', 'customer', customerId), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: buildAuthHeader(session),
    },
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Unable to create chat conversation (status ${response.status}).`);
  }

  const json = (await response.json()) as ApiEnvelope<ChatConversation> | null;

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    throw new Error(json?.message ?? 'Failed to create chat conversation. Please try again.');
  }

  const normalized = normalizeConversation(json.data);

  if (!normalized) {
    throw new Error('The server returned an invalid conversation payload.');
  }

  return normalized;
}

export async function fetchConversationMessages({
  conversationId,
  session,
  page = 0,
  size = 20,
}: {
  conversationId: number;
  session: SessionCredentials;
  page?: number;
  size?: number;
}): Promise<ChatMessagesPage> {
  if (!session?.accessToken) {
    throw new Error('An authenticated session is required to load messages.');
  }

  if (!Number.isFinite(conversationId) || conversationId <= 0) {
    throw new Error('A valid conversation identifier is required.');
  }

  const resolvedPage = Number.isFinite(page) && page >= 0 ? page : 0;
  const resolvedSize = Number.isFinite(size) && size > 0 ? size : 20;

  const url = new URL(buildApiUrl('chat', 'messages', 'conversation', conversationId));
  url.searchParams.set('page', String(resolvedPage));
  url.searchParams.set('size', String(resolvedSize));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: buildAuthHeader(session),
    },
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Unable to load chat messages (status ${response.status}).`);
  }

  const json = (await response.json()) as ApiEnvelope<PaginatedResponse<ChatMessage>> | null;

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    throw new Error(json?.message ?? 'Failed to load chat messages. Please try again.');
  }

  const normalizedContent = Array.isArray(json.data.content)
    ? json.data.content.map((item) => normalizeMessage(item) ?? null).filter((item): item is ChatMessage => item !== null)
    : [];

  return {
    ...json.data,
    content: normalizedContent,
  };
}

export async function sendChatMessage(
  payload: SendChatMessagePayload,
  session: SessionCredentials,
): Promise<ChatMessage> {
  if (!session?.accessToken) {
    throw new Error('An authenticated session is required to send a message.');
  }

  if (!Number.isFinite(payload.conversationId) || payload.conversationId <= 0) {
    throw new Error('A valid conversation identifier is required.');
  }

  if (!Number.isFinite(payload.senderId) || payload.senderId <= 0) {
    throw new Error('A valid sender identifier is required.');
  }

  const content = payload.content?.trim();

  if (!content) {
    throw new Error('Message content cannot be empty.');
  }

  const response = await fetch(buildApiUrl('chat', 'messages'), {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: buildAuthHeader(session),
    },
    body: JSON.stringify({
      conversationId: payload.conversationId,
      senderType: payload.senderType ?? 'CUSTOMER',
      senderId: payload.senderId,
      content,
    }),
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Unable to send message (status ${response.status}).`);
  }

  const json = (await response.json()) as ApiEnvelope<ChatMessage> | null;

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    throw new Error(json?.message ?? 'Failed to send message. Please try again.');
  }

  const normalized = normalizeMessage(json.data);

  if (!normalized) {
    throw new Error('The server returned an invalid message payload.');
  }

  return normalized;
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

const resolveRealtimeSocketCandidates = (): string[] => {
  const candidates: string[] = [];
  const explicit = process.env.EXPO_PUBLIC_CHAT_WS_URL?.trim();

  if (explicit) {
    candidates.push(ensureSockJsPath(convertToWebSocketScheme(normalizeRealtimeBase(explicit))));
  }

  try {
    const apiBase = ensureApiUrl();
    const baseWithoutApi = apiBase.endsWith('/api') ? apiBase.slice(0, -'/api'.length) : apiBase;
    const converted = convertToWebSocketScheme(normalizeRealtimeBase(baseWithoutApi));
    candidates.push(ensureSockJsPath(`${converted}/ws`));
  } catch (error) {
    console.warn('Unable to derive chat websocket endpoint from API base URL', error);
  }

  return Array.from(new Set(candidates));
};

const ensureRealtimeSocketCandidates = () => {
  const candidates = resolveRealtimeSocketCandidates();

  if (candidates.length === 0) {
    throw new Error('No websocket endpoint configured. Please set EXPO_PUBLIC_CHAT_WS_URL.');
  }

  return candidates;
};

export const buildChatStompUrls = ({
  conversationId,
  senderId,
  session,
}: {
  conversationId: number;
  senderId: number;
  session: SessionCredentials;
}): string[] => {
  if (!session?.accessToken) {
    throw new Error('An authenticated session is required to connect to chat.');
  }

  if (!Number.isFinite(conversationId) || conversationId <= 0) {
    throw new Error('A valid conversation identifier is required to connect to chat.');
  }

  if (!Number.isFinite(senderId) || senderId <= 0) {
    throw new Error('A valid sender identifier is required to connect to chat.');
  }

  return ensureRealtimeSocketCandidates();
};

export const buildChatRealtimeHeaders = (session: SessionCredentials) => {
  if (!session?.accessToken) {
    return null;
  }

  const tokenType = session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer';

  return {
    Authorization: `${tokenType} ${session.accessToken}`,
  } as const;
};

export const chatUtils = {
  normalizeConversation,
  normalizeMessage,
};
