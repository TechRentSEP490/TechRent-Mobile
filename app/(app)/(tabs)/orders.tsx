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
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
// eslint-disable-next-line import/no-unresolved
import RNHTMLtoPDF from 'react-native-html-to-pdf';

import { useAuth } from '@/contexts/AuthContext';
import { fetchDeviceModelById } from '@/services/device-models';
import {
  fetchContractById,
  fetchContracts,
  sendContractPin,
  signContract,
  type ContractResponse,
} from '@/services/contracts';
import {
  fetchRentalOrderById,
  fetchRentalOrders,
  type RentalOrderResponse,
} from '@/services/rental-orders';

type OrderStatusFilter = 'All' | 'Pending' | 'Delivered' | 'In Use' | 'Completed';
type OrderStatus = Exclude<OrderStatusFilter, 'All'>;
type OrderActionType =
  | 'continueProcess'
  | 'extendRental'
  | 'confirmReceipt'
  | 'cancelOrder'
  | 'rentAgain'
  | 'downloadContract';

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
  contract?: ContractResponse | null;
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

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeRichHtml = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return '';
  }

  return trimmed
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>.*?<\/?head>/gis, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim();
};

const buildContractPdfHtml = (
  contract: ContractResponse,
  contextLabel?: string,
): string => {
  const fallbackTitle = contextLabel ? `${contextLabel} Contract` : `Contract #${contract.contractId}`;
  const contractTitle = contract.title && contract.title.trim().length > 0 ? contract.title.trim() : fallbackTitle;
  const contractNumber =
    contract.contractNumber && contract.contractNumber.trim().length > 0
      ? contract.contractNumber.trim()
      : contract.contractId
        ? `#${contract.contractId}`
        : '';
  const contractStatusLabel = formatContractStatus(contract.status);
  const totalAmountLabel =
    typeof contract.totalAmount === 'number' ? formatCurrency(contract.totalAmount) : undefined;
  const depositAmountLabel =
    typeof contract.depositAmount === 'number' ? formatCurrency(contract.depositAmount) : undefined;

  const metadata: { label: string; value: string }[] = [];

  if (contractNumber) {
    metadata.push({ label: 'Contract Number', value: contractNumber });
  }

  if (contractStatusLabel && contractStatusLabel !== 'Unknown') {
    metadata.push({ label: 'Status', value: contractStatusLabel });
  }

  if (contract.startDate) {
    metadata.push({ label: 'Start Date', value: formatDateTime(contract.startDate) });
  }

  if (contract.endDate) {
    metadata.push({ label: 'End Date', value: formatDateTime(contract.endDate) });
  }

  if (contract.signedAt) {
    metadata.push({ label: 'Signed At', value: formatDateTime(contract.signedAt) });
  }

  if (totalAmountLabel) {
    metadata.push({ label: 'Total Amount', value: totalAmountLabel });
  }

  if (depositAmountLabel) {
    metadata.push({ label: 'Deposit Amount', value: depositAmountLabel });
  }

  const sanitizedContent = sanitizeRichHtml(contract.contractContent);
  const sanitizedTerms = sanitizeRichHtml(contract.termsAndConditions);

  const sections: string[] = [];

  if (sanitizedContent.length > 0) {
    sections.push(`<section><h2>Agreement</h2>${sanitizedContent}</section>`);
  }

  if (sanitizedTerms.length > 0) {
    sections.push(`<section><h2>Terms &amp; Conditions</h2>${sanitizedTerms}</section>`);
  }

  if (sections.length === 0) {
    sections.push('<section><p>No contract content is available at this time.</p></section>');
  }

  const metadataHtml = metadata
    .map(
      (item) =>
        `<div class="meta-row"><span class="meta-label">${escapeHtml(item.label)}:</span><span class="meta-value">${escapeHtml(item.value)}</span></div>`,
    )
    .join('');

  const contextHeading = contextLabel ? `<p class="context">${escapeHtml(contextLabel)}</p>` : '';

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          padding: 32px;
          color: #111111;
          line-height: 1.6;
          font-size: 14px;
        }

        h1 {
          font-size: 24px;
          margin-bottom: 8px;
        }

        h2 {
          font-size: 18px;
          margin-bottom: 8px;
          margin-top: 24px;
        }

        p {
          margin: 0 0 12px 0;
        }

        .context {
          color: #4b5563;
          margin-bottom: 16px;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #e5e7eb;
          padding: 6px 0;
        }

        .meta-label {
          font-weight: 600;
          color: #374151;
        }

        .meta-value {
          color: #111827;
        }

        section {
          margin-top: 16px;
        }

        section:first-of-type {
          margin-top: 24px;
        }

        ul {
          padding-left: 20px;
        }

        li {
          margin-bottom: 8px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }

        th,
        td {
          border: 1px solid #d1d5db;
          padding: 8px;
          text-align: left;
        }

        strong {
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(contractTitle)}</h1>
      ${contextHeading}
      ${metadataHtml}
      ${sections.join('\n')}
    </body>
  </html>`;
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

const mapOrderResponseToCard = (
  order: RentalOrderResponse,
  deviceNames: Map<string, string>,
  contract?: ContractResponse | null,
): OrderCard => {
  const statusMeta = mapStatusToMeta(order.orderStatus);
  const normalizedContractStatus = contract?.status?.trim().toUpperCase();
  const isContractSigned = normalizedContractStatus === 'SIGNED';
  const action = isContractSigned
    ? { label: 'Download Contract', type: 'downloadContract' as const }
    : statusMeta.action;

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
    action,
    contract: contract ?? null,
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
  const [selectedPayment, setSelectedPayment] = useState(PAYMENT_OPTIONS[0].id);
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
  const [activeContractDownloadId, setActiveContractDownloadId] = useState<number | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
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

  const progressWidth = useMemo(() => `${(currentStep / 3) * 100}%`, [currentStep]);
  const isContractAlreadySigned = useMemo(
    () => activeContract?.status?.trim().toUpperCase() === 'SIGNED',
    [activeContract?.status],
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

  const filteredOrders = useMemo(() => {
    if (selectedFilter === 'All') {
      return orders;
    }

    return orders.filter((order) => order.statusFilter === selectedFilter);
  }, [orders, selectedFilter]);

  const openFlow = useCallback(
    (order: OrderCard) => {
      lastContractLoadRef.current = { orderId: null, requestId: 0 };
      setActiveOrder(order);
      setActiveContract(order.contract ?? null);
      setContractErrorMessage(null);
      setContractLoading(false);
      setModalVisible(true);
      setCurrentStep(1);
      setOtpDigits(Array(6).fill(''));
      setSelectedPayment(PAYMENT_OPTIONS[0].id);
      setHasAgreed(false);
      setVerificationEmail(defaultVerificationEmail);
      setPendingEmailInput(defaultVerificationEmail);
      setVerificationError(null);
      setIsSendingPin(false);
      setIsSigningContract(false);
      setEmailEditorVisible(false);
      setEmailEditorError(null);
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

    const targetOrderId = Number.parseInt(activeOrder.id, 10);

    if (Number.isNaN(targetOrderId)) {
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

  const handleDownloadContract = useCallback(
    async (contract: ContractResponse | null, contextLabel?: string) => {
      const contractId = contract?.contractId;
      const normalizedStatus = contract?.status?.trim().toUpperCase();

      if (!contractId) {
        Alert.alert(
          'Contract unavailable',
          contextLabel
            ? `A downloadable contract for ${contextLabel} is not available yet.`
            : 'This rental does not have a downloadable contract yet.',
        );
        return;
      }

      if (normalizedStatus !== 'SIGNED') {
        Alert.alert(
          'Contract pending',
          contextLabel
            ? `The contract for ${contextLabel} must be signed before it can be downloaded.`
            : 'The contract must be signed before it can be downloaded.',
        );
        return;
      }

      try {
        if (Platform.OS === 'web') {
          Alert.alert(
            'Download unavailable',
            'Contract downloads are only supported from the mobile application.',
          );
          return;
        }

        setActiveContractDownloadId(contractId);

        const activeSession = session?.accessToken ? session : await ensureSession();

        if (!activeSession?.accessToken) {
          throw new Error('You must be signed in to download the contract.');
        }

        const sessionCredentials = {
          accessToken: activeSession.accessToken,
          tokenType: activeSession.tokenType,
        };

        let contractDetails: ContractResponse | null = contract ?? null;
        const hasExistingContent = Boolean(
          contractDetails &&
            ((contractDetails.contractContent && contractDetails.contractContent.trim().length > 0) ||
              (contractDetails.termsAndConditions && contractDetails.termsAndConditions.trim().length > 0)),
        );

        if (!hasExistingContent) {
          contractDetails = await fetchContractById(sessionCredentials, contractId);
        }

        const hasDownloadableContent = Boolean(
          contractDetails &&
            ((contractDetails.contractContent && contractDetails.contractContent.trim().length > 0) ||
              (contractDetails.termsAndConditions && contractDetails.termsAndConditions.trim().length > 0)),
        );

        if (!hasDownloadableContent || !contractDetails) {
          throw new Error('The contract details are not yet available for download.');
        }

        const html = buildContractPdfHtml(contractDetails, contextLabel);
        const pdfResult = await RNHTMLtoPDF.convert({
          html,
          fileName: `contract-${contractId}`,
          base64: false,
          directory: 'Documents',
        });

        if (!pdfResult) {
          throw new Error('Failed to generate the contract PDF. Please try again.');
        }

        const pdfPath = pdfResult.filePath ?? pdfResult.path;

        if (!pdfPath) {
          throw new Error('Failed to generate the contract PDF. Please try again.');
        }

        const normalizedPath =
          Platform.OS === 'android' && !pdfPath.startsWith('file://') ? `file://${pdfPath}` : pdfPath;

        const shareTitle =
          contextLabel && contextLabel.trim().length > 0
            ? `${contextLabel} Contract`
            : contractDetails.title && contractDetails.title.trim().length > 0
              ? contractDetails.title.trim()
              : `Contract #${contractId}`;

        const sharePayload =
          Platform.OS === 'ios'
            ? { url: normalizedPath, title: shareTitle }
            : {
                url: normalizedPath,
                title: shareTitle,
                message: `Rental contract PDF: ${normalizedPath}`,
              };

        await Share.share(sharePayload);
      } catch (error) {
        const fallbackMessage = 'Unable to download the contract. Please try again later.';
        const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);
        Alert.alert(
          'Download contract',
          normalizedError.message && normalizedError.message.trim().length > 0
            ? normalizedError.message
            : fallbackMessage,
        );
      } finally {
        setActiveContractDownloadId((current) => (current === contractId ? null : current));
      }
    },
    [ensureSession, session],
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
        case 'downloadContract':
          handleDownloadContract(order.contract ?? null, order.title);
          break;
        default:
          break;
      }
    },
    [handleDownloadContract, openFlow],
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
      const parsedId = Number.parseInt(order.id, 10);

      if (Number.isNaN(parsedId) || parsedId <= 0) {
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: {
        const isSignedContract = isContractAlreadySigned;
        const canAgreeToContract =
          Boolean(activeContract) && !isContractLoading && !contractErrorMessage && !isSignedContract;
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
        const isDownloadingActiveContract = Boolean(
          activeContract?.contractId && activeContractDownloadId === activeContract.contractId,
        );
        const contractRentalDays =
          typeof activeContract?.rentalPeriodDays === 'number'
            ? `${activeContract.rentalPeriodDays} day${activeContract.rentalPeriodDays === 1 ? '' : 's'}`
            : '—';
        const contractStart = formatDateTime(activeContract?.startDate);
        const contractEnd = formatDateTime(activeContract?.endDate);
        const contractExpires = formatDateTime(activeContract?.expiresAt);
        const contractCreated = formatDateTime(activeContract?.createdAt);
        const contractUpdated = formatDateTime(activeContract?.updatedAt);
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
                      <Text style={styles.contractMetaLabel}>Rental Days</Text>
                      <Text style={styles.contractMetaValue}>{contractRentalDays}</Text>
                    </View>
                    <View style={styles.contractMetaRow}>
                      <Text style={styles.contractMetaLabel}>Start Date</Text>
                      <Text style={styles.contractMetaValue}>{contractStart}</Text>
                    </View>
                    <View style={styles.contractMetaRow}>
                      <Text style={styles.contractMetaLabel}>End Date</Text>
                      <Text style={styles.contractMetaValue}>{contractEnd}</Text>
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
                    <View style={styles.contractMetaRow}>
                      <Text style={styles.contractMetaLabel}>Created</Text>
                      <Text style={styles.contractMetaValue}>{contractCreated}</Text>
                    </View>
                  <View style={styles.contractMetaRow}>
                    <Text style={styles.contractMetaLabel}>Updated</Text>
                    <Text style={styles.contractMetaValue}>{contractUpdated}</Text>
                  </View>
                </View>
                {isSignedContract ? (
                  <View style={styles.contractSignedBanner}>
                    <Ionicons name="checkmark-circle" size={16} color="#15803d" />
                    <Text style={styles.contractSignedText}>
                      This contract has already been signed. Use the download button below to keep a copy for your
                      records.
                    </Text>
                  </View>
                ) : null}
                {contractDescription.length > 0 && (
                  <Text style={styles.contractBody}>{contractDescription}</Text>
                )}
                  {contractBody.length > 0 && (
                    <View style={styles.contractSection}>
                      <Text style={styles.contractSectionHeading}>Contract Content</Text>
                      <Text style={styles.contractBody}>{contractBody}</Text>
                    </View>
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
              {isSignedContract ? (
                <Pressable
                  style={[
                    styles.primaryButton,
                    styles.buttonFlex,
                    styles.primaryButtonEnabled,
                    isDownloadingActiveContract && styles.primaryButtonBusy,
                  ]}
                  onPress={() =>
                    !isDownloadingActiveContract &&
                    handleDownloadContract(activeContract, activeOrder?.title)
                  }
                  disabled={isDownloadingActiveContract}
                >
                  {isDownloadingActiveContract ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Download Contract</Text>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  style={[
                    styles.primaryButton,
                    styles.buttonFlex,
                    isAgreementComplete ? styles.primaryButtonEnabled : styles.primaryButtonDisabled,
                  ]}
                  onPress={handleAgreementContinue}
                  disabled={!isAgreementComplete || isSendingPin}
                >
                  {isSendingPin ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text
                      style={[
                        styles.primaryButtonText,
                        !isAgreementComplete && styles.primaryButtonTextDisabled,
                      ]}
                    >
                      Next
                    </Text>
                  )}
                </Pressable>
              )}
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
            <Text style={styles.stepSubtitle}>
              {verificationEmail
                ? `We've sent a 6-digit code to ${verificationEmail}`
                : 'Enter the 6-digit code we sent to your email address'}
            </Text>
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
            {verificationError ? (
              <Text style={styles.otpErrorText} accessibilityRole="alert">
                {verificationError}
              </Text>
            ) : null}
            <View style={styles.verificationHelpers}>
              <Pressable onPress={handleResendCode} disabled={isSendingPin}>
                <Text
                  style={[styles.helperLink, isSendingPin && styles.helperLinkDisabled]}
                >
                  Didn&apos;t receive the code?
                </Text>
              </Pressable>
              <Text style={styles.helperText}>Resend available in 00:45</Text>
            </View>
            <Pressable
              style={[
                styles.primaryButton,
                isOtpComplete ? styles.primaryButtonEnabled : styles.primaryButtonDisabled,
              ]}
              onPress={handleVerifyCode}
              disabled={!isOtpComplete || isSigningContract}
            >
              {isSigningContract ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text
                  style={[
                    styles.primaryButtonText,
                    !isOtpComplete && styles.primaryButtonTextDisabled,
                  ]}
                >
                  Verify Code
                </Text>
              )}
            </Pressable>
            <Pressable
              style={[
                styles.helperButton,
                (isSigningContract || isSendingPin) && styles.helperButtonDisabled,
              ]}
              onPress={handleOpenEmailEditor}
              disabled={isSigningContract || isSendingPin}
            >
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
          const isDownloadAction = item.action?.type === 'downloadContract';
          const isDownloadingCardContract = Boolean(
            isDownloadAction &&
              item.contract?.contractId &&
              activeContractDownloadId === item.contract.contractId,
          );
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
                      style={[
                        styles.cardActionButton,
                        isDownloadingCardContract && styles.cardActionButtonDisabled,
                      ]}
                      onPress={() => {
                        if (!isDownloadingCardContract) {
                          handleCardAction(item);
                        }
                      }}
                      disabled={isDownloadingCardContract}
                    >
                      {isDownloadingCardContract ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.cardActionLabel}>{item.action.label}</Text>
                      )}
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
      <Modal
        animationType="fade"
        transparent
        visible={isEmailEditorVisible}
        onRequestClose={handleCloseEmailEditor}
      >
        <View style={styles.emailModalOverlay}>
          <View style={styles.emailModalCard}>
            <Text style={styles.emailModalTitle}>Update email address</Text>
            <Text style={styles.emailModalDescription}>
              Enter the email you want to use to receive the verification code.
            </Text>
            <TextInput
              style={[
                styles.emailInput,
                emailEditorError ? styles.emailInputError : null,
              ]}
              placeholder="name@example.com"
              value={pendingEmailInput}
              onChangeText={(value) => {
                setPendingEmailInput(value);
                if (emailEditorError) {
                  setEmailEditorError(null);
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="email"
            />
            {emailEditorError ? (
              <Text style={styles.emailErrorText} accessibilityRole="alert">
                {emailEditorError}
              </Text>
            ) : null}
            <View style={styles.emailModalActions}>
              <Pressable style={styles.emailModalCancelButton} onPress={handleCloseEmailEditor}>
                <Text style={styles.emailModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.emailModalSaveButton} onPress={handleSaveEmail}>
                <Text style={styles.emailModalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="slide"
        transparent
        visible={isOrderDetailsModalVisible}
        onRequestClose={handleCloseOrderDetails}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.orderDetailsCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <Pressable style={styles.closeButton} onPress={handleCloseOrderDetails}>
                <Ionicons name="close" size={20} color="#111" />
              </Pressable>
            </View>
            {orderDetailsLoading ? (
              <View style={styles.orderDetailsState}>
                <ActivityIndicator color="#111111" />
                <Text style={styles.orderDetailsStateText}>Loading order details…</Text>
              </View>
            ) : orderDetailsError ? (
              <View style={styles.orderDetailsState}>
                <Text style={[styles.orderDetailsStateText, styles.orderDetailsErrorText]}>
                  {orderDetailsError}
                </Text>
                <Pressable style={styles.contractRetryButton} onPress={handleRetryOrderDetails}>
                  <Text style={styles.contractRetryButtonText}>Try Again</Text>
                </Pressable>
              </View>
            ) : orderDetailsData ? (
              <ScrollView style={styles.orderDetailsScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionHeading}>Summary</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Order ID</Text>
                    <Text style={styles.detailValue}>#{orderDetailsData.orderId}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text style={styles.detailValue}>{toTitleCase(orderDetailsData.orderStatus)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Created</Text>
                    <Text style={styles.detailValue}>{formatDateTime(orderDetailsData.createdAt)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Rental Period</Text>
                    <Text style={styles.detailValue}>
                      {formatRentalPeriod(orderDetailsData.startDate, orderDetailsData.endDate)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Shipping Address</Text>
                    <Text style={[styles.detailValue, styles.detailValueMultiline]}>
                      {orderDetailsData.shippingAddress || '—'}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionHeading}>Payment</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Price</Text>
                    <Text style={styles.detailValue}>{formatCurrency(orderDetailsData.totalPrice)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Price / Day</Text>
                    <Text style={styles.detailValue}>{formatCurrency(orderDetailsData.pricePerDay)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Deposit Due</Text>
                    <Text style={styles.detailValue}>{formatCurrency(orderDetailsData.depositAmount)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Deposit Held</Text>
                    <Text style={styles.detailValue}>{formatCurrency(orderDetailsData.depositAmountHeld)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Deposit Used</Text>
                    <Text style={styles.detailValue}>{formatCurrency(orderDetailsData.depositAmountUsed)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Deposit Refunded</Text>
                    <Text style={styles.detailValue}>{formatCurrency(orderDetailsData.depositAmountRefunded)}</Text>
                  </View>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionHeading}>Items</Text>
                  {orderDetailsData.orderDetails && orderDetailsData.orderDetails.length > 0 ? (
                    orderDetailsData.orderDetails.map((item) => {
                      const deviceName =
                        deviceNameLookup[String(item.deviceModelId)] ?? `Device Model ${item.deviceModelId}`;
                      return (
                        <View key={item.orderDetailId} style={styles.detailItemRow}>
                          <View style={styles.detailItemHeader}>
                            <Text style={styles.detailItemName}>{deviceName}</Text>
                            <Text style={styles.detailItemQty}>×{item.quantity}</Text>
                          </View>
                          <Text style={styles.detailItemMeta}>
                            Price / Day: {formatCurrency(item.pricePerDay)}
                          </Text>
                          <Text style={styles.detailItemMeta}>
                            Deposit / Unit: {formatCurrency(item.depositAmountPerUnit)}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.detailEmptyText}>No devices were found for this rental.</Text>
                  )}
                </View>
                {contractForSelectedOrder ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionHeading}>Contract</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status</Text>
                      <Text style={styles.detailValue}>
                        {formatContractStatus(contractForSelectedOrder.status)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Contract Number</Text>
                      <Text style={styles.detailValue}>
                        {contractForSelectedOrder.contractNumber &&
                        contractForSelectedOrder.contractNumber.trim().length > 0
                          ? contractForSelectedOrder.contractNumber.trim()
                          : `#${contractForSelectedOrder.contractId}`}
                      </Text>
                    </View>
                    <Pressable
                      style={[
                        styles.detailDownloadButton,
                        activeContractDownloadId === contractForSelectedOrder.contractId &&
                          styles.detailDownloadButtonDisabled,
                      ]}
                      onPress={() => {
                        if (activeContractDownloadId !== contractForSelectedOrder.contractId) {
                          handleDownloadContract(
                            contractForSelectedOrder,
                            `Order #${orderDetailsData.orderId}`,
                          );
                        }
                      }}
                      disabled={activeContractDownloadId === contractForSelectedOrder.contractId}
                    >
                      {activeContractDownloadId === contractForSelectedOrder.contractId ? (
                        <ActivityIndicator color="#1f7df4" />
                      ) : (
                        <>
                          <Ionicons name="download-outline" size={18} color="#1f7df4" />
                          <Text style={styles.detailDownloadLabel}>Download Contract</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            ) : (
              <View style={styles.orderDetailsState}>
                <Text style={styles.orderDetailsStateText}>No additional details are available.</Text>
              </View>
            )}
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
  cardActionButtonDisabled: {
    opacity: 0.6,
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
  contractSection: {
    marginTop: 16,
    gap: 8,
  },
  contractSectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
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
  contractSignedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#dcfce7',
    marginBottom: 12,
  },
  contractSignedText: {
    flex: 1,
    color: '#166534',
    fontSize: 13,
    lineHeight: 18,
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
  primaryButtonBusy: {
    opacity: 0.7,
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
  otpErrorText: {
    marginTop: 12,
    fontSize: 13,
    color: '#b91c1c',
    fontWeight: '500',
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
  helperLinkDisabled: {
    opacity: 0.5,
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
  helperButtonDisabled: {
    opacity: 0.6,
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
  emailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emailModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  emailModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  emailModalDescription: {
    fontSize: 14,
    color: '#4b5563',
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111111',
  },
  emailInputError: {
    borderColor: '#b91c1c',
  },
  emailErrorText: {
    fontSize: 12,
    color: '#b91c1c',
  },
  emailModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  emailModalCancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  emailModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  emailModalSaveButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#111111',
  },
  emailModalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  orderDetailsCard: {
    width: '90%',
    maxWidth: 420,
    maxHeight: '85%',
    borderRadius: 24,
    backgroundColor: '#ffffff',
    padding: 20,
    gap: 16,
  },
  orderDetailsScroll: {
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
  detailSection: {
    marginBottom: 20,
    gap: 8,
  },
  detailSectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
    flex: 0.5,
  },
  detailValue: {
    fontSize: 13,
    color: '#111111',
    fontWeight: '600',
    flex: 0.5,
    textAlign: 'right',
  },
  detailValueMultiline: {
    textAlign: 'right',
    flex: 1,
  },
  detailItemRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    marginBottom: 12,
    gap: 4,
  },
  detailItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginRight: 8,
  },
  detailItemQty: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  detailItemMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  detailEmptyText: {
    fontSize: 13,
    color: '#6b7280',
  },
  detailDownloadButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f7df4',
    backgroundColor: '#eef4ff',
    alignSelf: 'flex-start',
  },
  detailDownloadButtonDisabled: {
    opacity: 0.6,
  },
  detailDownloadLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f7df4',
  },
  orderDetailsState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  orderDetailsStateText: {
    fontSize: 13,
    color: '#4b5563',
    textAlign: 'center',
  },
  orderDetailsErrorText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
});

