import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { fetchDeviceModelById } from '@/services/device-models';
import { fetchContracts, type ContractResponse } from '@/services/contracts';
import { fetchRentalOrders, type RentalOrderResponse } from '@/services/rental-orders';

type OrderStatusFilter = 'All' | 'Pending' | 'Delivered' | 'In Use' | 'Completed';
type OrderStatus = Exclude<OrderStatusFilter, 'All'>;
type OrderActionType =
  | 'continueProcess'
  | 'extendRental'
  | 'confirmReceipt'
  | 'cancelOrder'
  | 'rentAgain';

type OrderCard = {
  id: string;
  title: string;
  deviceSummary: string;
  rentalPeriod: string;
  totalAmount: string;
  statusFilter: OrderStatus;
  statusLabel: string;
  statusColor: string;
  statusBackground: string;
  action?: {
    label: string;
    type: OrderActionType;
  };
};

type ApiErrorWithStatus = Error & { status?: number };

const ORDER_FILTERS: OrderStatusFilter[] = ['All', 'Pending', 'Delivered', 'In Use', 'Completed'];

type StatusMeta = {
  filter: OrderStatus;
  label: string;
  color: string;
  background: string;
  action?: { label: string; type: OrderActionType };
};

const STATUS_TEMPLATES: Record<OrderStatus, { defaultLabel: string; color: string; background: string; action?: { label: string; type: OrderActionType } }> = {
  Pending: {
    defaultLabel: 'Pending',
    color: '#b45309',
    background: '#fef3c7',
    action: { label: 'Continue Process', type: 'continueProcess' },
  },
  Delivered: {
    defaultLabel: 'Delivered',
    color: '#15803d',
    background: '#dcfce7',
    action: { label: 'Confirm Receipt', type: 'confirmReceipt' },
  },
  'In Use': {
    defaultLabel: 'In Use',
    color: '#1d4ed8',
    background: '#dbeafe',
    action: { label: 'Extend Rental', type: 'extendRental' },
  },
  Completed: {
    defaultLabel: 'Completed',
    color: '#111111',
    background: '#f3f4f6',
    action: { label: 'Rent Again', type: 'rentAgain' },
  },
};

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const mapStatusToMeta = (status: string | null | undefined): StatusMeta => {
  const normalized = (status ?? '').toUpperCase();
  let filter: OrderStatus = 'Pending';
  let includeAction = true;

  switch (normalized) {
    case 'PENDING':
    case 'PROCESSING':
    case 'AWAITING_PAYMENT':
    case 'AWAITING_APPROVAL':
    case 'AWAITING_DOCUMENTS':
      filter = 'Pending';
      break;
    case 'DELIVERED':
    case 'DELIVERING':
    case 'SHIPPED':
    case 'OUT_FOR_DELIVERY':
      filter = 'Delivered';
      break;
    case 'IN_USE':
    case 'ACTIVE':
    case 'IN_PROGRESS':
      filter = 'In Use';
      break;
    case 'COMPLETED':
    case 'RETURNED':
    case 'CLOSED':
    case 'FINISHED':
      filter = 'Completed';
      break;
    case 'CANCELLED':
    case 'CANCELED':
      filter = 'Completed';
      includeAction = false;
      break;
    default:
      includeAction = false;
      break;
  }

  const template = STATUS_TEMPLATES[filter];
  const label = normalized.length > 0 ? toTitleCase(normalized) : template.defaultLabel;

  return {
    filter,
    label,
    color: template.color,
    background: template.background,
    action: includeAction ? template.action : undefined,
  };
};

const formatCurrency = (value: number): string => {
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  } catch {
    return `${Number.isFinite(value) ? Math.round(value).toLocaleString('vi-VN') : '0'} ₫`;
  }
};

const formatRentalPeriod = (startDateIso: string, endDateIso: string): string => {
  const startDate = startDateIso ? new Date(startDateIso) : null;
  const endDate = endDateIso ? new Date(endDateIso) : null;

  if (!startDate || Number.isNaN(startDate.getTime())) {
    return '—';
  }

  const hasValidEnd = Boolean(endDate && !Number.isNaN(endDate.getTime()));

  try {
    const sameYear = hasValidEnd && endDate ? startDate.getFullYear() === endDate.getFullYear() : false;
    const startFormatter = new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
    const startLabel = startFormatter.format(startDate);

    if (hasValidEnd && endDate) {
      const endFormatter = new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const endLabel = endFormatter.format(endDate);
      return `${startLabel} - ${endLabel}`;
    }

    return `Starting ${startLabel}`;
  } catch {
    const startLabel = startDate.toISOString().slice(0, 10);
    if (hasValidEnd && endDate) {
      const endLabel = endDate.toISOString().slice(0, 10);
      return `${startLabel} - ${endLabel}`;
    }
    return `Starting ${startLabel}`;
  }
};

const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toISOString().replace('T', ' ').slice(0, 16);
  }
};

const normalizeHtmlContent = (value: string | null | undefined): string => {
  if (!value || value.trim().length === 0) {
    return '';
  }

  const withLineBreaks = value
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*li\s*>/gi, '• ')
    .replace(/<\s*\/li\s*>/gi, '\n')
    .replace(/<\s*\/h[1-6]\s*>/gi, '\n\n');

  const withoutTags = withLineBreaks.replace(/<[^>]*>/g, '');

  return withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const formatContractStatus = (status: string | null | undefined): string => {
  if (!status || status.trim().length === 0) {
    return 'Unknown';
  }

  return toTitleCase(status);
};

const deriveDeviceSummary = (order: RentalOrderResponse, deviceNames: Map<string, string>): string => {
  if (!order.orderDetails || order.orderDetails.length === 0) {
    return 'No devices listed';
  }

  const names = order.orderDetails
    .map((detail) => {
      const id = detail?.deviceModelId;
      if (!id) {
        return null;
      }

      const name = deviceNames.get(String(id));
      if (name && name.trim().length > 0) {
        return name;
      }

      return `Device Model ${id}`;
    })
    .filter((value): value is string => Boolean(value && value.trim().length > 0));

  if (names.length === 0) {
    return `${order.orderDetails.length} devices`;
  }

  if (names.length === 1) {
    return names[0];
  }

  const [firstName, ...rest] = names;
  return `${firstName} + ${rest.length} more`;
};

const mapOrderResponseToCard = (
  order: RentalOrderResponse,
  deviceNames: Map<string, string>,
): OrderCard => {
  const statusMeta = mapStatusToMeta(order.orderStatus);

  return {
    id: String(order.orderId),
    title: `Order #${order.orderId}`,
    deviceSummary: deriveDeviceSummary(order, deviceNames),
    rentalPeriod: formatRentalPeriod(order.startDate, order.endDate),
    totalAmount: formatCurrency(order.totalPrice),
    statusFilter: statusMeta.filter,
    statusLabel: statusMeta.label,
    statusColor: statusMeta.color,
    statusBackground: statusMeta.background,
    action: statusMeta.action,
  };
};

const PAYMENT_OPTIONS = [
  {
    id: 'payos',
    label: 'PayOS',
    description: 'Credit/Debit Card',
    icon: <Ionicons name="card-outline" size={24} color="#111" />,
  },
  {
    id: 'momo',
    label: 'MoMo',
    description: 'Mobile Wallet',
    icon: <MaterialCommunityIcons name="wallet-outline" size={24} color="#111" />,
  },
];

export default function OrdersScreen() {
  const router = useRouter();
  const { session, ensureSession } = useAuth();
  const { flow, orderId } = useLocalSearchParams<{
    flow?: string | string[];
    orderId?: string | string[];
  }>();
  const listRef = useRef<FlatList<OrderCard>>(null);
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<OrderStatusFilter>('All');
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [pendingScrollOrderId, setPendingScrollOrderId] = useState<string | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [activeOrder, setActiveOrder] = useState<OrderCard | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [selectedPayment, setSelectedPayment] = useState(PAYMENT_OPTIONS[0].id);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [activeContract, setActiveContract] = useState<ContractResponse | null>(null);
  const [isContractLoading, setContractLoading] = useState(false);
  const [contractErrorMessage, setContractErrorMessage] = useState<string | null>(null);
  const [contractRequestId, setContractRequestId] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const progressWidth = useMemo(() => `${(currentStep / 3) * 100}%`, [currentStep]);
  const isAgreementComplete = useMemo(
    () => hasAgreed && Boolean(activeContract) && !isContractLoading && !contractErrorMessage,
    [hasAgreed, activeContract, isContractLoading, contractErrorMessage],
  );
  const isOtpComplete = useMemo(
    () => otpDigits.every((digit) => digit.length === 1),
    [otpDigits],
  );

  const loadOrders = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const activeSession = session?.accessToken ? session : await ensureSession();

        if (!activeSession?.accessToken) {
          setOrders([]);
          setErrorMessage('You must be signed in to view your rental orders.');
          return;
        }

        const response = await fetchRentalOrders(activeSession);
        const deviceNameMap = new Map<string, string>();
        const uniqueDeviceModelIds = new Set<string>();

        response.forEach((order) => {
          order.orderDetails?.forEach((detail) => {
            if (detail?.deviceModelId) {
              uniqueDeviceModelIds.add(String(detail.deviceModelId));
            }
          });
        });

        if (uniqueDeviceModelIds.size > 0) {
          await Promise.all(
            Array.from(uniqueDeviceModelIds).map(async (id) => {
              try {
                const device = await fetchDeviceModelById(id);
                if (device) {
                  const label = device.name?.trim().length ? device.name : device.model;
                  if (label && label.trim().length > 0) {
                    deviceNameMap.set(id, label.trim());
                  }
                }
              } catch (deviceError) {
                console.warn(`Failed to load device model ${id} for rental orders`, deviceError);
              }
            }),
          );
        }

        const sorted = [...response].sort((a, b) => {
          const aTime = new Date(a.createdAt ?? a.startDate).getTime();
          const bTime = new Date(b.createdAt ?? b.startDate).getTime();

          if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
            return 0;
          }
          if (Number.isNaN(aTime)) {
            return 1;
          }
          if (Number.isNaN(bTime)) {
            return -1;
          }

          return bTime - aTime;
        });

        setOrders(sorted.map((order) => mapOrderResponseToCard(order, deviceNameMap)));
        setErrorMessage(null);
      } catch (error) {
        const fallbackMessage = 'Failed to load rental orders. Please try again.';
        const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);
        const status = (normalizedError as ApiErrorWithStatus).status;

        if (status === 401) {
          setOrders([]);
          setErrorMessage('Your session has expired. Please sign in again to view your rental orders.');
        } else {
          const message =
            normalizedError.message && normalizedError.message.trim().length > 0
              ? normalizedError.message
              : fallbackMessage;
          setErrorMessage(message);
        }
      } finally {
        if (mode === 'refresh') {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [ensureSession, session]
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleRefresh = useCallback(() => {
    loadOrders('refresh');
  }, [loadOrders]);

  const handleRetry = useCallback(() => {
    loadOrders('initial');
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    if (selectedFilter === 'All') {
      return orders;
    }

    return orders.filter((order) => order.statusFilter === selectedFilter);
  }, [orders, selectedFilter]);

  const openFlow = useCallback((order: OrderCard) => {
    setActiveOrder(order);
    setActiveContract(null);
    setContractErrorMessage(null);
    setContractLoading(false);
    setModalVisible(true);
    setCurrentStep(1);
    setOtpDigits(Array(6).fill(''));
    setSelectedPayment(PAYMENT_OPTIONS[0].id);
    setHasAgreed(false);
    setContractRequestId((previous) => previous + 1);
  }, []);

  const resetFlow = useCallback(() => {
    setModalVisible(false);
    setCurrentStep(1);
    setOtpDigits(Array(6).fill(''));
    setSelectedPayment(PAYMENT_OPTIONS[0].id);
    setHasAgreed(false);
    setActiveOrder(null);
    setActiveContract(null);
    setContractErrorMessage(null);
    setContractLoading(false);
  }, []);

  const handleRetryContract = useCallback(() => {
    setContractRequestId((previous) => previous + 1);
  }, []);

  useEffect(() => {
    if (!highlightedOrderId) {
      return;
    }

    const timeout = setTimeout(() => {
      setHighlightedOrderId(null);
    }, 4000);

    return () => {
      clearTimeout(timeout);
    };
  }, [highlightedOrderId]);

  useEffect(() => {
    if (!isModalVisible || !activeOrder) {
      return;
    }

    let isMounted = true;

    const loadContract = async () => {
      setContractLoading(true);
      setContractErrorMessage(null);
      setActiveContract(null);

      try {
        const activeSession = session?.accessToken ? session : await ensureSession();

        if (!isMounted) {
          return;
        }

        if (!activeSession?.accessToken) {
          throw new Error('You must be signed in to view rental contracts.');
        }

        const contracts = await fetchContracts(activeSession);

        if (!isMounted) {
          return;
        }

        const targetOrderId = Number.parseInt(activeOrder.id, 10);
        const matchingContract = contracts.find(
          (contract) => typeof contract?.orderId === 'number' && contract.orderId === targetOrderId,
        );

        if (matchingContract) {
          setActiveContract(matchingContract);
        } else {
          setContractErrorMessage('No rental contract is available for this order yet.');
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const fallbackMessage = 'Failed to load rental contract. Please try again.';
        const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);
        const status = (normalizedError as ApiErrorWithStatus).status;

        if (status === 401) {
          setContractErrorMessage(
            'Your session has expired. Please sign in again to view the rental contract.',
          );
        } else {
          const message =
            normalizedError.message && normalizedError.message.trim().length > 0
              ? normalizedError.message
              : fallbackMessage;
          setContractErrorMessage(message);
        }
      } finally {
        if (!isMounted) {
          return;
        }

        setContractLoading(false);
      }
    };

    loadContract();

    return () => {
      isMounted = false;
    };
  }, [activeOrder, contractRequestId, ensureSession, isModalVisible, session]);

  useEffect(() => {
    const flowParam = Array.isArray(flow) ? flow[0] : flow;
    if (flowParam !== 'continue') {
      return;
    }

    const orderIdParam = Array.isArray(orderId) ? orderId[0] : orderId;
    const targetOrder =
      orders.find((order) => order.id === orderIdParam) ||
      orders.find((order) => order.action?.type === 'continueProcess');

    if (targetOrder) {
      setSelectedFilter(targetOrder.statusFilter);
      setHighlightedOrderId(targetOrder.id);
      setPendingScrollOrderId(targetOrder.id);
    }

    if (orders.length > 0) {
      router.replace('/(app)/(tabs)/orders');
    }
  }, [flow, orderId, orders, router]);

  useEffect(() => {
    if (!pendingScrollOrderId) {
      return;
    }

    const index = filteredOrders.findIndex((order) => order.id === pendingScrollOrderId);

    if (index >= 0) {
      try {
        listRef.current?.scrollToIndex({ index, animated: true });
      } catch {
        // Ignore scroll errors if the list has not rendered yet
      }
    }

    setPendingScrollOrderId(null);
  }, [filteredOrders, pendingScrollOrderId]);

  const goToNextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleOtpChange = (value: string, index: number) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    const digits = [...otpDigits];
    digits[index] = sanitized.slice(-1);
    setOtpDigits(digits);

    if (sanitized && index < otpRefs.current.length - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (event.nativeEvent.key === 'Backspace' && otpDigits[index] === '' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleCardAction = useCallback(
    (order: OrderCard) => {
      if (!order.action) {
        return;
      }

      switch (order.action.type) {
        case 'continueProcess':
          openFlow(order);
          break;
        case 'extendRental':
          Alert.alert('Extend Rental', 'Our team will reach out to help extend this rental.');
          break;
        case 'confirmReceipt':
          Alert.alert('Receipt Confirmed', 'Thanks for confirming delivery of your device.');
          break;
        case 'cancelOrder':
          Alert.alert('Cancel Order', 'Your cancellation request has been submitted.');
          break;
        case 'rentAgain':
          Alert.alert('Rent Again', 'We\'ll move this device to your cart so you can rent it again.');
          break;
        default:
          break;
      }
    },
    [openFlow],
  );

  const handleViewDetails = useCallback((order: OrderCard) => {
    Alert.alert('View Details', `Detailed tracking for ${order.title} is coming soon.`);
  }, []);

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: {
        const canAgreeToContract = Boolean(activeContract) && !isContractLoading && !contractErrorMessage;
        const contractTitle = activeContract
          ? activeContract.title && activeContract.title.trim().length > 0
            ? activeContract.title.trim()
            : `Contract #${activeContract.contractId}`
          : 'Rental Contract';
        const contractNumber = activeContract
          ? activeContract.contractNumber && activeContract.contractNumber.trim().length > 0
            ? activeContract.contractNumber.trim()
            : `#${activeContract.contractId}`
          : '—';
        const contractStatusLabel = formatContractStatus(activeContract?.status);
        const contractPeriod = activeContract
          ? formatRentalPeriod(activeContract.startDate ?? '', activeContract.endDate ?? '')
          : '—';
        const contractTotal =
          typeof activeContract?.totalAmount === 'number'
            ? formatCurrency(activeContract.totalAmount)
            : '—';
        const contractDeposit =
          typeof activeContract?.depositAmount === 'number'
            ? formatCurrency(activeContract.depositAmount)
            : '—';
        const contractExpires = formatDateTime(activeContract?.expiresAt);
        const contractDescription = normalizeHtmlContent(activeContract?.description);
        const contractBody = normalizeHtmlContent(activeContract?.contractContent);
        const contractTerms = normalizeHtmlContent(activeContract?.termsAndConditions);

        return (
          <View style={styles.stepContent}>
            <View style={styles.modalOrderHeader}>
              <Text style={styles.modalOrderName}>{activeOrder?.title ?? 'Rental Order'}</Text>
              <Text style={styles.modalOrderMeta}>{activeOrder?.deviceSummary}</Text>
            </View>
            <Text style={styles.stepTitle}>Rental Agreement Contract</Text>
            <Text style={styles.stepSubtitle}>
              Please review the complete terms and conditions below
            </Text>
            <View style={styles.contractContainer}>
              {isContractLoading ? (
                <View style={styles.contractStateWrapper}>
                  <ActivityIndicator color="#111111" />
                  <Text style={styles.contractStateText}>Loading rental contract…</Text>
                </View>
              ) : contractErrorMessage ? (
                <View style={styles.contractStateWrapper}>
                  <Text style={[styles.contractStateText, styles.contractErrorText]}>
                    {contractErrorMessage}
                  </Text>
                  <Pressable style={styles.contractRetryButton} onPress={handleRetryContract}>
                    <Text style={styles.contractRetryButtonText}>Try Again</Text>
                  </Pressable>
                </View>
              ) : activeContract ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.contractHeading}>{contractTitle}</Text>
                  <View style={styles.contractMetaList}>
                    <View style={styles.contractMetaRow}>
                      <Text style={styles.contractMetaLabel}>Contract Number</Text>
                      <Text style={styles.contractMetaValue}>{contractNumber}</Text>
                    </View>
                    <View style={styles.contractMetaRow}>
                      <Text style={styles.contractMetaLabel}>Status</Text>
                      <Text style={styles.contractMetaValue}>{contractStatusLabel}</Text>
                    </View>
                    <View style={styles.contractMetaRow}>
                      <Text style={styles.contractMetaLabel}>Rental Period</Text>
                      <Text style={styles.contractMetaValue}>{contractPeriod}</Text>
                    </View>
                    <View style={styles.contractMetaRow}>
                      <Text style={styles.contractMetaLabel}>Total Amount</Text>
                      <Text style={styles.contractMetaValue}>{contractTotal}</Text>
                    </View>
                    <View style={styles.contractMetaRow}>
                      <Text style={styles.contractMetaLabel}>Deposit</Text>
                      <Text style={styles.contractMetaValue}>{contractDeposit}</Text>
                    </View>
                    <View style={styles.contractMetaRow}>
                      <Text style={styles.contractMetaLabel}>Expires</Text>
                      <Text style={styles.contractMetaValue}>{contractExpires}</Text>
                    </View>
                  </View>
                  {contractDescription.length > 0 && (
                    <Text style={styles.contractBody}>{contractDescription}</Text>
                  )}
                  {contractBody.length > 0 && (
                    <Text style={[styles.contractBody, styles.contractBodySpacing]}>
                      {contractBody}
                    </Text>
                  )}
                  {contractTerms.length > 0 && (
                    <View style={styles.contractTermsSection}>
                      <Text style={styles.contractTermsHeading}>Terms &amp; Conditions</Text>
                      <Text style={styles.contractTermsText}>{contractTerms}</Text>
                    </View>
                  )}
                </ScrollView>
              ) : (
                <View style={styles.contractStateWrapper}>
                  <Text style={styles.contractStateText}>
                    No rental contract is available for this order yet.
                  </Text>
                </View>
              )}
            </View>
            <Pressable
              style={[styles.agreementRow, !canAgreeToContract && styles.agreementRowDisabled]}
              onPress={() => setHasAgreed((previous) => !previous)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: hasAgreed, disabled: !canAgreeToContract }}
              disabled={!canAgreeToContract}
            >
              <MaterialCommunityIcons
                name={hasAgreed ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={24}
                color={
                  canAgreeToContract ? (hasAgreed ? '#111111' : '#8a8a8a') : '#d1d5db'
                }
              />
              <View style={styles.agreementTextWrapper}>
                <Text style={styles.agreementLabel}>I agree to the rental contract terms</Text>
                <Text style={styles.agreementHelper}>
                  You must accept before proceeding to the verification step.
                </Text>
              </View>
            </Pressable>
            <View style={styles.primaryActions}>
              <Pressable
                style={[
                  styles.primaryButton,
                  styles.buttonFlex,
                  isAgreementComplete ? styles.primaryButtonEnabled : styles.primaryButtonDisabled,
                ]}
                onPress={goToNextStep}
                disabled={!isAgreementComplete}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    !isAgreementComplete && styles.primaryButtonTextDisabled,
                  ]}
                >
                  Next
                </Text>
              </Pressable>
              <Pressable style={[styles.secondaryButton, styles.buttonFlex]} onPress={resetFlow}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        );
      }
      case 2:
        return (
          <View style={styles.stepContent}>
            <View style={styles.verificationIconWrapper}>
              <Ionicons name="shield-checkmark-outline" size={32} color="#111" />
            </View>
            <Text style={styles.stepTitle}>Verify Your Signature</Text>
            <Text style={styles.stepSubtitle}>We&apos;ve sent a 6-digit code to user@gmail.com</Text>
            <View style={styles.otpInputsRow}>
              {otpDigits.map((digit, index) => (
                <TextInput
                  key={`otp-${index}`}
                  ref={(ref) => {
                    otpRefs.current[index] = ref;
                  }}
                  style={styles.otpInput}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(event) => handleOtpKeyPress(event, index)}
                  returnKeyType="next"
                />
              ))}
            </View>
            <View style={styles.verificationHelpers}>
              <Pressable>
                <Text style={styles.helperLink}>Didn&apos;t receive the code?</Text>
              </Pressable>
              <Text style={styles.helperText}>Resend available in 00:45</Text>
            </View>
            <Pressable
              style={[
                styles.primaryButton,
                isOtpComplete ? styles.primaryButtonEnabled : styles.primaryButtonDisabled,
              ]}
              onPress={goToNextStep}
              disabled={!isOtpComplete}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  !isOtpComplete && styles.primaryButtonTextDisabled,
                ]}
              >
                Verify Code
              </Text>
            </Pressable>
            <Pressable style={styles.helperButton}>
              <Text style={styles.helperButtonText}>Use a different email</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={goToPreviousStep}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
          </View>
        );
      case 3:
      default:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review &amp; Pay</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Order</Text>
                <Text style={styles.summaryValue}>{activeOrder?.deviceSummary}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Rental Period</Text>
                <Text style={styles.summaryValue}>{activeOrder?.rentalPeriod}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={styles.summaryTotal}>{activeOrder?.totalAmount ?? '$0.00'}</Text>
              </View>
            </View>
            <View style={styles.paymentList}>
              {PAYMENT_OPTIONS.map((option) => {
                const isSelected = option.id === selectedPayment;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.paymentOption, isSelected && styles.paymentOptionSelected]}
                    onPress={() => setSelectedPayment(option.id)}
                  >
                    <View style={styles.paymentIcon}>{option.icon}</View>
                    <View style={styles.paymentDetails}>
                      <Text style={styles.paymentLabel}>{option.label}</Text>
                      <Text style={styles.paymentDescription}>{option.description}</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? '#1f7df4' : '#c1c1c1'}
                    />
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.paymentSecurity}>
              <Ionicons name="shield-checkmark" size={16} color="#1f7df4" />
              <Text style={styles.paymentSecurityText}>Your payment information is secure</Text>
            </View>
            <Pressable
              style={[styles.primaryButton, styles.primaryButtonEnabled]}
              onPress={() =>
                Alert.alert(
                  'Rental Process Complete',
                  `${activeOrder?.title ?? 'Your order'} is confirmed!`,
                  [
                    {
                      text: 'Done',
                      style: 'default',
                      onPress: resetFlow,
                    },
                  ],
                )
              }
            >
              <Text style={styles.primaryButtonText}>Complete Rental Process</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={goToPreviousStep}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        ref={listRef}
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        renderItem={({ item }) => {
          const isHighlighted = highlightedOrderId === item.id;
          return (
            <View
              style={[
                styles.orderCard,
                isHighlighted && styles.orderCardHighlighted,
              ]}
            >
              <View style={styles.cardLeading}>
                <View style={styles.thumbnail}>
                  <Text style={styles.thumbnailText}>IMG</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.productName}>{item.title}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: item.statusBackground,
                      },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: item.statusColor }]}>
                      {item.statusLabel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.orderNumber}>{item.deviceSummary}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaGroup}>
                    <Text style={styles.metaLabel}>Rental Period</Text>
                    <Text style={styles.metaValue}>{item.rentalPeriod}</Text>
                  </View>
                  <View style={styles.metaGroup}>
                    <Text style={styles.metaLabel}>Total Amount</Text>
                    <Text style={styles.metaValue}>{item.totalAmount}</Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Pressable onPress={() => handleViewDetails(item)}>
                    <Text style={styles.viewDetails}>View Details</Text>
                  </Pressable>
                  {item.action ? (
                    <Pressable
                      style={styles.cardActionButton}
                      onPress={() => handleCardAction(item)}
                    >
                      <Text style={styles.cardActionLabel}>{item.action.label}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          );
        }}
        ListHeaderComponent={() => (
          <View style={styles.headerSection}>
            <View style={styles.topBar}>
              <Text style={styles.title}>My Orders</Text>
              <View style={styles.headerActions}>
                <Pressable style={styles.iconButton}>
                  <Ionicons name="search" size={18} color="#111" />
                </Pressable>
                <Pressable style={styles.iconButton}>
                  <Ionicons name="options-outline" size={18} color="#111" />
                </Pressable>
              </View>
            </View>
            <Text style={styles.subtitle}>
              Track your order history, deliveries, and active rentals in one place.
            </Text>
            <View style={styles.filterRow}>
              {ORDER_FILTERS.map((filter) => {
                const isSelected = selectedFilter === filter;
                return (
                  <Pressable
                    key={filter}
                    style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                    onPress={() => setSelectedFilter(filter)}
                  >
                    <Text
                      style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}
                    >
                      {filter}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errorMessage && orders.length > 0 ? (
              <View style={styles.inlineErrorBanner}>
                <Ionicons name="warning-outline" size={16} color="#b45309" />
                <Text style={styles.inlineErrorText}>{errorMessage}</Text>
                <Pressable onPress={handleRetry}>
                  <Text style={styles.inlineErrorAction}>Try again</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            {isLoading ? (
              <>
                <ActivityIndicator size="large" color="#111111" />
                <Text style={styles.emptyTitle}>Loading orders…</Text>
                <Text style={styles.emptySubtitle}>
                  Hang tight while we fetch your latest rentals.
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="cube-outline" size={48} color="#9ca3af" />
                <Text style={styles.emptyTitle}>
                  {errorMessage ? 'Unable to load orders' : 'No orders found'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {errorMessage
                    ? errorMessage
                    : 'Orders matching the selected status will appear here.'}
                </Text>
                {errorMessage ? (
                  <Pressable style={styles.retryButton} onPress={handleRetry}>
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <Modal animationType="slide" visible={isModalVisible} transparent onRequestClose={resetFlow}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Rental Agreement</Text>
              <Pressable style={styles.closeButton} onPress={resetFlow}>
                <Ionicons name="close" size={20} color="#111" />
              </Pressable>
            </View>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Step {currentStep} of 3</Text>
              <Text style={styles.progressStage}>Final Review</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
            {renderStepContent()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
  },
  headerSection: {
    marginBottom: 16,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f4f4f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  inlineErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
  },
  inlineErrorText: {
    flex: 1,
    color: '#92400e',
    fontSize: 13,
    fontWeight: '500',
  },
  inlineErrorAction: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  filterChipSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterLabelSelected: {
    color: '#ffffff',
  },
  orderCard: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    padding: 16,
  },
  orderCardHighlighted: {
    borderWidth: 2,
    borderColor: '#1f7df4',
    backgroundColor: '#eef4ff',
  },
  cardLeading: {
    marginRight: 16,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailText: {
    fontWeight: '700',
    color: '#4b5563',
    fontSize: 12,
  },
  cardBody: {
    flex: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  orderNumber: {
    fontSize: 13,
    color: '#6b7280',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  metaGroup: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewDetails: {
    fontSize: 14,
    color: '#1f7df4',
    fontWeight: '600',
  },
  cardActionButton: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cardActionLabel: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
  },
  separator: {
    height: 16,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111111',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  progressStage: {
    fontSize: 13,
    color: '#111111',
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#111111',
  },
  stepContent: {
    gap: 16,
  },
  modalOrderHeader: {
    gap: 4,
  },
  modalOrderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  modalOrderMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  contractContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    maxHeight: 200,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  contractHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 12,
  },
  contractBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4b5563',
  },
  contractBodySpacing: {
    marginTop: 12,
  },
  contractStateWrapper: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  contractStateText: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
  },
  contractErrorText: {
    color: '#b91c1c',
  },
  contractRetryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#111111',
  },
  contractRetryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },
  contractMetaList: {
    gap: 8,
    marginBottom: 12,
  },
  contractMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  contractMetaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },
  contractMetaValue: {
    fontSize: 13,
    color: '#4b5563',
    textAlign: 'right',
    flexShrink: 1,
  },
  contractTermsSection: {
    marginTop: 16,
    gap: 8,
  },
  contractTermsHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  contractTermsText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4b5563',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  agreementRowDisabled: {
    opacity: 0.6,
  },
  agreementTextWrapper: {
    flex: 1,
    gap: 4,
  },
  agreementLabel: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '600',
  },
  agreementHelper: {
    fontSize: 12,
    color: '#6b7280',
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#111111',
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  primaryButtonEnabled: {
    opacity: 1,
  },
  primaryButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  primaryButtonTextDisabled: {
    color: '#9ca3af',
  },
  secondaryButton: {
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignSelf: 'stretch',
  },
  buttonFlex: {
    flex: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  verificationIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  otpInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  verificationHelpers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helperLink: {
    fontSize: 13,
    color: '#1f7df4',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  helperButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  helperButtonText: {
    fontSize: 14,
    color: '#1f7df4',
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '600',
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  paymentList: {
    gap: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
  },
  paymentOptionSelected: {
    borderColor: '#1f7df4',
    backgroundColor: '#eef4ff',
  },
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paymentDetails: {
    flex: 1,
    gap: 4,
  },
  paymentLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  paymentDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  paymentSecurity: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  paymentSecurityText: {
    fontSize: 12,
    color: '#6b7280',
  },
});

