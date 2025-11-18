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
import {
  buildNotificationRealtimeHeaders,
  buildNotificationStompUrls,
  normalizeNotification,
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

  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('idle');
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const stompConnectedRef = useRef(false);
  const reconnectHandleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasNotifications = notifications.length > 0;
  const markAllDisabled = !hasNotifications || isMarkingAll;

  const handleRefresh = useCallback(() => {
    if (!customerId || !isSignedIn) {
      return;
    }

    setRefreshing(true);
    setNotifications([]);
    setIsInitialLoading(true);
    setReconnectNonce((prev) => prev + 1);

    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  }, [customerId, isSignedIn]);

  const markNotificationLocally = useCallback((notificationId: number) => {
    setNotifications((prev) =>
      prev.map((item) => (item.notificationId === notificationId ? { ...item, read: true } : item)),
    );
  }, []);

  const handleCardPress = useCallback(
    (notification: CustomerNotification) => {
      if (notification.read) {
        return;
      }

      markNotificationLocally(notification.notificationId);
    },
    [markNotificationLocally],
  );

  const handleActionPress = useCallback(
    (notification: CustomerNotification) => {
      const meta = resolveNotificationMeta(notification.type);

      markNotificationLocally(notification.notificationId);

      if (meta.action === 'orders') {
        router.push('/(app)/(tabs)/orders');
        return;
      }

      if (meta.action === 'chat') {
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

  const handleRealtimeRetry = useCallback(() => {
    setReconnectNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!customerId || !isSignedIn) {
      setNotifications([]);
      setRealtimeStatus('idle');
      setRealtimeError(null);
      setIsInitialLoading(false);
      return () => {};
    }

    let isMounted = true;
    setIsInitialLoading(true);

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

        socket.onmessage = (event) => {
          const payload = typeof event.data === 'string' ? event.data : String(event.data ?? '');
          const frames = parseStompFrames(payload);

          frames.forEach((frame) => {
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
                  const parsed = JSON.parse(frame.body);
                  const normalized = normalizeNotification(parsed);

                  if (normalized) {
                    setNotifications((prev) => {
                      const existingIndex = prev.findIndex(
                        (item) => item.notificationId === normalized.notificationId,
                      );

                      if (existingIndex >= 0) {
                        const next = [...prev];
                        next[existingIndex] = { ...prev[existingIndex], ...normalized };
                        return next.sort((a, b) => {
                          const left = a.createdAt ? Date.parse(a.createdAt) : 0;
                          const right = b.createdAt ? Date.parse(b.createdAt) : 0;
                          return right - left;
                        });
                      }

                      return [normalized, ...prev].sort((a, b) => {
                        const left = a.createdAt ? Date.parse(a.createdAt) : 0;
                        const right = b.createdAt ? Date.parse(b.createdAt) : 0;
                        return right - left;
                      });
                    });
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
          });
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
  }, [customerId, isSignedIn, reconnectNonce, session]);

  const renderEmptyComponent = useCallback(() => {
    if (isInitialLoading || realtimeStatus === 'connecting') {
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
  }, [handleRealtimeRetry, isInitialLoading, realtimeError, realtimeStatus]);

  const renderListFooter = useMemo(() => <View style={styles.footerSpacer} />, []);

  const renderNotification = useCallback(
    ({ item }: { item: CustomerNotification }) => {
      const meta = resolveNotificationMeta(item.type);

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
              {meta.actionLabel ? (
                <TouchableOpacity style={styles.actionButton} onPress={() => handleActionPress(item)}>
                  <Text style={styles.actionLabel}>{meta.actionLabel}</Text>
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

        {customerId ? (
          <View style={styles.realtimeBanner}>
            <View
              style={[
                styles.realtimeStatusDot,
                realtimeStatus === 'connected'
                  ? styles.realtimeStatusDotConnected
                  : realtimeStatus === 'connecting'
                  ? styles.realtimeStatusDotConnecting
                  : styles.realtimeStatusDotDisconnected,
              ]}
            />
            <Text style={styles.realtimeStatusText}>{realtimeLabel}</Text>
            {realtimeError ? <Text style={styles.realtimeErrorText}>{realtimeError}</Text> : null}
            {realtimeStatus === 'disconnected' ? (
              <TouchableOpacity style={styles.realtimeRetryButton} onPress={handleRealtimeRetry}>
                <Text style={styles.realtimeRetryText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.notificationId)}
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
