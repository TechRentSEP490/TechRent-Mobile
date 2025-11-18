import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  Linking,
  NativeSyntheticEvent,
  Pressable,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
  type DimensionValue,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from 'react-native-webview/lib/WebViewTypes';

import ContractPdfDownloader from '@/components/ContractPdfDownloader';
import EmailEditorModal from '@/components/modals/EmailEditorModal';
import OrderDetailsModal from '@/components/modals/OrderDetailsModal';
import OrderStepsModal from '@/components/modals/OrderStepsModal';
import RentalOrderStepsContent from '@/components/modals/RentalOrderStepsContent';
import PaymentModal from '@/components/modals/PaymentModal';
import { useAuth } from '@/contexts/AuthContext';
import { fetchContracts, sendContractPin, signContract, type ContractResponse } from '@/services/contracts';
import { fetchDeviceModelById } from '@/services/device-models';
import {
  fetchRentalOrderById,
  fetchRentalOrders,
  type RentalOrderResponse,
} from '@/services/rental-orders';
import {
  createPayment,
  type PaymentMethod,
  type PaymentSession,
} from '@/services/payments';
import styles from '@/style/orders.styles';
import { formatCurrency, formatRentalPeriod, toTitleCase } from '@/utils/order-formatters';
import type {
  OrderActionType,
  OrderCard,
  OrderStatus,
  OrderStatusFilter,
} from '@/types/orders';

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

const resolvePaymentUrl = (value: string | undefined, fallback: string) =>
  value && value.trim().length > 0 ? value.trim() : fallback;

const PAYMENT_RETURN_URL = resolvePaymentUrl(
  process.env.EXPO_PUBLIC_PAYMENT_RETURN_URL,
  'https://example.com/payments/return',
);

const PAYMENT_CANCEL_URL = resolvePaymentUrl(
  process.env.EXPO_PUBLIC_PAYMENT_CANCEL_URL,
  'https://example.com/payments/cancel',
);

const PAYMENT_SUCCESS_URL = resolvePaymentUrl(
  process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL,
  'https://example.com/payments/success',
);

const PAYMENT_FAILURE_URL = resolvePaymentUrl(
  process.env.EXPO_PUBLIC_PAYMENT_FAILURE_URL,
  'https://example.com/payments/failure',
);

const mapStatusToMeta = (status: string | null | undefined): StatusMeta => {
  const normalized = (status ?? '').toUpperCase();
  let filter: OrderStatus = 'Pending';
  let includeAction = true;
  let overrideLabel: string | null = null;
  let overrideAction: StatusMeta['action'] | undefined;

  switch (normalized) {
    case 'PENDING_KYC':
    case 'PENDING_KYX':
      filter = 'Pending';
      overrideLabel = 'Pending KYC';
      overrideAction = { label: 'Complete KYC', type: 'completeKyc' };
      break;
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
  const label =
    overrideLabel ?? (normalized.length > 0 ? toTitleCase(normalized) : template.defaultLabel);
  const action = overrideAction ?? (includeAction ? template.action : undefined);

  return {
    filter,
    label,
    color: template.color,
    background: template.background,
    action,
  };
};


const isValidEmail = (value: string): boolean => {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.toLowerCase());
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

const isContractSignedByCustomer = (contract?: ContractResponse | null): boolean => {
  if (!contract) {
    return false;
  }

  return contract.customerSignedBy !== null && contract.customerSignedBy !== undefined;
};

const mapOrderResponseToCard = (
  order: RentalOrderResponse,
  deviceNames: Map<string, string>,
  contract?: ContractResponse | null,
): OrderCard => {
  const statusMeta = mapStatusToMeta(order.orderStatus);
  const depositAmount = Number.isFinite(order.depositAmount) ? Number(order.depositAmount) : 0;
  const totalPrice = Number.isFinite(order.totalPrice) ? Number(order.totalPrice) : 0;
  const totalDue = depositAmount + totalPrice;
  return {
    orderId: order.orderId,
    id: String(order.orderId),
    title: `Order #${order.orderId}`,
    deviceSummary: deriveDeviceSummary(order, deviceNames),
    rentalPeriod: formatRentalPeriod(order.startDate, order.endDate),
    totalAmount: formatCurrency(totalDue),
    totalPrice,
    totalPriceLabel: formatCurrency(totalPrice),
    depositAmount,
    depositLabel: formatCurrency(depositAmount),
    totalDue,
    statusFilter: statusMeta.filter,
    statusLabel: statusMeta.label,
    statusColor: statusMeta.color,
    statusBackground: statusMeta.background,
    action: statusMeta.action,
    contract: contract ?? null,
  };
};

const PAYMENT_OPTIONS: {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'VNPAY',
    label: 'VNPay',
    description: 'Pay with VNPay gateway',
    icon: <Ionicons name="card-outline" size={24} color="#111" />,
  },
  {
    id: 'PAYOS',
    label: 'PayOS',
    description: 'Pay with PayOS gateway',
    icon: <MaterialCommunityIcons name="wallet-outline" size={24} color="#111" />,
  },
];

export default function OrdersScreen() {
  const router = useRouter();
  const { session, ensureSession, user } = useAuth();
  const { flow, orderId } = useLocalSearchParams<{
    flow?: string | string[];
    orderId?: string | string[];
  }>();
  const listRef = useRef<FlatList<OrderCard>>(null);
  const defaultVerificationEmail = useMemo(() => user?.email?.trim() ?? '', [user?.email]);
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [contractsByOrderId, setContractsByOrderId] = useState<Record<string, ContractResponse>>({});
  const [deviceNameLookup, setDeviceNameLookup] = useState<Record<string, string>>({});
  const [selectedFilter, setSelectedFilter] = useState<OrderStatusFilter>('All');
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [pendingScrollOrderId, setPendingScrollOrderId] = useState<string | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [activeOrder, setActiveOrder] = useState<OrderCard | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(PAYMENT_OPTIONS[0].id);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [activeContract, setActiveContract] = useState<ContractResponse | null>(null);
  const [isContractLoading, setContractLoading] = useState(false);
  const [contractErrorMessage, setContractErrorMessage] = useState<string | null>(null);
  const [contractRequestId, setContractRequestId] = useState(0);
  const [verificationEmail, setVerificationEmail] = useState(defaultVerificationEmail);
  const [pendingEmailInput, setPendingEmailInput] = useState(defaultVerificationEmail);
  const [isEmailEditorVisible, setEmailEditorVisible] = useState(false);
  const [emailEditorError, setEmailEditorError] = useState<string | null>(null);
  const [isSendingPin, setIsSendingPin] = useState(false);
  const [isSigningContract, setIsSigningContract] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentCheckoutUrl, setPaymentCheckoutUrl] = useState<string | null>(null);
  const [activePaymentSession, setActivePaymentSession] = useState<PaymentSession | null>(null);
  const [paymentModalError, setPaymentModalError] = useState<string | null>(null);
  const [paymentWebViewKey, setPaymentWebViewKey] = useState(0);
  const [isPaymentWebViewLoading, setIsPaymentWebViewLoading] = useState(false);
  const paymentModalTitle = activePaymentSession?.orderCode
    ? `Checkout ${activePaymentSession.orderCode}`
    : activeOrder
      ? `Order #${activeOrder.orderId} Payment`
      : 'Payment Checkout';
  const lastContractLoadRef = useRef<{ orderId: number | null; requestId: number }>({
    orderId: null,
    requestId: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOrderDetailsModalVisible, setOrderDetailsModalVisible] = useState(false);
  const [orderDetailsTargetId, setOrderDetailsTargetId] = useState<number | null>(null);
  const [orderDetailsData, setOrderDetailsData] = useState<RentalOrderResponse | null>(null);
  const [orderDetailsError, setOrderDetailsError] = useState<string | null>(null);
  const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
  const orderDetailsTargetIdRef = useRef<number | null>(null);
  const orderDetailsActiveRequestRef = useRef<{ orderId: number; cancelled: boolean } | null>(null);

  const progressWidth = useMemo<DimensionValue>(() => `${(currentStep / 3) * 100}%`, [currentStep]);
  const isContractAlreadySigned = useMemo(
    () => isContractSignedByCustomer(activeContract),
    [activeContract],
  );
  const contractForSelectedOrder = useMemo(
    () => (orderDetailsTargetId ? contractsByOrderId[String(orderDetailsTargetId)] ?? null : null),
    [contractsByOrderId, orderDetailsTargetId],
  );
  const isAgreementComplete = useMemo(
    () =>
      hasAgreed &&
      Boolean(activeContract) &&
      !isContractLoading &&
      !contractErrorMessage &&
      !isContractAlreadySigned,
    [
      activeContract,
      contractErrorMessage,
      hasAgreed,
      isContractAlreadySigned,
      isContractLoading,
    ],
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

        let contractLookup: Record<string, ContractResponse> = {};

        try {
          const contracts = await fetchContracts(activeSession);
          contractLookup = contracts.reduce<Record<string, ContractResponse>>((accumulator, contract) => {
            if (typeof contract?.orderId === 'number') {
              accumulator[String(contract.orderId)] = contract;
            }
            return accumulator;
          }, {});
        } catch (contractError) {
          console.warn('Failed to load contracts for rental orders', contractError);
          contractLookup = {};
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

        const deviceNameRecord: Record<string, string> = {};
        deviceNameMap.forEach((label, key) => {
          deviceNameRecord[key] = label;
        });

        setOrders(
          sorted.map((order) =>
            mapOrderResponseToCard(order, deviceNameMap, contractLookup[String(order.orderId)]),
          ),
        );
        setContractsByOrderId(contractLookup);
        setDeviceNameLookup(deviceNameRecord);
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

  useEffect(() => {
    if (paymentCheckoutUrl) {
      setPaymentModalError(null);
      setPaymentWebViewKey((previous) => previous + 1);
      setIsPaymentWebViewLoading(true);
    } else {
      setIsPaymentWebViewLoading(false);
    }
  }, [paymentCheckoutUrl]);

  useEffect(() => {
    if (!isPaymentModalVisible) {
      setIsPaymentWebViewLoading(false);
    }
  }, [isPaymentModalVisible]);

  useEffect(() => {
    if (paymentModalError) {
      setIsPaymentWebViewLoading(false);
    }
  }, [paymentModalError]);

  const filteredOrders = useMemo(() => {
    if (selectedFilter === 'All') {
      return orders;
    }

    return orders.filter((order) => order.statusFilter === selectedFilter);
  }, [orders, selectedFilter]);

  const openFlow = useCallback(
    (order: OrderCard) => {
      const shouldSkipToPayment = isContractSignedByCustomer(order.contract);
      lastContractLoadRef.current = { orderId: null, requestId: 0 };
      setActiveOrder(order);
      setActiveContract(order.contract ?? null);
      setContractErrorMessage(null);
      setContractLoading(false);
      setModalVisible(true);
      setCurrentStep(shouldSkipToPayment ? 3 : 1);
      setOtpDigits(Array(6).fill(''));
      setSelectedPayment(PAYMENT_OPTIONS[0].id);
      setHasAgreed(shouldSkipToPayment);
      setVerificationEmail(defaultVerificationEmail);
      setPendingEmailInput(defaultVerificationEmail);
      setVerificationError(null);
      setIsSendingPin(false);
      setIsSigningContract(false);
      setEmailEditorVisible(false);
      setEmailEditorError(null);
      setIsCreatingPayment(false);
      setPaymentError(null);
      setPaymentModalVisible(false);
      setPaymentCheckoutUrl(null);
      setActivePaymentSession(null);
      setPaymentModalError(null);
      setContractRequestId((previous) => previous + 1);
    },
    [defaultVerificationEmail],
  );

  const resetFlow = useCallback(() => {
    lastContractLoadRef.current = { orderId: null, requestId: 0 };
    setModalVisible(false);
    setCurrentStep(1);
    setOtpDigits(Array(6).fill(''));
    setSelectedPayment(PAYMENT_OPTIONS[0].id);
    setHasAgreed(false);
    setActiveOrder(null);
    setActiveContract(null);
    setContractErrorMessage(null);
    setContractLoading(false);
    setVerificationEmail(defaultVerificationEmail);
    setPendingEmailInput(defaultVerificationEmail);
    setVerificationError(null);
    setIsSendingPin(false);
    setIsSigningContract(false);
    setEmailEditorVisible(false);
    setEmailEditorError(null);
    setIsCreatingPayment(false);
    setPaymentError(null);
    setPaymentModalVisible(false);
    setPaymentCheckoutUrl(null);
    setActivePaymentSession(null);
    setPaymentModalError(null);
  }, [defaultVerificationEmail]);

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

    const targetOrderId = activeOrder.orderId;

    if (!Number.isFinite(targetOrderId)) {
      setContractErrorMessage('Invalid rental order selected.');
      return;
    }

    const lastLoad = lastContractLoadRef.current;
    const hasRequestChanged =
      contractRequestId !== lastLoad.requestId || targetOrderId !== lastLoad.orderId;
    const alreadyLoadedForOrder = Boolean(
      activeContract &&
        typeof activeContract.orderId === 'number' &&
        activeContract.orderId === targetOrderId,
    );

    if (!hasRequestChanged && alreadyLoadedForOrder) {
      return;
    }

    let isMounted = true;

    setContractLoading(true);
    if (hasRequestChanged || !alreadyLoadedForOrder) {
      setContractErrorMessage(null);
      if (!alreadyLoadedForOrder || targetOrderId !== lastLoad.orderId) {
        setActiveContract(null);
      }
    }

    lastContractLoadRef.current = { orderId: targetOrderId, requestId: contractRequestId };

    const loadContract = async () => {
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
  }, [
    activeContract,
    activeOrder,
    contractRequestId,
    ensureSession,
    isModalVisible,
    session,
  ]);

  useEffect(() => {
    if (!isModalVisible) {
      return;
    }

    if (!isContractSignedByCustomer(activeContract)) {
      return;
    }

    setHasAgreed(true);
    setCurrentStep((previous) => (previous < 3 ? 3 : previous));
  }, [activeContract, isModalVisible]);

  useEffect(() => {
    const flowParam = Array.isArray(flow) ? flow[0] : flow;
    if (flowParam !== 'continue') {
      return;
    }

    const orderIdParam = Array.isArray(orderId) ? orderId[0] : orderId;
    const targetOrder =
      orders.find((order) => order.id === orderIdParam) ||
      orders.find(
        (order) =>
          order.action?.type === 'continueProcess' || order.action?.type === 'completeKyc'
      );

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

  const goToNextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  }, []);

  const goToPreviousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setVerificationError(null);
    setIsSigningContract(false);
  }, []);

  const requestContractPin = useCallback(
    async ({ skipAdvance = false }: { skipAdvance?: boolean } = {}) => {
      if (!activeContract?.contractId) {
        throw new Error('A rental contract must be selected before requesting a verification code.');
      }

      const trimmedEmail = verificationEmail.trim();

      if (!isValidEmail(trimmedEmail)) {
        throw new Error('Please provide a valid email address to receive the verification code.');
      }

      const activeSession = session?.accessToken ? session : await ensureSession();

      if (!activeSession?.accessToken) {
        throw new Error('You must be signed in to continue the rental agreement.');
      }

      const result = await sendContractPin(
        { accessToken: activeSession.accessToken, tokenType: activeSession.tokenType },
        { contractId: activeContract.contractId, email: trimmedEmail },
      );

      if (!skipAdvance) {
        goToNextStep();
      }

      return result;
    },
    [activeContract, ensureSession, goToNextStep, session, verificationEmail],
  );

  const handleAgreementContinue = useCallback(async () => {
    if (isSendingPin) {
      return;
    }

    const trimmedEmail = verificationEmail.trim();

    if (trimmedEmail.length === 0) {
      setPendingEmailInput(trimmedEmail);
      setEmailEditorError('Email is required to receive the verification code.');
      setEmailEditorVisible(true);
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setPendingEmailInput(trimmedEmail);
      setEmailEditorError('Please enter a valid email address.');
      setEmailEditorVisible(true);
      return;
    }

    setVerificationEmail(trimmedEmail);

    try {
      setIsSendingPin(true);
      setVerificationError(null);
      setOtpDigits(Array(6).fill(''));
      await requestContractPin();
    } catch (error) {
      const fallbackMessage = 'Unable to send the verification code. Please try again.';
      const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);
      const message =
        normalizedError.message && normalizedError.message.trim().length > 0
          ? normalizedError.message
          : fallbackMessage;
      Alert.alert('Unable to send code', message);
    } finally {
      setIsSendingPin(false);
    }
  }, [
    isSendingPin,
    requestContractPin,
    setEmailEditorError,
    setEmailEditorVisible,
    setIsSendingPin,
    setOtpDigits,
    setPendingEmailInput,
    setVerificationEmail,
    setVerificationError,
    verificationEmail,
  ]);

  const handleResendCode = useCallback(async () => {
    if (isSendingPin) {
      return;
    }

    const trimmedEmail = verificationEmail.trim();

    if (!isValidEmail(trimmedEmail)) {
      setPendingEmailInput(trimmedEmail);
      setEmailEditorError('Please enter a valid email address.');
      setEmailEditorVisible(true);
      return;
    }

    setVerificationEmail(trimmedEmail);

    try {
      setIsSendingPin(true);
      setVerificationError(null);
      setOtpDigits(Array(6).fill(''));
      const response = await requestContractPin({ skipAdvance: true });
      Alert.alert(
        'Verification code sent',
        response?.details ??
          `We sent a new verification code to ${trimmedEmail}. Please check your inbox.`,
      );
    } catch (error) {
      const fallbackMessage = 'Unable to resend the verification code. Please try again.';
      const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);
      const message =
        normalizedError.message && normalizedError.message.trim().length > 0
          ? normalizedError.message
          : fallbackMessage;
      Alert.alert('Unable to resend code', message);
    } finally {
      setIsSendingPin(false);
    }
  }, [
    isSendingPin,
    requestContractPin,
    setEmailEditorError,
    setEmailEditorVisible,
    setIsSendingPin,
    setOtpDigits,
    setPendingEmailInput,
    setVerificationEmail,
    setVerificationError,
    verificationEmail,
  ]);

  const handleVerifyCode = useCallback(async () => {
    if (isSigningContract) {
      return;
    }

    const pinCode = otpDigits.join('');

    if (pinCode.length !== otpDigits.length) {
      setVerificationError('Please enter the complete 6-digit verification code.');
      return;
    }

    if (!activeContract?.contractId) {
      setVerificationError('A rental contract is required to complete the signature.');
      return;
    }

    try {
      setIsSigningContract(true);
      setVerificationError(null);
      const activeSession = session?.accessToken ? session : await ensureSession();

      if (!activeSession?.accessToken) {
        throw new Error('You must be signed in to complete the electronic signature.');
      }

      await signContract(
        { accessToken: activeSession.accessToken, tokenType: activeSession.tokenType },
        {
          contractId: activeContract.contractId,
          digitalSignature: 'string',
          pinCode,
          signatureMethod: 'EMAIL_OTP',
          deviceInfo: 'string',
          ipAddress: 'string',
        },
      );

      goToNextStep();
    } catch (error) {
      const fallbackMessage = 'Unable to verify the code. Please try again.';
      const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);
      const message =
        normalizedError.message && normalizedError.message.trim().length > 0
          ? normalizedError.message
          : fallbackMessage;
      setVerificationError(message);
    } finally {
      setIsSigningContract(false);
    }
  }, [
    activeContract,
    ensureSession,
    goToNextStep,
    isSigningContract,
    otpDigits,
    session,
    setIsSigningContract,
    setVerificationError,
  ]);

  const handleOpenEmailEditor = useCallback(() => {
    setPendingEmailInput(verificationEmail);
    setEmailEditorError(null);
    setEmailEditorVisible(true);
  }, [setEmailEditorError, setEmailEditorVisible, setPendingEmailInput, verificationEmail]);

  const handleCloseEmailEditor = useCallback(() => {
    setEmailEditorVisible(false);
    setEmailEditorError(null);
  }, [setEmailEditorError, setEmailEditorVisible]);

  const handleSaveEmail = useCallback(() => {
    const trimmed = pendingEmailInput.trim();

    if (trimmed.length === 0) {
      setEmailEditorError('Email is required.');
      return;
    }

    if (!isValidEmail(trimmed)) {
      setEmailEditorError('Please enter a valid email address.');
      return;
    }

    setVerificationEmail(trimmed);
    setPendingEmailInput(trimmed);
    setEmailEditorVisible(false);
    setEmailEditorError(null);
  }, [
    pendingEmailInput,
    setEmailEditorError,
    setEmailEditorVisible,
    setPendingEmailInput,
    setVerificationEmail,
  ]);

  const handleCreatePayment = useCallback(async () => {
    if (!activeOrder) {
      Alert.alert('Payment unavailable', 'Select an order before continuing to payment.');
      return;
    }

    if (isCreatingPayment) {
      return;
    }

    try {
      setIsCreatingPayment(true);
      setPaymentError(null);
      setPaymentModalError(null);

      const activeSession = session?.accessToken ? session : await ensureSession();

      if (!activeSession?.accessToken) {
        throw new Error('You must be signed in to continue with payment.');
      }

      const amount = Number.isFinite(activeOrder.totalDue) ? activeOrder.totalDue : 0;

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Unable to determine the total amount due for this order.');
      }

      const payload = {
        orderId: activeOrder.orderId,
        invoiceType: 'RENT_PAYMENT' as const,
        paymentMethod: selectedPayment,
        amount,
        description: `Rent payment for order #${activeOrder.orderId}`,
        returnUrl: PAYMENT_RETURN_URL,
        cancelUrl: PAYMENT_CANCEL_URL,
        frontendSuccessUrl: PAYMENT_SUCCESS_URL,
        frontendFailureUrl: PAYMENT_FAILURE_URL,
      };

      console.log('[Orders] Creating payment session', {
        orderId: activeOrder.orderId,
        paymentMethod: payload.paymentMethod,
        amount: payload.amount,
      });

      const paymentSession = await createPayment(payload, activeSession);

      console.log('[Orders] Payment session created', {
        orderId: activeOrder.orderId,
        paymentMethod: selectedPayment,
        checkoutUrl: paymentSession.checkoutUrl,
        orderCode: paymentSession.orderCode,
      });

      const checkoutUrl = paymentSession.checkoutUrl ?? paymentSession.qrCodeUrl;

      if (!checkoutUrl) {
        throw new Error('The payment provider did not return a checkout link.');
      }

      setActivePaymentSession(paymentSession);
      setPaymentCheckoutUrl(checkoutUrl);
      setPaymentModalVisible(true);
    } catch (error) {
      const fallbackMessage = 'Unable to create the payment link. Please try again later.';
      const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);

      console.error('[Orders] Failed to create payment session', {
        orderId: activeOrder?.orderId ?? null,
        error,
      });

      const message =
        normalizedError.message && normalizedError.message.trim().length > 0
          ? normalizedError.message
          : fallbackMessage;

      setPaymentError(message);
      Alert.alert('Payment unavailable', message);
    } finally {
      setIsCreatingPayment(false);
    }
  }, [
    activeOrder,
    ensureSession,
    isCreatingPayment,
    selectedPayment,
    session,
  ]);

  const handleClosePaymentModal = useCallback(() => {
    setPaymentModalVisible(false);
    setPaymentModalError(null);
  }, []);

  const handleOpenPaymentInBrowser = useCallback(async () => {
    if (!paymentCheckoutUrl) {
      return;
    }

    try {
      await Linking.openURL(paymentCheckoutUrl);
    } catch (error) {
      console.error('[Orders] Failed to open payment checkout in browser', {
        url: paymentCheckoutUrl,
        error,
      });
      Alert.alert(
        'Unable to open link',
        'We could not open the checkout page in the browser. Please try again later.',
      );
    }
  }, [paymentCheckoutUrl]);

  const handlePaymentWebViewLoadStart = useCallback(() => {
    setIsPaymentWebViewLoading(true);
  }, []);

  const handlePaymentWebViewLoadEnd = useCallback(() => {
    setIsPaymentWebViewLoading(false);
  }, []);

  const handlePaymentWebViewError = useCallback(
    (event: WebViewErrorEvent) => {
      const { description, url, code } = event.nativeEvent ?? {};
      const baseMessage = description && description.trim().length > 0
        ? description.trim()
        : 'An unexpected error occurred while loading the payment page.';
      const details: string[] = [];

      if (url) {
        details.push(`URL: ${url}`);
      }

      if (typeof code === 'number') {
        details.push(`Code: ${code}`);
      }

      const combined = details.length > 0 ? `${baseMessage} (${details.join(' · ')})` : baseMessage;
      setPaymentModalError(combined);
      setIsPaymentWebViewLoading(false);
    },
    [],
  );

  const handlePaymentWebViewHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      const { statusCode, description, url } = event.nativeEvent ?? {};
      const parts: string[] = [];

      if (typeof statusCode === 'number') {
        parts.push(`Status ${statusCode}`);
      }

      if (description && description.trim().length > 0) {
        parts.push(description.trim());
      }

      if (url) {
        parts.push(`URL: ${url}`);
      }

      const messageBase =
        typeof statusCode === 'number'
          ? 'The payment provider returned an unexpected response.'
          : 'A network error occurred while loading the payment page.';
      const combined = parts.length > 0 ? `${messageBase} (${parts.join(' · ')})` : messageBase;

      setPaymentModalError(combined);
      setIsPaymentWebViewLoading(false);
    },
    [],
  );

  const renderPaymentLoading = useCallback(
    () => (
      <View style={styles.paymentWebViewLoadingOverlay}>
        <ActivityIndicator size="large" color="#111111" />
        <Text style={styles.paymentModalPlaceholderText}>Loading checkout…</Text>
      </View>
    ),
    [],
  );

  const handleOtpChange = (value: string, index: number) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    const digits = [...otpDigits];
    digits[index] = sanitized.slice(-1);
    setOtpDigits(digits);
    if (verificationError) {
      setVerificationError(null);
    }

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

  const handleSelectPayment = useCallback(
    (method: PaymentMethod) => {
      setSelectedPayment(method);
      if (paymentError) {
        setPaymentError(null);
      }
    },
    [paymentError],
  );

  const handleCardAction = useCallback(
    (order: OrderCard) => {
      if (!order.action) {
        return;
      }

      switch (order.action.type) {
        case 'continueProcess':
          openFlow(order);
          break;
        case 'completeKyc':
          router.push('/(app)/kyc-documents');
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
    [openFlow, router],
  );

  const orderDetailsCacheRef = useRef<Record<number, RentalOrderResponse>>({});
  useEffect(() => {
    orderDetailsTargetIdRef.current = orderDetailsTargetId;
  }, [orderDetailsTargetId]);

  useEffect(() => {
    return () => {
      if (orderDetailsActiveRequestRef.current) {
        orderDetailsActiveRequestRef.current.cancelled = true;
        orderDetailsActiveRequestRef.current = null;
      }
    };
  }, []);

  const loadOrderDetails = useCallback(
    async (orderId: number, forceRefresh = false) => {
      if (!forceRefresh) {
        const cached = orderDetailsCacheRef.current[orderId];

        if (cached) {
          setOrderDetailsData(cached);
          setOrderDetailsError(null);
          setOrderDetailsLoading(false);
          return;
        }
      } else {
        delete orderDetailsCacheRef.current[orderId];
      }

      if (orderDetailsActiveRequestRef.current) {
        orderDetailsActiveRequestRef.current.cancelled = true;
      }

      const requestMarker = { orderId, cancelled: false };
      orderDetailsActiveRequestRef.current = requestMarker;

      setOrderDetailsData(null);
      setOrderDetailsError(null);
      setOrderDetailsLoading(true);

      try {
        const activeSession = session?.accessToken ? session : await ensureSession();

        if (requestMarker.cancelled) {
          return;
        }

        if (!activeSession?.accessToken) {
          throw new Error('You must be signed in to view this rental order.');
        }

        console.log('[Orders] Loading rental order details', { orderId });

        const details = await fetchRentalOrderById(activeSession, orderId);

        if (requestMarker.cancelled || orderDetailsTargetIdRef.current !== orderId) {
          return;
        }

        orderDetailsCacheRef.current[orderId] = details;
        setOrderDetailsData(details);
        setOrderDetailsError(null);
      } catch (error) {
        if (requestMarker.cancelled || orderDetailsTargetIdRef.current !== orderId) {
          return;
        }

        console.error('[Orders] Failed to load rental order details', {
          orderId,
          error,
        });

        const fallbackMessage = 'Failed to load the rental order details. Please try again.';
        const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);

        setOrderDetailsData(null);
        setOrderDetailsError(
          normalizedError.message && normalizedError.message.trim().length > 0
            ? normalizedError.message
            : fallbackMessage,
        );
      } finally {
        if (orderDetailsActiveRequestRef.current === requestMarker) {
          orderDetailsActiveRequestRef.current = null;

          if (orderDetailsTargetIdRef.current === orderId) {
            setOrderDetailsLoading(false);
          }
        }
      }
    },
    [ensureSession, session],
  );

  const handleViewDetails = useCallback(
    (order: OrderCard) => {
      const parsedId = order.orderId;

      if (!Number.isFinite(parsedId) || parsedId <= 0) {
        Alert.alert('Order unavailable', 'Unable to load details for this rental order.');
        return;
      }

      setOrderDetailsTargetId(parsedId);
      setOrderDetailsModalVisible(true);
      orderDetailsTargetIdRef.current = parsedId;
      void loadOrderDetails(parsedId);
    },
    [loadOrderDetails],
  );

  const handleCloseOrderDetails = useCallback(() => {
    if (orderDetailsActiveRequestRef.current) {
      orderDetailsActiveRequestRef.current.cancelled = true;
      orderDetailsActiveRequestRef.current = null;
    }

    setOrderDetailsModalVisible(false);
    setOrderDetailsData(null);
    setOrderDetailsError(null);
    setOrderDetailsTargetId(null);
    setOrderDetailsLoading(false);
    orderDetailsTargetIdRef.current = null;
  }, []);

  const handleRetryOrderDetails = useCallback(() => {
    if (orderDetailsTargetId) {
      void loadOrderDetails(orderDetailsTargetId, true);
    }
  }, [loadOrderDetails, orderDetailsTargetId]);

  const handleToggleAgreement = useCallback(() => {
    setHasAgreed((previous) => !previous);
  }, []);

  return (
    <ContractPdfDownloader ensureSession={ensureSession} session={session}>
      {({ downloadContract, downloadingContractId }) => {
        const isSelectedContractDownloading = Boolean(
          contractForSelectedOrder?.contractId &&
            downloadingContractId === contractForSelectedOrder.contractId,
        );
        const isActiveContractDownloading = Boolean(
          activeContract?.contractId && downloadingContractId === activeContract.contractId,
        );

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
                    <Text style={styles.metaLabel}>Total Due</Text>
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

      <OrderStepsModal
        visible={isModalVisible}
        onClose={resetFlow}
        currentStep={currentStep}
        progressWidth={progressWidth}
      >
        <RentalOrderStepsContent
          currentStep={currentStep}
          activeOrder={activeOrder}
          activeContract={activeContract}
          isContractAlreadySigned={isContractAlreadySigned}
          isContractLoading={isContractLoading}
          contractErrorMessage={contractErrorMessage}
          onRetryContract={handleRetryContract}
          isDownloadingActiveContract={isActiveContractDownloading}
          onDownloadContract={() => downloadContract(activeContract, activeOrder?.title)}
          hasAgreed={hasAgreed}
          onToggleAgreement={handleToggleAgreement}
          isAgreementComplete={isAgreementComplete}
          isSendingPin={isSendingPin}
          onAgreementContinue={handleAgreementContinue}
          onResetFlow={resetFlow}
          verificationEmail={verificationEmail}
          otpDigits={otpDigits}
          otpRefs={otpRefs}
          onOtpChange={handleOtpChange}
          onOtpKeyPress={handleOtpKeyPress}
          verificationError={verificationError}
          onResendCode={handleResendCode}
          isOtpComplete={isOtpComplete}
          onVerifyCode={handleVerifyCode}
          isSigningContract={isSigningContract}
          onOpenEmailEditor={handleOpenEmailEditor}
          onGoBack={goToPreviousStep}
          paymentOptions={PAYMENT_OPTIONS}
          selectedPayment={selectedPayment}
          onSelectPayment={handleSelectPayment}
          paymentError={paymentError}
          onCreatePayment={handleCreatePayment}
          isCreatingPayment={isCreatingPayment}
        />
      </OrderStepsModal>
      <EmailEditorModal
        visible={isEmailEditorVisible}
        value={pendingEmailInput}
        error={emailEditorError}
        onChangeText={(value) => {
          setPendingEmailInput(value);
          if (emailEditorError) {
            setEmailEditorError(null);
          }
        }}
        onCancel={handleCloseEmailEditor}
        onSave={handleSaveEmail}
      />
      <OrderDetailsModal
        visible={isOrderDetailsModalVisible}
        loading={orderDetailsLoading}
        error={orderDetailsError}
        order={orderDetailsData}
        deviceNameLookup={deviceNameLookup}
        contract={contractForSelectedOrder}
        isDownloadingContract={isSelectedContractDownloading}
        onClose={handleCloseOrderDetails}
        onRetry={handleRetryOrderDetails}
        onDownloadContract={
          contractForSelectedOrder
            ? () =>
                downloadContract(
                  contractForSelectedOrder,
                  orderDetailsData ? `Order #${orderDetailsData.orderId}` : undefined,
                )
            : undefined
        }
      />
      <PaymentModal
        visible={isPaymentModalVisible}
        title={paymentModalTitle}
        onClose={handleClosePaymentModal}
        canOpenInBrowser={Boolean(paymentCheckoutUrl)}
        onOpenInBrowser={paymentCheckoutUrl ? handleOpenPaymentInBrowser : undefined}
        errorMessage={paymentModalError}
      >
        {paymentCheckoutUrl ? (
          <View style={styles.paymentWebViewContainer}>
            <WebView
              key={`payment-webview-${paymentWebViewKey}`}
              source={{ uri: paymentCheckoutUrl }}
              javaScriptEnabled
              domStorageEnabled
              cacheEnabled={false}
              sharedCookiesEnabled
              setSupportMultipleWindows={false}
              originWhitelist={['https://*', 'http://*']}
              mixedContentMode="always"
              onLoadStart={handlePaymentWebViewLoadStart}
              onLoadEnd={handlePaymentWebViewLoadEnd}
              onError={handlePaymentWebViewError}
              onHttpError={handlePaymentWebViewHttpError}
              style={styles.paymentWebView}
            />
            {isPaymentWebViewLoading ? renderPaymentLoading() : null}
          </View>
        ) : (
          <View style={styles.paymentModalPlaceholder}>
            <Ionicons name="warning-outline" size={24} color="#6b7280" />
            <Text style={styles.paymentModalPlaceholderText}>
              The payment link is unavailable. Close this screen and try again.
            </Text>
          </View>
        )}
      </PaymentModal>
    </SafeAreaView>
        );
      }}
    </ContractPdfDownloader>
  );
}
