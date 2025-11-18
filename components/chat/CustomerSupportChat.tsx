import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AuthSession } from '@/contexts/AuthContext';
import {
  buildChatWebSocketHeaders,
  buildChatWebSocketUrl,
  chatUtils,
  ensureCustomerConversation,
  fetchConversationMessages,
  sendChatMessage,
  type ChatConversation,
  type ChatMessage,
} from '@/services/chat';

export type CustomerSupportChatProps = {
  customerId: number;
  customerName?: string | null;
  ensureSession: () => Promise<AuthSession | null>;
  session: AuthSession | null;
};

type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

const MESSAGE_PAGE_SIZE = 50;
const MAX_INITIAL_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 4000;

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const mergeMessages = (incoming: ChatMessage[], existing: ChatMessage[], replace: boolean) => {
  if (incoming.length === 0) {
    return replace ? [] : existing;
  }

  const nextSource = replace ? incoming : [...existing, ...incoming];
  const messagesById = new Map<number, ChatMessage>();

  nextSource.forEach((message) => {
    messagesById.set(message.messageId, message);
  });

  return Array.from(messagesById.values()).sort((a, b) => {
    const left = a.sentAt ? Date.parse(a.sentAt) : 0;
    const right = b.sentAt ? Date.parse(b.sentAt) : 0;
    return left - right;
  });
};

export function CustomerSupportChat({ customerId, customerName, ensureSession, session }: CustomerSupportChatProps) {
  const [activeSession, setActiveSession] = useState<AuthSession | null>(session);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [isEnsuringConversation, setIsEnsuringConversation] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesPage, setMessagesPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingInitialMessages, setIsLoadingInitialMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('idle');
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const listRef = useRef<FlatList<ChatMessage> | null>(null);
  const pendingScrollToBottomRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const hasConnectedRef = useRef(false);

  const conversationId = conversation?.conversationId ?? null;

  useEffect(() => {
    setActiveSession(session);
  }, [session]);

  const resolveSession = useCallback(async () => {
    if (activeSession?.accessToken) {
      return activeSession;
    }

    const ensured = await ensureSession();

    if (!ensured?.accessToken) {
      throw new Error('You must be signed in to chat with support.');
    }

    setActiveSession(ensured);

    return ensured;
  }, [activeSession, ensureSession]);

  const upsertMessages = useCallback(
    (incoming: ChatMessage[], { replace = false, scrollToBottom = false }: { replace?: boolean; scrollToBottom?: boolean } = {}) => {
      setMessages((prev) => mergeMessages(incoming, prev, replace));

      if (scrollToBottom) {
        pendingScrollToBottomRef.current = true;
      }
    },
    [],
  );

  const ensureConversation = useCallback(async () => {
    if (!Number.isFinite(customerId) || customerId <= 0) {
      setConversationError('Unable to determine your account. Please sign in again.');
      setConversation(null);
      return null;
    }

    setConversationError(null);
    setIsEnsuringConversation(true);

    try {
      const authSession = await resolveSession();
      const nextConversation = await ensureCustomerConversation(customerId, authSession);
      setConversation(nextConversation);
      return nextConversation;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open chat. Please try again.';
      setConversation(null);
      setConversationError(message);
      return null;
    } finally {
      setIsEnsuringConversation(false);
    }
  }, [customerId, resolveSession]);

  useEffect(() => {
    setMessages([]);
    setHasMoreMessages(false);
    setMessagesPage(0);
    void ensureConversation();
  }, [ensureConversation]);

  const loadMessages = useCallback(
    async (pageToLoad = 0) => {
      if (!conversationId) {
        return;
      }

      const isInitial = pageToLoad === 0;
      setMessagesError(null);

      if (isInitial) {
        setIsLoadingInitialMessages(true);
      } else {
        setIsLoadingOlderMessages(true);
      }

      try {
        const authSession = await resolveSession();
        const page = await fetchConversationMessages({
          conversationId,
          session: authSession,
          page: pageToLoad,
          size: MESSAGE_PAGE_SIZE,
        });

        setMessagesPage(page.page);
        setHasMoreMessages(!page.last);
        upsertMessages(page.content, { replace: isInitial, scrollToBottom: isInitial });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load chat messages. Please try again.';
        setMessagesError(message);
      } finally {
        if (isInitial) {
          setIsLoadingInitialMessages(false);
        } else {
          setIsLoadingOlderMessages(false);
        }
      }
    },
    [conversationId, resolveSession, upsertMessages],
  );

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    setMessages([]);
    setHasMoreMessages(false);
    setMessagesPage(0);
    void loadMessages(0);
  }, [conversationId, loadMessages]);

  useEffect(() => {
    if (!pendingScrollToBottomRef.current) {
      return;
    }

    pendingScrollToBottomRef.current = false;

    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const handleLoadMore = useCallback(() => {
    if (!hasMoreMessages || isLoadingOlderMessages || isLoadingInitialMessages) {
      return;
    }

    void loadMessages(messagesPage + 1);
  }, [hasMoreMessages, isLoadingOlderMessages, isLoadingInitialMessages, loadMessages, messagesPage]);

  const handleRefresh = useCallback(() => {
    if (!conversationId) {
      return;
    }

    void loadMessages(0);
  }, [conversationId, loadMessages]);

  const handleSend = useCallback(async () => {
    if (!conversationId || isSending) {
      return;
    }

    const trimmed = composerValue.trim();

    if (!trimmed) {
      setComposerError('Enter a message to continue.');
      return;
    }

    setComposerError(null);
    setIsSending(true);

    try {
      const authSession = await resolveSession();
      const message = await sendChatMessage(
        {
          conversationId,
          content: trimmed,
          senderId: customerId,
          senderType: 'CUSTOMER',
        },
        authSession,
      );

      setComposerValue('');
      upsertMessages([message], { replace: false, scrollToBottom: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send your message. Please try again.';
      setComposerError(message);
    } finally {
      setIsSending(false);
    }
  }, [composerValue, conversationId, customerId, isSending, resolveSession, upsertMessages]);

  useEffect(() => {
    if (!conversationId || !activeSession?.accessToken) {
      return;
    }

    reconnectAttemptsRef.current = 0;
    hasConnectedRef.current = false;

    let isMounted = true;
    let reconnectHandle: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!isMounted) {
        return;
      }

      if (!hasConnectedRef.current && reconnectAttemptsRef.current >= MAX_INITIAL_RECONNECT_ATTEMPTS) {
        setRealtimeStatus('disconnected');
        setRealtimeError('Unable to connect to live chat. Please check your network and tap retry.');
        return;
      }

      setRealtimeStatus('connecting');
      setRealtimeError(null);

      let socket: WebSocket | null = null;

      try {
        const wsUrl = buildChatWebSocketUrl({
          conversationId,
          senderId: customerId,
          senderType: 'CUSTOMER',
          session: activeSession,
        });

        const headers = buildChatWebSocketHeaders(activeSession);
        const socketOptions = headers ? ({ headers } as any) : undefined;

        socket = socketOptions ? new WebSocket(wsUrl, undefined, socketOptions) : new WebSocket(wsUrl);
        reconnectAttemptsRef.current += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to connect to live chat.';
        setRealtimeStatus('disconnected');
        setRealtimeError(message);
        return;
      }

      wsRef.current = socket;

      socket.onopen = () => {
        if (!isMounted) {
          return;
        }

        hasConnectedRef.current = true;
        reconnectAttemptsRef.current = 0;
        setRealtimeStatus('connected');
        setRealtimeError(null);
      };

      socket.onmessage = (event) => {
        if (!event?.data) {
          return;
        }

        try {
          const parsed = JSON.parse(event.data as string);
          const upsertable = chatUtils.normalizeMessage(parsed as ChatMessage);

          if (upsertable) {
            upsertMessages([upsertable], { scrollToBottom: true });
          }
        } catch (error) {
          console.warn('Failed to parse chat socket message', error);
        }
      };

      socket.onerror = () => {
        if (!isMounted) {
          return;
        }

        setRealtimeStatus('disconnected');
        setRealtimeError('Realtime connection interrupted. Reconnecting...');
      };

      socket.onclose = () => {
        if (!isMounted) {
          return;
        }

        wsRef.current = null;
        setRealtimeStatus('disconnected');

        const reachedLimit =
          !hasConnectedRef.current && reconnectAttemptsRef.current >= MAX_INITIAL_RECONNECT_ATTEMPTS;

        if (reachedLimit) {
          setRealtimeError('Unable to connect to live chat. Please check your network and tap retry.');
          return;
        }

        reconnectHandle = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      isMounted = false;

      if (reconnectHandle) {
        clearTimeout(reconnectHandle);
      }

      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [activeSession, conversationId, customerId, reconnectNonce, upsertMessages]);

  const handleRealtimeRetry = useCallback(() => {
    setReconnectNonce((prev) => prev + 1);
  }, []);

  const realtimeLabel = useMemo(() => {
    switch (realtimeStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting…';
      case 'disconnected':
        return 'Offline';
      default:
        return 'Idle';
    }
  }, [realtimeStatus]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isCustomerMessage = item.senderId === customerId && item.senderType?.toUpperCase() === 'CUSTOMER';
      const senderLabel = isCustomerMessage ? customerName ?? 'You' : 'Support';

      return (
        <View style={[styles.messageRow, isCustomerMessage ? styles.messageRowSelf : styles.messageRowPeer]}>
          <View style={[styles.messageBubble, isCustomerMessage ? styles.messageBubbleSelf : styles.messageBubblePeer]}>
            <Text style={[styles.messageText, isCustomerMessage && styles.messageTextSelf]}>{item.content}</Text>
            <Text style={styles.messageMeta}>
              {senderLabel}
              {item.sentAt ? ` • ${formatTimestamp(item.sentAt)}` : ''}
            </Text>
          </View>
        </View>
      );
    },
    [customerId, customerName],
  );

  const renderFooter = useMemo(() => {
    if (!hasMoreMessages) {
      return null;
    }

    if (!isLoadingOlderMessages) {
      return (
        <View style={styles.loadMoreHint}>
          <Text style={styles.loadMoreText}>Scroll to load earlier messages</Text>
        </View>
      );
    }

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#111111" />
      </View>
    );
  }, [hasMoreMessages, isLoadingOlderMessages]);

  if (isEnsuringConversation) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="small" color="#111111" />
        <Text style={styles.stateMessage}>Connecting you with support…</Text>
      </View>
    );
  }

  if (conversationError) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateMessage}>{conversationError}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setMessages([]);
            setHasMoreMessages(false);
            setMessagesPage(0);
            void ensureConversation();
          }}
        >
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.chatWrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={24}
    >
      <View style={styles.realtimeBanner}>
        <View
          style={[
            styles.realtimeIndicator,
            realtimeStatus === 'connected'
              ? styles.realtimeIndicatorOnline
              : realtimeStatus === 'connecting'
                ? styles.realtimeIndicatorConnecting
                : styles.realtimeIndicatorOffline,
          ]}
        />
        <Text style={styles.realtimeText}>{realtimeLabel}</Text>
      </View>
      {realtimeError && (
        <View style={styles.realtimeErrorRow}>
          <Text style={styles.realtimeError}>{realtimeError}</Text>
          {realtimeStatus === 'disconnected' && (
            <TouchableOpacity style={styles.realtimeRetryButton} onPress={handleRealtimeRetry}>
              <Text style={styles.realtimeRetryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={styles.messagesCard}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.messageId.toString()}
          renderItem={renderMessage}
          contentContainerStyle={messages.length === 0 ? styles.messagesEmpty : styles.messagesContent}
          onEndReachedThreshold={0.15}
          onEndReached={handleLoadMore}
          ListFooterComponent={renderFooter}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={isLoadingInitialMessages && messages.length > 0} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {isLoadingInitialMessages ? (
                <ActivityIndicator size="small" color="#111111" />
              ) : messagesError ? (
                <Text style={styles.emptyStateText}>{messagesError}</Text>
              ) : (
                <Text style={styles.emptyStateText}>Start the conversation by saying hello 👋</Text>
              )}
            </View>
          }
        />
      </View>
      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          value={composerValue}
          onChangeText={setComposerValue}
          placeholder="Write a message"
          multiline
          editable={!isSending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (isSending || !composerValue.trim()) && styles.sendButtonDisabled]}
          disabled={isSending || !composerValue.trim()}
          onPress={() => void handleSend()}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="send" size={18} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>
      {composerError && <Text style={styles.composerError}>{composerError}</Text>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chatWrapper: {
    flex: 1,
  },
  realtimeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  realtimeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  realtimeIndicatorOnline: {
    backgroundColor: '#16a34a',
  },
  realtimeIndicatorConnecting: {
    backgroundColor: '#fbbf24',
  },
  realtimeIndicatorOffline: {
    backgroundColor: '#ef4444',
  },
  realtimeText: {
    fontSize: 12,
    color: '#555555',
  },
  realtimeErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  realtimeError: {
    fontSize: 12,
    color: '#b45309',
  },
  realtimeRetryButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#b45309',
  },
  realtimeRetryText: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '600',
  },
  messagesCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderWidth: 1,
    borderColor: '#eeeeee',
  },
  messagesContent: {
    paddingBottom: 16,
  },
  messagesEmpty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#6b6b6b',
  },
  messageRow: {
    width: '100%',
    marginBottom: 12,
  },
  messageRowSelf: {
    alignItems: 'flex-end',
  },
  messageRowPeer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleSelf: {
    backgroundColor: '#111111',
    borderBottomRightRadius: 4,
  },
  messageBubblePeer: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#111111',
  },
  messageTextSelf: {
    color: '#ffffff',
  },
  messageMeta: {
    marginTop: 6,
    fontSize: 11,
    color: '#8d8d8d',
    textAlign: 'right',
  },
  loadMoreHint: {
    paddingVertical: 8,
  },
  loadMoreText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#6f6f6f',
  },
  footerLoader: {
    paddingVertical: 12,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  composerError: {
    marginTop: 8,
    fontSize: 12,
    color: '#b91c1c',
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateMessage: {
    textAlign: 'center',
    color: '#444444',
    fontSize: 15,
    lineHeight: 22,
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#111111',
  },
  retryButtonText: {
    color: '#111111',
    fontWeight: '600',
  },
});
