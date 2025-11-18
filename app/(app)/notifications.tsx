import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { fetchContracts, type ContractResponse } from '@/services/contracts';
import {
  fetchRentalOrderById,
  fetchRentalOrders,
  type RentalOrderResponse,
} from '@/services/rental-orders';
import {
  buildNotificationRealtimeHeaders,
  buildNotificationStompUrls,
  type CustomerNotification,
  type NotificationType,
} from '@/services/notifications';
import { STOMP_CONNECT_HEADERS, buildStompFrame, parseStompFrames } from '@/utils/stomp';
import styles from '@/style/notifications.styles';

type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

type NotificationMeta = {
  icon: string;
  color: string;
  background: string;
  label: string;
  actionLabel?: string;
  action?: 'orders' | 'chat';
};

type OrderStatusNotification = CustomerNotification & {
  key: string;
  orderId: number;
  actionLabel?: string;
  action?: 'orders' | 'chat';
};

const notificationTypeMeta: Record<string, NotificationMeta> = {
  ORDER_REJECTED: {
    icon: 'close-circle',
    color: '#e74c3c',
    background: '#fdecea',
    label: 'Rejected',
    actionLabel: 'Contact support',
    action: 'chat',
  },
  ORDER_PROCESSING: {
    icon: 'time',
    color: '#f59e0b',
    background: '#fff7ed',
    label: 'Processing',
    actionLabel: 'View order',
    action: 'orders',
  },
  ORDER_CONFIRMED: {
    icon: 'checkmark-circle',
    color: '#2ecc71',
    background: '#eafaf1',
    label: 'Confirmed',
    actionLabel: 'Review details',
    action: 'orders',
  },
  ORDER_IN_DELIVERY: {
    icon: 'cube',
    color: '#8e44ad',
    background: '#f5eef8',
    label: 'In delivery',
    actionLabel: 'Track delivery',
    action: 'orders',
  },
  ORDER_ACTIVE: {
    icon: 'flash',
    color: '#4f46e5',
    background: '#eef2ff',
    label: 'Active',
    actionLabel: 'Manage plan',
    action: 'orders',
  },
  ORDER_NEAR_DUE: {
    icon: 'alert-circle',
    color: '#d35400',
    background: '#fdf2e9',
    label: 'Near due',
    actionLabel: 'Renew now',
    action: 'orders',
  },
};

const defaultNotificationMeta: NotificationMeta = {
  icon: 'notifications-outline',
  color: '#4f46e5',
  background: '#f5f3ff',
  label: 'Update',
};

const resolveNotificationMeta = (type: NotificationType) => notificationTypeMeta[type] ?? defaultNotificationMeta;

const statusAliasMap: Record<string, NotificationType> = {
  PROCESSING: 'ORDER_PROCESSING',
  CONFIRMED: 'ORDER_CONFIRMED',
  READY_FOR_DELIVERY: 'ORDER_IN_DELIVERY',
  DELIVERY_CONFIRMED: 'ORDER_ACTIVE',
  ACTIVE: 'ORDER_ACTIVE',
  NEAR_DUE: 'ORDER_NEAR_DUE',
  REJECTED: 'ORDER_REJECTED',
};

const normalizeOrderId = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const normalizeOrderStatus = (value: unknown): NotificationType | '' => {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }

  const upper = value.toUpperCase();

  if (upper in statusAliasMap) {
    return statusAliasMap[upper];
  }

  if (upper.startsWith('ORDER_')) {
    return upper as NotificationType;
  }

  return '';
};

const deriveOrderInfo = (payload: Record<string, unknown>) => {
  if (!payload) {
    return { orderId: null, status: '' as NotificationType | '' };
  }

  const merged = {
    ...payload,
    ...(typeof payload.order === 'object' && payload.order ? payload.order : {}),
    ...(typeof payload.data === 'object' && payload.data ? payload.data : {}),
    ...(typeof payload.detail === 'object' && payload.detail ? payload.detail : {}),
  } as Record<string, unknown>;

  const orderId =
    normalizeOrderId(merged.orderId) ??
    normalizeOrderId(merged.rentalOrderId) ??
    normalizeOrderId(merged.id) ??
    normalizeOrderId(merged.referenceId);

  const status =
    normalizeOrderStatus(merged.orderStatus) ||
    normalizeOrderStatus(merged.status) ||
    normalizeOrderStatus(merged.state) ||
    normalizeOrderStatus(merged.newStatus);

  return { orderId, status };
};

const buildContractsMap = (contracts: ContractResponse[]): Map<number, ContractResponse> => {
  const map = new Map<number, ContractResponse>();

  contracts.forEach((contract) => {
    const record = contract as Record<string, unknown> & {
      order?: { orderId?: unknown };
    };

    const nestedOrderId = record.order?.orderId;
    const orderId = normalizeOrderId(contract.orderId) ?? normalizeOrderId(nestedOrderId);

    if (orderId) {
      map.set(orderId, contract);
    }
  });

  return map;
};

const generateNotificationId = (orderId: number, status: string) => {
  let hash = 0;

  for (let index = 0; index < status.length; index += 1) {
    hash = (hash * 31 + status.charCodeAt(index)) >>> 0;
  }

  return orderId * 1000 + (hash % 1000);
};

type StatusContentMeta = {
  title: (context: { displayCode: string | number }) => string;
  description: (context: { hasContract: boolean }) => string;
  actionLabel?: string;
  action?: 'orders' | 'chat';
};

const statusContentMeta: Record<string, StatusContentMeta> = {
  ORDER_REJECTED: {
    title: ({ displayCode }) => `Order #${displayCode} was rejected`,
    description: () => 'Your order could not be approved. Contact support if you have questions.',
    actionLabel: 'Contact support',
    action: 'chat',
  },
  ORDER_PROCESSING: {
    title: ({ displayCode }) => `Order #${displayCode} is processing`,
    description: ({ hasContract }) =>
      hasContract
        ? 'Please review and sign your contract so we can prepare your devices.'
        : 'We are verifying your documents. We will notify you as soon as the contract is ready.',
    actionLabel: 'View order',
    action: 'orders',
  },
  ORDER_CONFIRMED: {
    title: ({ displayCode }) => `Order #${displayCode} was confirmed`,
    description: () => 'Great news! Your order is confirmed. We will prepare your delivery shortly.',
    actionLabel: 'Review details',
    action: 'orders',
  },
  ORDER_IN_DELIVERY: {
    title: ({ displayCode }) => `Order #${displayCode} is on the way`,
    description: () => 'Track your courier and make sure someone is available to receive the devices.',
    actionLabel: 'Track delivery',
    action: 'orders',
  },
  ORDER_ACTIVE: {
    title: ({ displayCode }) => `Order #${displayCode} is active`,
    description: () => 'Enjoy your rental period. Reach out if you need adjustments or assistance.',
    actionLabel: 'Manage plan',
    action: 'orders',
  },
  ORDER_NEAR_DUE: {
    title: ({ displayCode }) => `Order #${displayCode} is almost due`,
    description: () => 'Renew, extend, or prepare your devices for return before the due date.',
    actionLabel: 'Renew now',
    action: 'orders',
  },
};

const buildNotificationFromOrder = (
  order: RentalOrderResponse,
  contractsMap: Map<number, ContractResponse>,
  fallbackCustomerId: number | null,
): OrderStatusNotification | null => {
  const orderId = normalizeOrderId(order.orderId) ?? normalizeOrderId((order as Record<string, unknown>).id);

  if (!orderId) {
    return null;
  }

  const status = normalizeOrderStatus(order.orderStatus);

  if (!status) {
    return null;
  }

  const contentMeta = statusContentMeta[status];

  if (!contentMeta) {
    return null;
  }

  const displayCode = order.orderId ?? orderId;
  const hasContract = contractsMap.has(orderId);
  const timeline = order as RentalOrderResponse & { updatedAt?: string | null };
  const title = contentMeta.title({ displayCode });
  const description = contentMeta.description({ hasContract });
  const createdAt = timeline.updatedAt ?? order.createdAt ?? null;
  const key = `${orderId}-${status}`;
  const notificationId = generateNotificationId(orderId, status);

  return {
    key,
    orderId,
    notificationId,
    customerId: Number(order.customerId ?? fallbackCustomerId ?? 0),
    title,
    message: description,
    type: status,
    read: false,
    createdAt,
    actionLabel: contentMeta.actionLabel,
    action: contentMeta.action,
  };
};

const shouldRefreshContracts = (status: NotificationType | '') => status === 'ORDER_PROCESSING';

const sortByCreatedAtDesc = (
  left: { createdAt: string | null },
  right: { createdAt: string | null },
) => {
  const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
  const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
  return rightTime - leftTime;
};

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
};

const RECONNECT_DELAY_MS = 4000;

export default function NotificationsScreen() {
  const router = useRouter();
  const { isSignedIn, isHydrating, user, session } = useAuth();
  const customerId = user?.customerId ?? null;

  const [notifications, setNotifications] = useState<OrderStatusNotification[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [, setRealtimeStatus] = useState<RealtimeStatus>('idle');
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const stompConnectedRef = useRef(false);
  const reconnectHandleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingHandleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contractsMapRef = useRef<Map<number, ContractResponse>>(new Map<number, ContractResponse>());

  const hasNotifications = notifications.length > 0;
  const markAllDisabled = !hasNotifications || isMarkingAll;

  const replaceNotifications = useCallback((items: OrderStatusNotification[]) => {
    setNotifications((prev) => {
      const prevReadMap = new Map(prev.map((item) => [item.key, item.read]));
      return items
        .map((item) => ({
          ...item,
          read: prevReadMap.get(item.key) ?? item.read ?? false,
        }))
        .sort(sortByCreatedAtDesc)
        .slice(0, 30);
    });
  }, []);

  const upsertNotifications = useCallback((items: OrderStatusNotification[]) => {
    if (!items || items.length === 0) {
      return;
    }

    setNotifications((prev) => {
      const map = new Map(prev.map((item) => [item.key, item]));
      items.forEach((item) => {
        if (!item) {
          return;
        }
        const existing = map.get(item.key);
        map.set(item.key, {
          ...item,
          read: existing?.read ?? item.read ?? false,
        });
      });

      return Array.from(map.values()).sort(sortByCreatedAtDesc).slice(0, 30);
    });
  }, []);

  const refreshContractsMap = useCallback(async () => {
    if (!session?.accessToken) {
      return contractsMapRef.current;
    }

    try {
      const contracts = await fetchContracts(session);
      const map = buildContractsMap(Array.isArray(contracts) ? contracts : []);
      contractsMapRef.current = map;
      return map;
    } catch (error) {
      console.warn('[Notifications] Failed to load contracts', error);
      return contractsMapRef.current;
    }
  }, [session]);

  const loadOrdersAsNotifications = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!customerId || !session?.accessToken) {
        setIsInitialLoading(false);
        return;
      }

      if (!silent) {
        setIsInitialLoading(true);
      }

      try {
        const [orders, contractsMap] = await Promise.all([
          fetchRentalOrders(session),
          refreshContractsMap(),
        ]);
        const map = contractsMap ?? contractsMapRef.current;
        const mapped = (orders || [])
          .map((order) => buildNotificationFromOrder(order, map, customerId))
          .filter((item): item is OrderStatusNotification => Boolean(item));

        replaceNotifications(mapped);
      } catch (error) {
        if (!silent) {
          const message = error instanceof Error ? error.message : 'Unable to load notifications.';
          Alert.alert('Notifications', message);
        } else {
          console.warn('[Notifications] Failed to refresh notifications', error);
        }
      } finally {
        if (!silent) {
          setIsInitialLoading(false);
        }
      }
    },
    [customerId, session, refreshContractsMap, replaceNotifications],
  );

  const handleRefresh = useCallback(() => {
    if (!customerId || !isSignedIn || !session?.accessToken) {
      return;
    }

    setRefreshing(true);
    setReconnectNonce((prev) => prev + 1);

    void (async () => {
      try {
        await loadOrdersAsNotifications({ silent: true });
      } finally {
        setRefreshing(false);
      }
    })();
  }, [customerId, isSignedIn, session, loadOrdersAsNotifications]);

  const markNotificationLocally = useCallback((notificationKey: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.key === notificationKey ? { ...item, read: true } : item)),
    );
  }, []);

  const handleCardPress = useCallback(
    (notification: OrderStatusNotification) => {
      if (notification.read) {
        return;
      }

      markNotificationLocally(notification.key);
    },
    [markNotificationLocally],
  );

  const handleActionPress = useCallback(
    (notification: OrderStatusNotification) => {
      const meta = resolveNotificationMeta(notification.type);
      const actionTarget = notification.action ?? meta.action;

      markNotificationLocally(notification.key);

      if (actionTarget === 'orders') {
        router.push('/(app)/(tabs)/orders');
        return;
      }

      if (actionTarget === 'chat') {
        router.push('/(app)/chat');
        return;
      }

      Alert.alert('Notification', 'Additional handling for this notification is coming soon.');
    },
    [markNotificationLocally, router],
  );

  const handleMarkAllRead = useCallback(() => {
    if (!customerId || !isSignedIn || markAllDisabled) {
      return;
    }

    setIsMarkingAll(true);
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));

    setTimeout(() => {
      setIsMarkingAll(false);
    }, 300);
  }, [customerId, isSignedIn, markAllDisabled]);

  const handleRealtimeRetry = useCallback(() => {
    setReconnectNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!customerId || !isSignedIn || !session?.accessToken) {
      setNotifications([]);
      setIsInitialLoading(false);
      contractsMapRef.current = new Map<number, ContractResponse>();
      if (pollingHandleRef.current) {
        clearInterval(pollingHandleRef.current);
        pollingHandleRef.current = null;
      }
      return;
    }

    loadOrdersAsNotifications();

    if (pollingHandleRef.current) {
      clearInterval(pollingHandleRef.current);
    }

    pollingHandleRef.current = setInterval(() => {
      loadOrdersAsNotifications({ silent: true });
    }, 5000);

    return () => {
      if (pollingHandleRef.current) {
        clearInterval(pollingHandleRef.current);
        pollingHandleRef.current = null;
      }
    };
  }, [customerId, isSignedIn, session, loadOrdersAsNotifications]);

  useEffect(() => {
    if (!customerId || !isSignedIn || !session?.accessToken) {
      setNotifications([]);
      setRealtimeStatus('idle');
      setRealtimeError(null);
      setIsInitialLoading(false);
      return () => {};
    }

    let isMounted = true;

    const connect = () => {
      if (!isMounted) {
        return;
      }

      let candidates: string[] = [];

      try {
        candidates = buildNotificationStompUrls();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to connect to notifications.';
        setRealtimeStatus('disconnected');
        setRealtimeError(message);
        return;
      }

      setRealtimeStatus('connecting');
      setRealtimeError(null);

      const tryCandidate = (index: number) => {
        if (!isMounted) {
          return;
        }

        if (index >= candidates.length) {
          setRealtimeStatus('disconnected');
          setRealtimeError('Unable to connect to live notifications.');
          setIsInitialLoading(false);
          reconnectHandleRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
          return;
        }

        const wsUrl = candidates[index];
        let socket: WebSocket;

        try {
          const headers = buildNotificationRealtimeHeaders(session ?? null);
          socket = headers ? new WebSocket(wsUrl, undefined, { headers } as any) : new WebSocket(wsUrl);
        } catch (error) {
          console.error('[Notifications] Failed to create websocket instance', error);
          tryCandidate(index + 1);
          return;
        }

        wsRef.current = socket;

        const sendFrame = (command: string, headers: Record<string, string> = {}, body: string | null = null) => {
          if (socket.readyState !== WebSocket.OPEN) {
            return;
          }

          socket.send(buildStompFrame(command, headers, body));
        };

        socket.onopen = () => {
          if (!isMounted) {
            return;
          }

          sendFrame('CONNECT', STOMP_CONNECT_HEADERS);
        };

        socket.onmessage = async (event) => {
          const payload = typeof event.data === 'string' ? event.data : String(event.data ?? '');
          const frames = parseStompFrames(payload);

          for (const frame of frames) {
            switch (frame.command) {
              case 'CONNECTED': {
                if (!isMounted) {
                  return;
                }

                stompConnectedRef.current = true;
                setRealtimeStatus('connected');
                setRealtimeError(null);
                setIsInitialLoading(false);
                const subscriptionId = `notifications-${customerId}-${Date.now()}`;
                subscriptionIdRef.current = subscriptionId;
                sendFrame('SUBSCRIBE', {
                  id: subscriptionId,
                  destination: `/topic/customers/${customerId}/notifications`,
                });
                break;
              }
              case 'MESSAGE': {
                if (!frame.body) {
                  return;
                }

                try {
                  const parsed = JSON.parse(frame.body) as Record<string, unknown>;
                  const { orderId, status } = deriveOrderInfo(parsed);

                  if (!orderId || !status || !session?.accessToken) {
                    break;
                  }

                  const order = await fetchRentalOrderById(session, orderId);

                  if (!order) {
                    break;
                  }

                  if (shouldRefreshContracts(status)) {
                    await refreshContractsMap();
                  }

                  const nextNotification = buildNotificationFromOrder(
                    { ...order, orderStatus: status } as RentalOrderResponse,
                    contractsMapRef.current,
                    customerId,
                  );

                  if (nextNotification) {
                    upsertNotifications([nextNotification]);
                  }
                } catch (error) {
                  console.warn('[Notifications] Failed to parse realtime payload', error);
                }
                break;
              }
              case 'ERROR': {
                const message = frame.body?.trim() || 'Notification stream reported an error.';
                setRealtimeError(message);
                break;
              }
              default:
                break;
            }
          }
        };

        socket.onerror = (event) => {
          console.error('[Notifications] Websocket error event', event);
        };

        socket.onclose = () => {
          stompConnectedRef.current = false;
          subscriptionIdRef.current = null;

          if (!isMounted) {
            return;
          }

          setRealtimeStatus('disconnected');
          setRealtimeError('Connection lost. Retrying…');
          setIsInitialLoading(false);

          const nextIndex = index + 1;

          if (nextIndex < candidates.length) {
            tryCandidate(nextIndex);
            return;
          }

          reconnectHandleRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
        };
      };

      tryCandidate(0);
    };

    connect();

    return () => {
      isMounted = false;

      if (reconnectHandleRef.current) {
        clearTimeout(reconnectHandleRef.current);
        reconnectHandleRef.current = null;
      }

      if (wsRef.current) {
        try {
          if (stompConnectedRef.current) {
            wsRef.current.send(buildStompFrame('DISCONNECT'));
          }
        } catch (error) {
          console.warn('[Notifications] Failed to dispatch disconnect frame', error);
        }

        wsRef.current.close();
        wsRef.current = null;
      }

      stompConnectedRef.current = false;
      subscriptionIdRef.current = null;
    };
  }, [customerId, isSignedIn, reconnectNonce, session, refreshContractsMap, upsertNotifications]);

  const renderEmptyComponent = useCallback(() => {
    if (isInitialLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color="#111111" />
          <Text style={styles.emptyStateText}>Loading notifications…</Text>
        </View>
      );
    }

    if (realtimeError) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{realtimeError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRealtimeRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>You are all caught up.</Text>
      </View>
    );
  }, [handleRealtimeRetry, isInitialLoading, realtimeError]);

  const renderListFooter = useMemo(() => <View style={styles.footerSpacer} />, []);

  const renderNotification = useCallback(
    ({ item }: { item: OrderStatusNotification }) => {
      const meta = resolveNotificationMeta(item.type);
      const actionLabel = item.actionLabel ?? meta.actionLabel;

      return (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.notificationCard,
            item.read ? styles.notificationCardRead : styles.notificationCardUnread,
          ]}
          onPress={() => handleCardPress(item)}
        >
          <View style={[styles.iconBadge, { backgroundColor: meta.background }]}>
            <Ionicons name={meta.icon as any} size={20} color={meta.color} />
          </View>
          <View style={styles.notificationContent}>
            <View style={styles.notificationHeaderRow}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <View style={[styles.typeBadge, { backgroundColor: meta.background }]}>
                <Text style={[styles.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
            <Text style={styles.notificationDescription}>{item.message}</Text>
            <View style={styles.notificationFooter}>
              <View style={styles.notificationMetaRow}>
                <Text style={styles.timestamp}>{formatTimestamp(item.createdAt)}</Text>
                {!item.read ? <View style={styles.unreadDot} /> : null}
              </View>
              {actionLabel ? (
                <TouchableOpacity style={styles.actionButton} onPress={() => handleActionPress(item)}>
                  <Text style={styles.actionLabel}>{actionLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [handleActionPress, handleCardPress],
  );

  if (!isSignedIn && !isHydrating) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={20} color="#111" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notifications</Text>
            <View style={styles.headerPlaceholder} />
          </View>

          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>Sign in to receive live order notifications.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(auth)/sign-in')}>
              <Text style={styles.primaryButtonLabel}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity disabled={markAllDisabled} onPress={handleMarkAllRead}>
            <Text style={[styles.markAllText, markAllDisabled && styles.markAllTextDisabled]}>
              {isMarkingAll ? 'Marking…' : 'Mark all as read'}
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          renderItem={renderNotification}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#111111" />
          }
          ListEmptyComponent={renderEmptyComponent}
          ListFooterComponent={renderListFooter}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}
