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
  Image,
  Linking,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
  type DimensionValue
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from 'react-native-webview/lib/WebViewTypes';

import ContractPdfDownloader from '@/components/ContractPdfDownloader';
import HandoverPdfDownloader from '@/components/HandoverPdfDownloader';
import EmailEditorModal from '@/components/modals/EmailEditorModal';
import HandoverReportsModal from '@/components/modals/HandoverReportsModal';
import HandoverSignModal from '@/components/modals/HandoverSignModal';
import OrderDetailsModal from '@/components/modals/OrderDetailsModal';
import OrderStepsModal from '@/components/modals/OrderStepsModal';
import PaymentModal from '@/components/modals/PaymentModal';
import RentalExpiryModal from '@/components/modals/RentalExpiryModal';
import RentalOrderStepsContent from '@/components/modals/RentalOrderStepsContent';
import SettlementModal from '@/components/modals/SettlementModal';
import { useAuth } from '@/contexts/AuthContext';
import { fetchContracts, sendContractPin, signContract, type ContractResponse } from '@/services/contracts';
import { fetchDeviceModelById } from '@/services/device-models';
import {
  fetchHandoverReportsByOrderId,
  sendHandoverReportPin,
  signHandoverReport,
} from '@/services/handover-reports';
import {
  createPayment,
  type PaymentMethod,
  type PaymentSession,
} from '@/services/payments';
import {
  confirmReturnRentalOrder,
  fetchRentalOrderById,
  fetchRentalOrders,
  type RentalOrderResponse,
} from '@/services/rental-orders';
import {
  fetchSettlementByOrderId,
  respondSettlement,
} from '@/services/settlements';
import styles from '@/style/orders.styles';
import type { HandoverReport } from '@/types/handover-reports';
import type {
  DeviceLookupEntry,
  OrderActionType,
  OrderCard,
  OrderStatus,
  OrderStatusFilter,
} from '@/types/orders';
import type { Settlement } from '@/types/settlements';
import { formatCurrency, formatRentalPeriod, toTitleCase } from '@/utils/order-formatters';

type ApiErrorWithStatus = Error & { status?: number };

const ORDER_FILTERS: OrderStatusFilter[] = [
  'All',
  'PENDING_KYC',
  'PENDING',
  'PROCESSING',
  'DELIVERING',
  'RESCHEDULED',
  'DELIVERY_CONFIRMED',
  'IN_USE',
  'CANCELLED',
  'REJECTED',
  'COMPLETED',
];

// Formatted labels for filter chips
const FILTER_LABELS: Record<OrderStatusFilter, string> = {
  'All': 'All',
  'PENDING_KYC': 'Pending KYC',
  'PENDING': 'Pending',
  'PROCESSING': 'Processing',
  'DELIVERING': 'Delivering',
  'RESCHEDULED': 'Rescheduled',
  'DELIVERY_CONFIRMED': 'Delivered',
  'IN_USE': 'In Use',
  'CANCELLED': 'Cancelled',
  'REJECTED': 'Rejected',
  'COMPLETED': 'Completed',
  // Categories (for backwards compatibility)
  'Pending': 'Pending',
  'Delivered': 'Delivered',
  'In Use': 'In Use',
  'Completed': 'Completed',
};

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

// Deep link scheme for redirecting back to the app after payment
// Format: techrentmobile://payment-result?status=...&orderId=...
const PAYMENT_RETURN_URL = resolvePaymentUrl(
  process.env.EXPO_PUBLIC_PAYMENT_RETURN_URL,
  'techrentmobile://payment-result',
);

const PAYMENT_CANCEL_URL = resolvePaymentUrl(
  process.env.EXPO_PUBLIC_PAYMENT_CANCEL_URL,
  'techrentmobile://payment-result?status=cancel',
);

const PAYMENT_SUCCESS_URL = resolvePaymentUrl(
  process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL,
  'techrentmobile://payment-result?status=success',
);

const PAYMENT_FAILURE_URL = resolvePaymentUrl(
  process.env.EXPO_PUBLIC_PAYMENT_FAILURE_URL,
  'techrentmobile://payment-result?status=failure',
);

const mapStatusToMeta = (status: string | null | undefined): StatusMeta => {
  const normalized = (status ?? '').toUpperCase();
  let filter: OrderStatus = 'Pending';
  let includeAction = true;
  let overrideLabel: string | null = null;
  let overrideAction: StatusMeta['action'] | undefined;

  switch (normalized) {
    // === PENDING STATUSES (before payment/delivery) ===
    case 'PENDING_KYC':
      filter = 'Pending';
      overrideLabel = 'Pending KYC';
      overrideAction = { label: 'Complete KYC', type: 'completeKyc' };
      break;
    case 'PENDING':
      filter = 'Pending';
      overrideLabel = 'Pending';
      // Default action: Continue Process (for payment)
      break;
    case 'PROCESSING':
      filter = 'Pending';
      overrideLabel = 'Processing';
      // Default action: Continue Process
      break;

    // === DELIVERY STATUSES (after payment confirmed) ===
    case 'DELIVERING':
      filter = 'Delivered';
      overrideLabel = 'Delivering';
      includeAction = false; // No action needed while delivering
      break;
    case 'RESCHEDULED':
      filter = 'Delivered';
      overrideLabel = 'Rescheduled';
      includeAction = false; // Delivery rescheduled, no customer action
      break;
    case 'DELIVERY_CONFIRMED':
      filter = 'Delivered';
      overrideLabel = 'Delivery Confirmed';
      includeAction = false; // Customer confirmed delivery, no action needed
      break;

    // === IN USE STATUS (customer has the device) ===
    case 'IN_USE':
      filter = 'In Use';
      overrideLabel = 'In Use';
      // Default action: Extend Rental
      break;

    // === COMPLETED STATUSES (order finished) ===
    case 'COMPLETED':
      filter = 'Completed';
      overrideLabel = 'Completed';
      // Default action: Rent Again
      break;
    case 'CANCELLED':
    case 'CANCELED':
      filter = 'Completed';
      overrideLabel = 'Cancelled';
      includeAction = false; // No action for cancelled orders
      break;
    case 'REJECTED':
      filter = 'Completed';
      overrideLabel = 'Rejected';
      includeAction = false; // No action for rejected orders
      break;

    default:
      // Unknown status - no action
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

const deriveDeviceSummary = (
  order: RentalOrderResponse,
  deviceDetails: Map<string, DeviceLookupEntry>,
): string => {
  if (!order.orderDetails || order.orderDetails.length === 0) {
    return 'No devices listed';
  }

  const names = order.orderDetails
    .map((detail) => {
      const id = detail?.deviceModelId;
      if (!id) {
        return null;
      }

      const name = deviceDetails.get(String(id))?.name;
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

  // Check signedAt field - API returns null for unsigned, or a timestamp string for signed
  const signedAt = contract.signedAt;

  // Handle null, undefined, or "null" string (API may return string "null")
  if (signedAt === null || signedAt === undefined || signedAt === 'null') {
    return false;
  }

  // Check if it's a valid non-empty string (timestamp)
  if (typeof signedAt === 'string' && signedAt.trim().length > 0) {
    return true;
  }

  return false;
};

const mapOrderResponseToCard = (
  order: RentalOrderResponse,
  deviceDetails: Map<string, DeviceLookupEntry>,
  contract?: ContractResponse | null,
): OrderCard => {
  const statusMeta = mapStatusToMeta(order.orderStatus);
  const depositAmount = Number.isFinite(order.depositAmount) ? Number(order.depositAmount) : 0;
  const totalPrice = Number.isFinite(order.totalPrice) ? Number(order.totalPrice) : 0;
  const totalDue = depositAmount + totalPrice;
  const deviceImageUrls =
    order.orderDetails
      ?.map((detail) => deviceDetails.get(String(detail.deviceModelId))?.imageURL?.trim())
      .filter((url): url is string => Boolean(url && url.length > 0)) ?? [];
  return {
    orderId: order.orderId,
    id: String(order.orderId),
    title: `Order #${order.orderId}`,
    deviceSummary: deriveDeviceSummary(order, deviceDetails),
    deviceImageUrls,
    rentalPeriod: formatRentalPeriod(order.startDate, order.endDate),
    totalAmount: formatCurrency(totalDue),
    totalPrice,
    totalPriceLabel: formatCurrency(totalPrice),
    depositAmount,
    depositLabel: formatCurrency(depositAmount),
    totalDue,
    rawStatus: (order.orderStatus ?? '').toUpperCase(), // Original API status for filtering
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
  const [deviceDetailsLookup, setDeviceDetailsLookup] = useState<Record<string, DeviceLookupEntry>>({});
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

  // Handover PDF Downloader ref
  const handoverPdfDownloaderRef = useRef<((report: HandoverReport) => Promise<void>) | null>(null);

  // Handover Reports State
  const [isHandoverModalVisible, setHandoverModalVisible] = useState(false);
  const [handoverReports, setHandoverReports] = useState<HandoverReport[]>([]);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [isHandoverSignModalVisible, setHandoverSignModalVisible] = useState(false);
  const [activeHandoverReport, setActiveHandoverReport] = useState<HandoverReport | null>(null);

  // Settlement State
  const [isSettlementModalVisible, setSettlementModalVisible] = useState(false);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);

  // End Contract / Rental Expiry State
  const [isRentalExpiryModalVisible, setRentalExpiryModalVisible] = useState(false);
  const [expiringOrder, setExpiringOrder] = useState<OrderCard | null>(null);

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

  // Compute days until expiry for the selected order
  const daysUntilExpiry = useMemo(() => {
    if (!orderDetailsData?.endDate) return undefined;
    const endDate = new Date(orderDetailsData.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    const diffTime = endDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [orderDetailsData?.endDate]);

  // Check if order can end contract (IN_USE status)
  const canEndContract = useMemo(() => {
    return orderDetailsData?.orderStatus === 'IN_USE';
  }, [orderDetailsData?.orderStatus]);

  // Check if handover button should be shown (for orders that may have handover reports)
  const shouldShowHandoverButton = useMemo(() => {
    const status = orderDetailsData?.orderStatus?.toUpperCase();
    // Show handover button for orders that are being delivered, delivered, or in use
    return ['DELIVERING', 'RESCHEDULED', 'DELIVERY_CONFIRMED', 'IN_USE', 'COMPLETED'].includes(status || '');
  }, [orderDetailsData?.orderStatus]);

  // Check if there are unsigned handover reports
  const hasUnsignedHandover = useMemo(() => {
    return handoverReports.some(r => r.staffSigned && !r.customerSigned);
  }, [handoverReports]);

  // Check if settlement is awaiting response
  const hasPendingSettlement = useMemo(() => {
    return settlement?.state === 'AWAITING_RESPONSE';
  }, [settlement?.state]);

  // Load handover reports for an order
  const loadHandoverReports = useCallback(async (orderId: number) => {
    if (!session?.accessToken) return;

    setHandoverLoading(true);
    setHandoverError(null);
    try {
      const reports = await fetchHandoverReportsByOrderId(session, orderId);
      setHandoverReports(reports);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải biên bản bàn giao';
      setHandoverError(message);
    } finally {
      setHandoverLoading(false);
    }
  }, [session]);

  // Load settlement for an order
  const loadSettlement = useCallback(async (orderId: number) => {
    if (!session?.accessToken) return;

    setSettlementLoading(true);
    setSettlementError(null);
    try {
      const data = await fetchSettlementByOrderId(session, orderId);
      setSettlement(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải thông tin quyết toán';
      setSettlementError(message);
    } finally {
      setSettlementLoading(false);
    }
  }, [session]);

  // Handover Reports handlers
  const handleOpenHandoverReports = useCallback(() => {
    if (orderDetailsTargetId) {
      loadHandoverReports(orderDetailsTargetId);
      setHandoverModalVisible(true);
    }
  }, [orderDetailsTargetId, loadHandoverReports]);

  const handleCloseHandoverReports = useCallback(() => {
    setHandoverModalVisible(false);
  }, []);

  const handleViewHandoverPdf = useCallback(async (report: HandoverReport) => {
    // Use the HandoverPdfDownloader ref to download
    if (!handoverPdfDownloaderRef.current) {
      Alert.alert('Lỗi', 'Không thể tải PDF. Vui lòng thử lại.');
      return;
    }
    await handoverPdfDownloaderRef.current(report);
  }, []);

  const handleOpenHandoverSign = useCallback((report: HandoverReport) => {
    setActiveHandoverReport(report);
    setHandoverSignModalVisible(true);
  }, []);

  const handleCloseHandoverSign = useCallback(() => {
    setHandoverSignModalVisible(false);
    setActiveHandoverReport(null);
  }, []);

  const handleSendHandoverPin = useCallback(async (email: string) => {
    if (!session?.accessToken || !activeHandoverReport) return;
    await sendHandoverReportPin(session, activeHandoverReport.handoverReportId, { email });
  }, [session, activeHandoverReport]);

  const handleSignHandover = useCallback(async (pinCode: string, signature: string) => {
    if (!session?.accessToken || !activeHandoverReport) return;
    await signHandoverReport(session, activeHandoverReport.handoverReportId, { pinCode, customerSignature: signature });
    // Refresh handover reports after signing
    if (orderDetailsTargetId) {
      loadHandoverReports(orderDetailsTargetId);
    }
    handleCloseHandoverSign();
  }, [session, activeHandoverReport, orderDetailsTargetId, loadHandoverReports, handleCloseHandoverSign]);

  // Settlement handlers
  const handleOpenSettlement = useCallback(() => {
    if (orderDetailsTargetId) {
      loadSettlement(orderDetailsTargetId);
      setSettlementModalVisible(true);
    }
  }, [orderDetailsTargetId, loadSettlement]);

  const handleCloseSettlement = useCallback(() => {
    setSettlementModalVisible(false);
  }, []);

  const handleAcceptSettlement = useCallback(async () => {
    if (!session?.accessToken || !settlement) return;
    await respondSettlement(session, settlement.settlementId, true);
    // Refresh settlement after accepting
    if (orderDetailsTargetId) {
      loadSettlement(orderDetailsTargetId);
    }
  }, [session, settlement, orderDetailsTargetId, loadSettlement]);

  const handleRejectSettlement = useCallback(async (reason?: string) => {
    if (!session?.accessToken || !settlement) return;
    await respondSettlement(session, settlement.settlementId, false, reason);
    // Refresh settlement after rejecting
    if (orderDetailsTargetId) {
      loadSettlement(orderDetailsTargetId);
    }
  }, [session, settlement, orderDetailsTargetId, loadSettlement]);

  // End Contract handlers
  const handleOpenEndContract = useCallback(() => {
    if (orderDetailsData && orderDetailsTargetId) {
      // Find the order card for this order
      const orderCard = orders.find(o => o.orderId === orderDetailsTargetId);
      if (orderCard) {
        setExpiringOrder(orderCard);
        setRentalExpiryModalVisible(true);
      }
    }
  }, [orderDetailsData, orderDetailsTargetId, orders]);

  const handleCloseEndContract = useCallback(() => {
    setRentalExpiryModalVisible(false);
    setExpiringOrder(null);
  }, []);

  const handleConfirmReturn = useCallback(async () => {
    if (!session?.accessToken || !expiringOrder) return;
    await confirmReturnRentalOrder(session, expiringOrder.orderId);
    // Close modal and refresh will happen via useEffect when modal closes
    handleCloseEndContract();
    // Trigger refresh by setting refreshing state
    setIsRefreshing(true);
  }, [session, expiringOrder, handleCloseEndContract]);

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
        const deviceDetailsMap = new Map<string, DeviceLookupEntry>();
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
                  const normalizedName =
                    label && label.trim().length > 0 ? label.trim() : `Device Model ${id}`;
                  deviceDetailsMap.set(id, {
                    name: normalizedName,
                    imageURL: device.imageURL?.trim() ?? null,
                  });
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

        const deviceDetailsRecord: Record<string, DeviceLookupEntry> = {};
        deviceDetailsMap.forEach((details, key) => {
          deviceDetailsRecord[key] = details;
        });

        setOrders(
          sorted.map((order) =>
            mapOrderResponseToCard(order, deviceDetailsMap, contractLookup[String(order.orderId)]),
          ),
        );
        setContractsByOrderId(contractLookup);
        setDeviceDetailsLookup(deviceDetailsRecord);
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

    // Check if selected filter is a specific status (uppercase) or a category
    const isSpecificStatus = selectedFilter === selectedFilter.toUpperCase() || selectedFilter.includes('_');

    if (isSpecificStatus) {
      // Filter by exact rawStatus match
      return orders.filter((order) => order.rawStatus === selectedFilter);
    }

    // Filter by category (statusFilter)
    return orders.filter((order) => order.statusFilter === selectedFilter);
  }, [orders, selectedFilter]);

  const openFlow = useCallback(
    (order: OrderCard, initialPaymentMethod?: PaymentMethod) => {
      // Use the latest contract from contractsByOrderId instead of potentially stale order.contract
      const latestContract = contractsByOrderId[String(order.orderId)] ?? order.contract ?? null;
      const shouldSkipToPayment = isContractSignedByCustomer(latestContract);
      lastContractLoadRef.current = { orderId: null, requestId: 0 };
      setActiveOrder(order);
      setActiveContract(latestContract);
      setContractErrorMessage(null);
      setContractLoading(false);
      setModalVisible(true);
      setCurrentStep(shouldSkipToPayment ? 3 : 1);
      setOtpDigits(Array(6).fill(''));
      setSelectedPayment(initialPaymentMethod ?? PAYMENT_OPTIONS[0].id);
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
    [contractsByOrderId, defaultVerificationEmail],
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

      // Build URLs with orderId for the payment result screen to identify the order
      const orderIdParam = `orderId=${activeOrder.orderId}`;
      const buildPaymentUrl = (baseUrl: string, additionalParams?: string) => {
        const separator = baseUrl.includes('?') ? '&' : '?';
        const params = additionalParams ? `${orderIdParam}&${additionalParams}` : orderIdParam;
        return `${baseUrl}${separator}${params}`;
      };

      const payload = {
        orderId: activeOrder.orderId,
        invoiceType: 'RENT_PAYMENT' as const,
        paymentMethod: selectedPayment,
        amount,
        description: `Rent payment for order #${activeOrder.orderId}`,
        returnUrl: buildPaymentUrl(PAYMENT_RETURN_URL),
        cancelUrl: buildPaymentUrl(PAYMENT_CANCEL_URL),
        frontendSuccessUrl: buildPaymentUrl(PAYMENT_SUCCESS_URL),
        frontendFailureUrl: buildPaymentUrl(PAYMENT_FAILURE_URL),
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

  const handleQuickPaymentStart = useCallback(
    (order: OrderCard, method: PaymentMethod) => {
      openFlow(order, method);
    },
    [openFlow],
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
              // Performance optimizations
              removeClippedSubviews={true}
              maxToRenderPerBatch={5}
              windowSize={5}
              updateCellsBatchingPeriod={50}
              initialNumToRender={5}
              getItemLayout={(_, index) => ({
                length: 200, // Approximate item height
                offset: 200 * index,
                index,
              })}
              renderItem={({ item }) => {
                const isHighlighted = highlightedOrderId === item.id;
                const thumbnailImages = item.deviceImageUrls?.filter((uri) => uri && uri.length > 0) ?? [];
                const maxVisibleThumbnails = 3;
                const visibleImages = thumbnailImages.slice(0, maxVisibleThumbnails);
                const stackWidth =
                  64 +
                  Math.max(visibleImages.length - 1, 0) * 16 +
                  (thumbnailImages.length > maxVisibleThumbnails ? 16 : 0);
                // Quick pay only available if contract is signed AND order is still in Pending status
                // Orders with DELIVERY_CONFIRMED or other Delivered statuses should not show quick pay
                const canQuickPay = isContractSignedByCustomer(item.contract) && item.statusFilter === 'Pending';
                return (
                  <View
                    style={[
                      styles.orderCard,
                      isHighlighted && styles.orderCardHighlighted,
                    ]}
                  >
                    <View style={styles.cardLeading}>
                      {visibleImages.length > 0 ? (
                        <View style={[styles.thumbnailStack, { width: stackWidth }]}>
                          {visibleImages.map((uri, index) => (
                            <Image
                              key={`${item.id}-thumb-${index}`}
                              source={{ uri }}
                              resizeMode="cover"
                              style={[styles.thumbnailImage, { left: index * 16, zIndex: visibleImages.length - index }]}
                            />
                          ))}
                          {thumbnailImages.length > maxVisibleThumbnails ? (
                            <View style={[styles.thumbnailMore, { left: visibleImages.length * 16 }]}>
                              <Text style={styles.thumbnailMoreLabel}>
                                +{thumbnailImages.length - maxVisibleThumbnails}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ) : (
                        <View style={styles.thumbnail}>
                          <Text style={styles.thumbnailText}>IMG</Text>
                        </View>
                      )}
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
                      {canQuickPay ? (
                        <View style={styles.quickPaySection}>
                          <Text style={styles.quickPayLabel}>Quick payment</Text>
                          <View style={styles.quickPayButtons}>
                            {PAYMENT_OPTIONS.map((option) => (
                              <Pressable
                                key={`${item.id}-${option.id}`}
                                style={styles.quickPayButton}
                                onPress={() => handleQuickPaymentStart(item, option.id)}
                              >
                                <View style={styles.quickPayButtonIcon}>
                                  {React.isValidElement(option.icon)
                                    ? React.cloneElement(option.icon, { size: 18 })
                                    : option.icon}
                                </View>
                                <Text style={styles.quickPayButtonLabel}>{option.label}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      ) : null}
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
                    {/* All button - always visible outside scroll */}
                    <Pressable
                      style={[styles.filterChip, selectedFilter === 'All' && styles.filterChipSelected]}
                      onPress={() => setSelectedFilter('All')}
                    >
                      <Text
                        style={[styles.filterLabel, selectedFilter === 'All' && styles.filterLabelSelected]}
                      >
                        All
                      </Text>
                    </Pressable>
                    {/* Status filters - horizontal scrollable */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filterScrollContent}
                    >
                      {ORDER_FILTERS.filter((f) => f !== 'All').map((filter) => {
                        const isSelected = selectedFilter === filter;
                        const label = FILTER_LABELS[filter] || filter;
                        return (
                          <Pressable
                            key={filter}
                            style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                            onPress={() => setSelectedFilter(filter)}
                          >
                            <Text
                              style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
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
              deviceDetailsLookup={deviceDetailsLookup}
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
              onViewHandoverReports={handleOpenHandoverReports}
              onViewSettlement={handleOpenSettlement}
              onEndContract={canEndContract ? handleOpenEndContract : undefined}
              hasUnsignedHandover={hasUnsignedHandover}
              hasPendingSettlement={hasPendingSettlement}
              canEndContract={canEndContract}
              daysUntilExpiry={daysUntilExpiry}
              shouldShowHandoverButton={shouldShowHandoverButton}
            />
            <HandoverPdfDownloader>
              {({ downloadHandoverReport }) => {
                // Store the download function in ref for use in handleViewHandoverPdf
                handoverPdfDownloaderRef.current = downloadHandoverReport;
                return (
                  <HandoverReportsModal
                    visible={isHandoverModalVisible}
                    reports={handoverReports}
                    loading={handoverLoading}
                    error={handoverError}
                    onClose={handleCloseHandoverReports}
                    onViewReport={downloadHandoverReport}
                    onSignReport={handleOpenHandoverSign}
                    onRefresh={() => orderDetailsTargetId && loadHandoverReports(orderDetailsTargetId)}
                  />
                );
              }}
            </HandoverPdfDownloader>
            <HandoverSignModal
              visible={isHandoverSignModalVisible}
              report={activeHandoverReport}
              userEmail={user?.email ?? ''}
              onClose={handleCloseHandoverSign}
              onSendPin={handleSendHandoverPin}
              onSign={handleSignHandover}
            />
            <SettlementModal
              visible={isSettlementModalVisible}
              settlement={settlement}
              loading={settlementLoading}
              error={settlementError}
              onClose={handleCloseSettlement}
              onAccept={handleAcceptSettlement}
              onReject={handleRejectSettlement}
              onRefresh={() => orderDetailsTargetId && loadSettlement(orderDetailsTargetId)}
            />
            <RentalExpiryModal
              visible={isRentalExpiryModalVisible}
              orderId={expiringOrder?.orderId ?? 0}
              orderDisplayId={String(expiringOrder?.orderId ?? '')}
              endDate={orderDetailsData?.endDate ?? ''}
              daysRemaining={daysUntilExpiry ?? 0}
              onConfirmReturn={handleConfirmReturn}
              onClose={handleCloseEndContract}
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
