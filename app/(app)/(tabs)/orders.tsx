import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { printToFileAsync } from 'expo-print';
import * as FileSystem from 'expo-file-system';

import { useAuth } from '@/contexts/AuthContext';
import { fetchDeviceModelById } from '@/services/device-models';
import {
  fetchRentalOrders,
  type RentalOrderResponse,
  type SessionCredentials,
} from '@/services/rental-orders';
import { fetchContractForOrder, type RentalContract } from '@/services/contracts';

type StatusPresentation = {
  label: string;
  color: string;
  backgroundColor: string;
};

type StatusFilterOption = {
  key: string;
  label: string;
};

const STATUS_PRESENTATION: Record<string, StatusPresentation> = {
  PENDING: {
    label: 'Pending',
    color: '#b45309',
    backgroundColor: '#fef3c7',
  },
  APPROVED: {
    label: 'Approved',
    color: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: '#1d4ed8',
    backgroundColor: '#e0f2fe',
  },
  DELIVERED: {
    label: 'Delivered',
    color: '#15803d',
    backgroundColor: '#dcfce7',
  },
  COMPLETED: {
    label: 'Completed',
    color: '#111827',
    backgroundColor: '#e5e7eb',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
  },
};

const CURRENCY_FORMATTER = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return '—';
  }

  try {
    return CURRENCY_FORMATTER.format(value);
  } catch (error) {
    console.warn('Failed to format currency', error);
    return `${value}`;
  }
};

const formatStatusLabel = (status: string | null | undefined) => {
  if (!status) {
    return 'Unknown';
  }

  return status
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const getStatusPresentation = (status: string | null | undefined): StatusPresentation => {
  if (!status) {
    return {
      label: 'Unknown',
      color: '#1f2937',
      backgroundColor: '#e5e7eb',
    };
  }

  const normalized = status.toUpperCase();
  const preset = STATUS_PRESENTATION[normalized];

  if (preset) {
    return preset;
  }

  return {
    label: formatStatusLabel(status),
    color: '#1f2937',
    backgroundColor: '#e5e7eb',
  };
};

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const convertHtmlToPlainText = (value: string | null | undefined) => {
  if (!value) {
    return '';
  }

  return value
    .replace(/<br\s*\/?>(?=\s*<)/gi, '\n')
    .replace(/<br\s*\/?>(?!\s*<)/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n\n')
    .replace(/<li>/gi, '\u2022 ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const sanitizeContractHtml = (value: string | null | undefined) => {
  if (!value) {
    return '';
  }

  return value
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/(html|head|body)[^>]*>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .trim();
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildContractHtmlDocument = (
  contract: RentalContract,
  order: RentalOrderResponse | null
) => {
  const contractTitle = contract.title?.trim().length
    ? contract.title.trim()
    : `Rental Contract #${contract.contractId}`;
  const contractNumber = contract.contractNumber?.trim().length
    ? contract.contractNumber.trim()
    : `#${contract.contractId}`;

  const metaRows: { label: string; value: string | null }[] = [
    { label: 'Contract Number', value: contractNumber },
    { label: 'Status', value: formatStatusLabel(contract.status) },
    { label: 'Start Date', value: formatDateTime(contract.startDate) },
    { label: 'End Date', value: formatDateTime(contract.endDate) },
    {
      label: 'Total Amount',
      value:
        contract.totalAmount !== null && contract.totalAmount !== undefined
          ? formatCurrency(contract.totalAmount)
          : null,
    },
    {
      label: 'Deposit Amount',
      value:
        contract.depositAmount !== null && contract.depositAmount !== undefined
          ? formatCurrency(contract.depositAmount)
          : null,
    },
    { label: 'Signed At', value: formatDateTime(contract.signedAt) },
    { label: 'Expires At', value: formatDateTime(contract.expiresAt) },
  ];

  if (order) {
    metaRows.push(
      { label: 'Order ID', value: `#${order.orderId}` },
      { label: 'Rental Period', value: `${formatDateTime(order.startDate)} → ${formatDateTime(order.endDate)}` },
      { label: 'Shipping Address', value: order.shippingAddress ?? 'Not provided' },
      { label: 'Order Total', value: formatCurrency(order.totalPrice) },
    );
  }

  const sanitizedContractContent = sanitizeContractHtml(contract.contractContent);
  const sanitizedTerms = sanitizeContractHtml(contract.termsAndConditions);

  const fallbackBody = convertHtmlToPlainText(contract.contractContent);

  const sections: string[] = [];

  if (sanitizedContractContent.length > 0) {
    sections.push(`<section>${sanitizedContractContent}</section>`);
  } else if (fallbackBody.length > 0) {
    sections.push(`<section><p>${escapeHtml(fallbackBody)}</p></section>`);
  }

  if (sanitizedTerms.length > 0) {
    sections.push(`<section><h2>Terms &amp; Conditions</h2>${sanitizedTerms}</section>`);
  } else if (contract.termsAndConditions && contract.termsAndConditions.trim().length > 0) {
    sections.push(
      `<section><h2>Terms &amp; Conditions</h2><p>${escapeHtml(
        contract.termsAndConditions.trim()
      )}</p></section>`
    );
  }

  if (sections.length === 0) {
    sections.push('<section><p>Contract content is not yet available.</p></section>');
  }

  const metadataHtml = metaRows
    .filter((row) => row.value && row.value !== '—')
    .map(
      (row) =>
        `<div class="meta-row"><span class="meta-label">${escapeHtml(
          row.label
        )}:</span><span class="meta-value">${escapeHtml(String(row.value))}</span></div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        padding: 32px;
        color: #0f172a;
        line-height: 1.6;
        font-size: 14px;
      }
      h1 {
        font-size: 24px;
        margin-bottom: 12px;
      }
      h2 {
        font-size: 18px;
        margin-top: 24px;
        margin-bottom: 12px;
      }
      p {
        margin: 0 0 12px 0;
      }
      .meta-row {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px solid #e2e8f0;
        padding: 6px 0;
        font-size: 13px;
      }
      .meta-label {
        font-weight: 600;
        color: #334155;
      }
      .meta-value {
        color: #0f172a;
      }
      section {
        margin-top: 24px;
      }
      ul {
        padding-left: 20px;
      }
      li {
        margin-bottom: 8px;
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(contractTitle)}</h1>
    ${metadataHtml}
    ${sections.join('\n')}
  </body>
</html>`;
};

const buildDeviceSummary = (order: RentalOrderResponse, deviceNames: Record<number, string>) => {
  if (!order.orderDetails || order.orderDetails.length === 0) {
    return 'No devices assigned';
  }

  const [first, ...rest] = order.orderDetails;
  const firstName = deviceNames[first.deviceModelId] ?? `Device #${first.deviceModelId}`;
  const primary = `${first.quantity} × ${firstName}`;

  if (rest.length === 0) {
    return primary;
  }

  const additionalCount = rest.reduce((total, detail) => total + detail.quantity, 0);
  return `${primary} (+${rest.length} more item${rest.length > 1 ? 's' : ''}, ${additionalCount} additional unit${
    additionalCount === 1 ? '' : 's'
  })`;
};

const buildSessionCredentials = (
  session: { accessToken?: string | null; tokenType?: string | null } | null | undefined
) => {
  if (!session?.accessToken) {
    return null;
  }

  return {
    accessToken: session.accessToken,
    tokenType: session.tokenType,
  } satisfies SessionCredentials;
};

export default function OrdersScreen() {
  const { session, isHydrating } = useAuth();
  const { orderId: orderIdParam } = useLocalSearchParams<{ orderId?: string | string[] }>();
  const listRef = useRef<FlatList<RentalOrderResponse> | null>(null);

  const [orders, setOrders] = useState<RentalOrderResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceNames, setDeviceNames] = useState<Record<number, string>>({});
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [highlightedOrderId, setHighlightedOrderId] = useState<number | null>(null);
  const [pendingHighlightId, setPendingHighlightId] = useState<number | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedContract, setSelectedContract] = useState<RentalContract | null>(null);
  const [contractCache, setContractCache] = useState<Record<number, RentalContract | null>>({});
  const [contractLoading, setContractLoading] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [downloadingContract, setDownloadingContract] = useState(false);

  const credentials = useMemo(() => buildSessionCredentials(session), [session]);

  useEffect(() => {
    const idParam = Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam;
    if (!idParam) {
      return;
    }

    const parsed = Number.parseInt(idParam, 10);
    if (!Number.isNaN(parsed)) {
      setPendingHighlightId(parsed);
    }
  }, [orderIdParam]);

  const loadOrders = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!credentials) {
        setOrders([]);
        setError(null);
        return;
      }

      if (!options.silent) {
        setLoading(true);
      }

      try {
        const data = await fetchRentalOrders(credentials);
        const sorted = [...data].sort((a, b) => {
          const left = new Date(b.createdAt ?? '').getTime();
          const right = new Date(a.createdAt ?? '').getTime();
          if (Number.isNaN(left) || Number.isNaN(right)) {
            return b.orderId - a.orderId;
          }
          return left - right;
        });

        setOrders(sorted);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load rental orders.';
        setOrders([]);
        setError(message);
      } finally {
        if (!options.silent) {
          setLoading(false);
        }
      }
    },
    [credentials]
  );

  useEffect(() => {
    if (!credentials) {
      setOrders([]);
      return;
    }

    void loadOrders();
  }, [credentials, loadOrders]);

  useEffect(() => {
    if (pendingHighlightId === null) {
      return;
    }

    const exists = orders.some((order) => order.orderId === pendingHighlightId);

    if (exists) {
      setHighlightedOrderId(pendingHighlightId);
      setPendingHighlightId(null);
    }
  }, [orders, pendingHighlightId]);

  useEffect(() => {
    if (highlightedOrderId === null || orders.length === 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setHighlightedOrderId(null);
    }, 4000);

    return () => {
      clearTimeout(timeout);
    };
  }, [highlightedOrderId, orders.length]);

  useEffect(() => {
    if (orders.length === 0) {
      return;
    }

    const uniqueIds = new Set<number>();
    orders.forEach((order) => {
      order.orderDetails.forEach((detail) => {
        uniqueIds.add(detail.deviceModelId);
      });
    });

    const missingIds = Array.from(uniqueIds).filter((id) => deviceNames[id] === undefined);

    if (missingIds.length === 0) {
      return;
    }

    let isActive = true;

    (async () => {
      const entries = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const detail = await fetchDeviceModelById(String(id));
            if (detail?.model) {
              return [id, detail.model] as const;
            }
            if (detail?.name) {
              return [id, detail.name] as const;
            }
          } catch (error) {
            console.warn(`Failed to fetch device model ${id}`, error);
          }
          return [id, `Device #${id}`] as const;
        })
      );

      if (!isActive) {
        return;
      }

      setDeviceNames((previous) => {
        const next = { ...previous };
        for (const [id, name] of entries) {
          next[id] = name;
        }
        return next;
      });
    })();

    return () => {
      isActive = false;
    };
  }, [orders, deviceNames]);

  const filterOptions = useMemo<StatusFilterOption[]>(() => {
    const unique = new Set<string>();
    orders.forEach((order) => {
      if (order.orderStatus) {
        unique.add(order.orderStatus.toUpperCase());
      }
    });

    const options = Array.from(unique)
      .map((key) => ({ key, label: formatStatusLabel(key) }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [{ key: 'ALL', label: 'All' }, ...options];
  }, [orders]);

  useEffect(() => {
    if (selectedFilter === 'ALL') {
      return;
    }

    const availableKeys = new Set(filterOptions.map((option) => option.key));
    if (!availableKeys.has(selectedFilter)) {
      setSelectedFilter('ALL');
    }
  }, [filterOptions, selectedFilter]);

  const filteredOrders = useMemo(() => {
    if (selectedFilter === 'ALL') {
      return orders;
    }

    return orders.filter(
      (order) => order.orderStatus && order.orderStatus.toUpperCase() === selectedFilter
    );
  }, [orders, selectedFilter]);

  useEffect(() => {
    if (highlightedOrderId === null || filteredOrders.length === 0) {
      return;
    }

    const index = filteredOrders.findIndex((order) => order.orderId === highlightedOrderId);

    if (index >= 0) {
      try {
        listRef.current?.scrollToIndex({ index, animated: true });
      } catch (error) {
        console.warn('Unable to scroll to highlighted order', error);
      }
    }
  }, [filteredOrders, highlightedOrderId]);

  const handleRefresh = useCallback(async () => {
    if (!credentials) {
      return;
    }

    setRefreshing(true);
    try {
      await loadOrders({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [credentials, loadOrders]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSelectedOrderId(null);
    setSelectedContract(null);
    setContractError(null);
    setContractLoading(false);
    setDownloadingContract(false);
  }, []);

  useEffect(() => {
    if (!isModalVisible || selectedOrderId === null) {
      return;
    }

    const stillExists = orders.some((order) => order.orderId === selectedOrderId);
    if (!stillExists) {
      closeModal();
    }
  }, [closeModal, isModalVisible, orders, selectedOrderId]);

  const handleViewContract = useCallback(
    async (order: RentalOrderResponse) => {
      if (!credentials) {
        Alert.alert(
          'Authentication required',
          'Please sign in again to view your rental agreement.'
        );
        return;
      }

      setSelectedOrderId(order.orderId);
      setModalVisible(true);
      setContractError(null);
      setDownloadingContract(false);

      const cached = contractCache[order.orderId];
      if (cached !== undefined) {
        setSelectedContract(cached);
        return;
      }

      setContractLoading(true);
      setSelectedContract(null);

      try {
        const contract = await fetchContractForOrder(order.orderId, credentials);
        setSelectedContract(contract ?? null);
        setContractCache((previous) => ({ ...previous, [order.orderId]: contract ?? null }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load rental agreement.';
        setContractError(message);
        setSelectedContract(null);
        setContractCache((previous) => ({ ...previous, [order.orderId]: null }));
      } finally {
        setContractLoading(false);
      }
    },
    [credentials, contractCache]
  );

  const selectedOrder = useMemo(
    () => orders.find((order) => order.orderId === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  const handleDownloadContract = useCallback(async () => {
    if (!selectedContract) {
      Alert.alert('Contract unavailable', 'There is no contract to download yet.');
      return;
    }

    try {
      setDownloadingContract(true);

      const html = buildContractHtmlDocument(selectedContract, selectedOrder);

      if (!html || html.trim().length === 0) {
        throw new Error('The contract content is empty and cannot be saved.');
      }

      const pdf = await printToFileAsync({ html });

      if (!pdf?.uri) {
        throw new Error('Unable to generate a PDF from the contract.');
      }

      const storageRoot = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;

      if (!storageRoot) {
        throw new Error('Saving contracts is not supported on this platform.');
      }

      const contractsDir = `${storageRoot}contracts/`;
      const dirInfo = await FileSystem.getInfoAsync(contractsDir);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(contractsDir, { intermediates: true });
      } else if (!dirInfo.isDirectory) {
        throw new Error('A file is blocking contract downloads. Please remove the "contracts" item and try again.');
      }

      const sanitizedNumber = selectedContract.contractNumber?.trim().length
        ? selectedContract.contractNumber.trim().replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()
        : `contract-${selectedContract.contractId}`;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const destinationPath = `${contractsDir}${sanitizedNumber}-${timestamp}.pdf`;

      await FileSystem.copyAsync({ from: pdf.uri, to: destinationPath });

      Alert.alert('Contract saved', `The contract PDF was saved to:\n${destinationPath}`);
    } catch (error) {
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Unable to save the contract PDF. Please try again.';
      Alert.alert('Save failed', message);
    } finally {
      setDownloadingContract(false);
    }
  }, [selectedContract, selectedOrder]);

  const renderOrderItem = useCallback(
    ({ item }: { item: RentalOrderResponse }) => {
      const statusMeta = getStatusPresentation(item.orderStatus);
      const deviceSummary = buildDeviceSummary(item, deviceNames);
      const isHighlighted = highlightedOrderId === item.orderId;

      return (
        <View
          style={[
            styles.orderCard,
            isHighlighted && styles.orderCardHighlighted,
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderText}>
              <Text style={styles.orderTitle}>{`Order #${item.orderId}`}</Text>
              <Text style={styles.orderSubtitle}>{deviceSummary}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusMeta.backgroundColor },
              ]}
            >
              <Text style={[styles.statusText, { color: statusMeta.color }]}>{
                statusMeta.label
              }</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaGroup}>
              <Text style={styles.metaLabel}>Rental period</Text>
              <Text style={styles.metaValue}>{`${formatDate(item.startDate)} → ${formatDate(
                item.endDate
              )}`}</Text>
            </View>
            <View style={styles.metaGroup}>
              <Text style={styles.metaLabel}>Total</Text>
              <Text style={styles.metaValue}>{formatCurrency(item.totalPrice)}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaGroup}>
              <Text style={styles.metaLabel}>Deposit</Text>
              <Text style={styles.metaValue}>{formatCurrency(item.depositAmount)}</Text>
            </View>
            <View style={styles.metaGroup}>
              <Text style={styles.metaLabel}>Created</Text>
              <Text style={styles.metaValue}>{formatDateTime(item.createdAt)}</Text>
            </View>
          </View>
          {item.shippingAddress ? (
            <View style={styles.metaGroupFull}>
              <Text style={styles.metaLabel}>Shipping address</Text>
              <Text style={styles.metaValue}>{item.shippingAddress}</Text>
            </View>
          ) : null}
          <View style={styles.cardFooter}>
            <Pressable
              style={styles.viewContractButton}
              onPress={() => handleViewContract(item)}
            >
              <Text style={styles.viewContractText}>View rental agreement</Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [deviceNames, handleViewContract, highlightedOrderId]
  );

  const listEmptyComponent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#111111" />
          <Text style={styles.emptySubtitle}>Loading your rental orders…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Unable to load orders</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadOrders()}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No rental orders yet</Text>
        <Text style={styles.emptySubtitle}>
          Your confirmed rentals will appear here as soon as you place an order.
        </Text>
      </View>
    );
  }, [error, loadOrders, loading]);

  if (isHydrating) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#111111" />
          <Text style={styles.loadingStateText}>Restoring your session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!credentials) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingStateTitle}>Sign in required</Text>
          <Text style={styles.loadingStateText}>
            Please sign in to view and manage your rental orders.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Rental orders</Text>
          <Text style={styles.subtitle}>Track your active and completed rentals</Text>
        </View>
        {filterOptions.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {filterOptions.map((option) => {
              const isSelected = selectedFilter === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                  onPress={() => setSelectedFilter(option.key)}
                >
                  <Text
                    style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        <FlatList
          ref={listRef}
          data={filteredOrders}
          keyExtractor={(item) => String(item.orderId)}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={listEmptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
          }
          ListFooterComponent={
            loading && filteredOrders.length > 0 ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color="#111111" />
              </View>
            ) : null
          }
        />
      </View>
      <Modal
        visible={isModalVisible}
        animationType="slide"
        onRequestClose={closeModal}
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedOrder ? `Order #${selectedOrder.orderId}` : 'Rental agreement'}
              </Text>
              <Pressable onPress={closeModal} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContent}
            >
              {selectedOrder ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Rental summary</Text>
                  <View style={styles.modalSummaryRow}>
                    <Text style={styles.modalSummaryLabel}>Rental period</Text>
                    <Text style={styles.modalSummaryValue}>{`${formatDateTime(
                      selectedOrder.startDate
                    )} → ${formatDateTime(selectedOrder.endDate)}`}</Text>
                  </View>
                  <View style={styles.modalSummaryRow}>
                    <Text style={styles.modalSummaryLabel}>Shipping address</Text>
                    <Text style={styles.modalSummaryValue}>
                      {selectedOrder.shippingAddress || 'Not provided'}
                    </Text>
                  </View>
                  <View style={styles.modalSummaryRow}>
                    <Text style={styles.modalSummaryLabel}>Total amount</Text>
                    <Text style={styles.modalSummaryValue}>
                      {formatCurrency(selectedOrder.totalPrice)}
                    </Text>
                  </View>
                  <View style={styles.modalSummaryRow}>
                    <Text style={styles.modalSummaryLabel}>Deposit collected</Text>
                    <Text style={styles.modalSummaryValue}>
                      {formatCurrency(selectedOrder.depositAmount)}
                    </Text>
                  </View>
                  <View style={styles.modalDevicesList}>
                    {selectedOrder.orderDetails.map((detail) => {
                      const name =
                        deviceNames[detail.deviceModelId] ?? `Device #${detail.deviceModelId}`;
                      return (
                        <View key={detail.orderDetailId} style={styles.modalDeviceRow}>
                          <Text style={styles.modalDeviceName}>{`${detail.quantity} × ${name}`}</Text>
                          <Text style={styles.modalDeviceMeta}>
                            {`Price/day: ${formatCurrency(detail.pricePerDay)}`}
                          </Text>
                          <Text style={styles.modalDeviceMeta}>
                            {`Deposit/unit: ${formatCurrency(detail.depositAmountPerUnit)}`}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Rental agreement</Text>
                {contractLoading ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="large" color="#111111" />
                    <Text style={styles.modalLoadingText}>Fetching contract…</Text>
                  </View>
                ) : contractError ? (
                  <Text style={styles.modalErrorText}>{contractError}</Text>
                ) : selectedContract ? (
                  <View style={styles.modalContractContent}>
                    <Text style={styles.modalContractTitle}>
                      {selectedContract.title || 'Contract details'}
                    </Text>
                    <Text style={styles.modalContractMeta}>
                      {selectedContract.contractNumber
                        ? `Contract #: ${selectedContract.contractNumber}`
                        : 'Contract number unavailable'}
                    </Text>
                    <Text style={styles.modalContractMeta}>
                      {`Status: ${formatStatusLabel(selectedContract.status)}`}
                    </Text>
                    <View style={styles.modalDivider} />
                    <Text style={styles.modalBodyText}>
                      {convertHtmlToPlainText(selectedContract.contractContent) ||
                        'Contract content will appear here once available.'}
                    </Text>
                    {selectedContract.termsAndConditions ? (
                      <View style={styles.modalTermsSection}>
                        <Text style={styles.modalContractTitle}>Terms & Conditions</Text>
                        <Text style={styles.modalBodyText}>
                          {selectedContract.termsAndConditions.trim()}
                        </Text>
                      </View>
                    ) : null}
                    <Pressable
                      style={[
                        styles.downloadButton,
                        downloadingContract && styles.downloadButtonDisabled,
                      ]}
                      onPress={() => void handleDownloadContract()}
                      disabled={downloadingContract}
                    >
                      {downloadingContract ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.downloadButtonText}>Save contract PDF</Text>
                      )}
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.modalBodyText}>
                    We could not find a signed contract for this order yet. Please check back soon.
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: '#475569',
  },
  filterRow: {
    paddingVertical: 8,
    gap: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  filterChipSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterLabelSelected: {
    color: '#ffffff',
  },
  listContent: {
    paddingBottom: 120,
    paddingTop: 8,
  },
  separator: {
    height: 16,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  orderCardHighlighted: {
    borderWidth: 2,
    borderColor: '#2563eb',
    shadowOpacity: 0.16,
    shadowRadius: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  cardHeaderText: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  orderSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#334155',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  metaGroup: {
    flex: 1,
  },
  metaGroupFull: {
    marginTop: 16,
  },
  metaLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#94a3b8',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  cardFooter: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  viewContractButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  viewContractText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  loadingStateText: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
  },
  footerLoading: {
    paddingVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalCloseButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 24,
  },
  modalSection: {
    gap: 16,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSummaryRow: {
    gap: 4,
  },
  modalSummaryLabel: {
    fontSize: 13,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalSummaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  modalDevicesList: {
    gap: 12,
    marginTop: 8,
  },
  modalDeviceRow: {
    gap: 4,
  },
  modalDeviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalDeviceMeta: {
    fontSize: 13,
    color: '#475569',
  },
  modalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  modalLoadingText: {
    fontSize: 14,
    color: '#475569',
  },
  modalErrorText: {
    fontSize: 14,
    color: '#b91c1c',
  },
  modalContractContent: {
    gap: 12,
  },
  modalContractTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalContractMeta: {
    fontSize: 13,
    color: '#475569',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 8,
  },
  modalBodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1e293b',
  },
  modalTermsSection: {
    gap: 12,
  },
  downloadButton: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingVertical: 12,
    alignItems: 'center',
  },
  downloadButtonDisabled: {
    opacity: 0.7,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
