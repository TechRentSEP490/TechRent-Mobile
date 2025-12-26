/**
 * Order Utilities
 * Constants, types, and helper functions for the Orders screen
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ExpoLinking from 'expo-linking';
import React from 'react';

import type { ContractResponse } from '@/types/contracts';
import type {
    DeviceLookupEntry,
    OrderActionType,
    OrderCard,
    OrderStatus,
    OrderStatusFilter,
    PaymentMethod,
} from '@/types/orders';
import type { RentalOrderResponse } from '@/types/rental-orders';
import { formatCurrency, formatRentalPeriod, toTitleCase } from '@/utils/order-formatters';

// ==========================================
// Types
// ==========================================

export interface ApiErrorWithStatus extends Error {
    status?: number;
}

export interface StatusMeta {
    filter: OrderStatus;
    label: string;
    color: string;
    background: string;
    action?: { label: string; type: OrderActionType };
}

export interface PaymentOption {
    id: PaymentMethod;
    label: string;
    description: string;
    icon: React.ReactNode;
}

// ==========================================
// Constants
// ==========================================

export const ORDER_FILTERS: OrderStatusFilter[] = [
    'All',
    'PENDING_KYC',
    'PENDING',
    'PROCESSING',
    'DELIVERY_CONFIRMED',
    'RESCHEDULED',
    'DELIVERING',
    'IN_USE',
    'CANCELLED',
    'REJECTED',
    'COMPLETED',
];

export const FILTER_LABELS: Record<string, string> = {
    'All': 'Tất cả',
    'PENDING_KYC': 'Chờ xác minh KYC',
    'PENDING': 'Đang chờ xử lý',
    'PROCESSING': 'Đang xử lý',
    'DELIVERY_CONFIRMED': 'Sẵn sàng giao',
    'RESCHEDULED': 'Đã đổi lịch',
    'DELIVERING': 'Đang giao hàng',
    'IN_USE': 'Đang sử dụng',
    'CANCELLED': 'Đã hủy',
    'REJECTED': 'Đã từ chối',
    'COMPLETED': 'Hoàn thành',
    // Categories (for backwards compatibility)
    'Pending': 'Đang chờ xử lý',
    'Delivered': 'Đã giao',
    'In Use': 'Đang sử dụng',
    'Completed': 'Hoàn thành',
};

export const STATUS_TEMPLATES: Record<
    OrderStatus,
    { defaultLabel: string; color: string; background: string; action?: { label: string; type: OrderActionType } }
> = {
    Pending: {
        defaultLabel: 'Đang chờ xử lý',
        color: '#b45309',
        background: '#fef3c7',
        action: { label: 'Tiếp tục xử lý', type: 'continueProcess' },
    },
    Delivered: {
        defaultLabel: 'Đã giao',
        color: '#047857',
        background: '#d1fae5',
        action: { label: 'Xác nhận nhận hàng', type: 'confirmReceipt' },
    },
    'In Use': {
        defaultLabel: 'Đang sử dụng',
        color: '#1d4ed8',
        background: '#dbeafe',
        // Không có action mặc định - sẽ dùng expiry button thay thế
    },
    Completed: {
        defaultLabel: 'Hoàn thành',
        color: '#111111',
        background: '#f3f4f6',
        action: { label: 'Thuê lại', type: 'rentAgain' },
    },
};

export const PAYMENT_OPTIONS: PaymentOption[] = [
    {
        id: 'VNPAY',
        label: 'VNPay',
        description: 'Thanh toán qua VNPay',
        icon: <Ionicons name="card-outline" size={24} color="#111" />,
    },
    {
        id: 'PAYOS',
        label: 'PayOS',
        description: 'Thanh toán qua PayOS',
        icon: <MaterialCommunityIcons name="wallet-outline" size={24} color="#111" />,
    },
];

export const ITEMS_PER_PAGE = 20;

// ==========================================
// Payment URL Utilities
// ==========================================

// Universal Links / App Links for VNPay redirect
const UNIVERSAL_LINK_BASE = 'https://www.techrent.website/app';

export const resolvePaymentUrl = (value: string | undefined, fallback: string): string =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

export const getUniversalLinkPaymentUrl = (status?: string): string => {
    const params = new URLSearchParams();
    if (status) {
        params.set('status', status);
    }
    const queryString = params.toString();
    return queryString
        ? `${UNIVERSAL_LINK_BASE}/payment-result?${queryString}`
        : `${UNIVERSAL_LINK_BASE}/payment-result`;
};

export const getPaymentResultUrl = (status?: string): string => {
    const isExpoGo = !Constants.appOwnership || Constants.appOwnership === 'expo';

    if (isExpoGo) {
        const baseUrl = ExpoLinking.createURL('payment-result', {
            queryParams: status ? { status } : undefined,
        });
        return baseUrl;
    }

    return getUniversalLinkPaymentUrl(status);
};

// Computed payment URLs
export const PAYMENT_RETURN_URL = resolvePaymentUrl(
    process.env.EXPO_PUBLIC_PAYMENT_RETURN_URL,
    getPaymentResultUrl(),
);

export const PAYMENT_CANCEL_URL = resolvePaymentUrl(
    process.env.EXPO_PUBLIC_PAYMENT_CANCEL_URL,
    getPaymentResultUrl('cancel'),
);

export const PAYMENT_SUCCESS_URL = resolvePaymentUrl(
    process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL,
    getPaymentResultUrl('success'),
);

export const PAYMENT_FAILURE_URL = resolvePaymentUrl(
    process.env.EXPO_PUBLIC_PAYMENT_FAILURE_URL,
    getPaymentResultUrl('failure'),
);

// ==========================================
// Helper Functions
// ==========================================

export const mapStatusToMeta = (status: string | null | undefined): StatusMeta => {
    const normalized = (status ?? '').toUpperCase();
    let filter: OrderStatus = 'Pending';
    let includeAction = true;
    let overrideLabel: string | null = null;
    let overrideAction: StatusMeta['action'] | undefined;

    switch (normalized) {
        // === PENDING STATUSES (before payment/delivery) ===
        case 'PENDING_KYC':
            filter = 'Pending';
            overrideLabel = 'Chờ xác minh KYC';
            overrideAction = { label: 'Hoàn thành KYC', type: 'completeKyc' };
            break;
        case 'PENDING':
            filter = 'Pending';
            overrideLabel = 'Đang chờ xử lý';
            break;
        case 'PROCESSING':
            filter = 'Pending';
            overrideLabel = 'Đang xử lý';
            break;

        // === DELIVERY STATUSES (after payment confirmed) ===
        case 'DELIVERY_CONFIRMED':
            filter = 'Pending';
            overrideLabel = 'Sẵn sàng giao';
            includeAction = false;
            break;
        case 'DELIVERING':
            filter = 'Delivered';
            overrideLabel = 'Đang giao hàng';
            includeAction = false;
            break;
        case 'RESCHEDULED':
            filter = 'Delivered';
            overrideLabel = 'Đã đổi lịch';
            includeAction = false;
            break;

        // === IN USE STATUS (customer has the device) ===
        case 'IN_USE':
            filter = 'In Use';
            overrideLabel = 'Đang sử dụng';
            break;

        // === COMPLETED STATUSES (order finished) ===
        case 'COMPLETED':
            filter = 'Completed';
            overrideLabel = 'Hoàn thành';
            break;
        case 'CANCELLED':
        case 'CANCELED':
            filter = 'Completed';
            overrideLabel = 'Đã hủy';
            includeAction = false;
            break;
        case 'REJECTED':
            filter = 'Completed';
            overrideLabel = 'Đã từ chối';
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

export const isValidEmail = (value: string): boolean => {
    if (!value) {
        return false;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
        return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.toLowerCase());
};

export const deriveDeviceSummary = (
    order: RentalOrderResponse,
    deviceDetails: Map<string, DeviceLookupEntry>,
): string => {
    if (!order.orderDetails || order.orderDetails.length === 0) {
        return 'Không có thiết bị';
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

            return `Mẫu thiết bị ${id}`;
        })
        .filter((value): value is string => Boolean(value && value.trim().length > 0));

    if (names.length === 0) {
        return `${order.orderDetails.length} thiết bị`;
    }

    if (names.length === 1) {
        return names[0];
    }

    const [firstName, ...rest] = names;
    return `${firstName} + ${rest.length} thiết bị khác`;
};

export const isContractSignedByCustomer = (contract?: ContractResponse | null): boolean => {
    if (!contract) {
        return false;
    }

    const signedAt = contract.signedAt;

    if (signedAt === null || signedAt === undefined || signedAt === 'null') {
        return false;
    }

    if (typeof signedAt === 'string' && signedAt.trim().length > 0) {
        return true;
    }

    return false;
};

export const mapOrderResponseToCard = (
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
        title: `Đơn hàng #${order.orderId}`,
        deviceSummary: deriveDeviceSummary(order, deviceDetails),
        deviceImageUrls,
        rentalPeriod: formatRentalPeriod(order.planStartDate, order.planEndDate),
        planStartDate: order.planStartDate,
        planEndDate: order.planEndDate,
        totalAmount: formatCurrency(totalDue),
        totalPrice,
        totalPriceLabel: formatCurrency(totalPrice),
        depositAmount,
        depositLabel: formatCurrency(depositAmount),
        totalDue,
        rawStatus: (order.orderStatus ?? '').toUpperCase(),
        statusFilter: statusMeta.filter,
        statusLabel: statusMeta.label,
        statusColor: statusMeta.color,
        statusBackground: statusMeta.background,
        action: statusMeta.action,
        contract: contract ?? null,
    };
};

export const buildPaymentUrl = (
    baseUrl: string,
    orderId: number,
    additionalParams?: string,
): string => {
    const orderIdParam = `orderId=${orderId}`;
    const separator = baseUrl.includes('?') ? '&' : '?';
    const params = additionalParams ? `${orderIdParam}&${additionalParams}` : orderIdParam;
    return `${baseUrl}${separator}${params}`;
};
