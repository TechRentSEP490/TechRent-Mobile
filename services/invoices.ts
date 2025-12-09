import { buildApiUrl } from './api';

// ============================================================
// TYPES - Định nghĩa kiểu dữ liệu cho Invoice
// ============================================================

export type InvoiceType = 'RENT_PAYMENT' | 'DEPOSIT_REFUND' | 'DAMAGE_FEE' | 'LATE_FEE' | 'OTHER';
export type InvoiceStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
export type PaymentMethod = 'VNPAY' | 'PAYOS' | 'BANK_ACCOUNT' | 'CASH' | 'OTHER';

export interface Invoice {
    invoiceId: number;
    rentalOrderId: number;
    invoiceType: InvoiceType;
    paymentMethod: PaymentMethod;
    invoiceStatus: InvoiceStatus;
    subTotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    depositApplied: number;
    paymentDate: string | null;
    dueDate: string | null;
    issueDate: string | null;
    proofUrl: string | null;
}

interface InvoiceListResponse {
    status: string;
    message: string;
    details: string;
    code: number;
    data: Invoice[];
}

// ============================================================
// API FUNCTIONS
// ============================================================

export type SessionCredentials = {
    accessToken: string;
    tokenType?: string | null;
};

/**
 * Fetch danh sách invoices theo rental order ID
 * GET /api/v1/payments/invoice/{rentalOrderId}
 */
export async function fetchInvoicesByOrderId(
    session: SessionCredentials,
    rentalOrderId: number
): Promise<Invoice[]> {
    if (!session?.accessToken) {
        throw new Error('An access token is required to fetch invoices.');
    }

    if (!Number.isFinite(rentalOrderId) || rentalOrderId <= 0) {
        throw new Error('A valid rental order ID is required.');
    }

    const response = await fetch(buildApiUrl('v1/payments/invoice', rentalOrderId), {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `${session.tokenType || 'Bearer'} ${session.accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Unable to fetch invoices (status ${response.status}).`);
    }

    const result: InvoiceListResponse = await response.json();

    if (result.status !== 'SUCCESS' || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Unable to fetch invoices.');
    }

    return result.data;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Lấy invoice thanh toán tiền thuê (RENT_PAYMENT)
 */
export function getRentPaymentInvoice(invoices: Invoice[]): Invoice | null {
    return invoices.find((inv) => inv.invoiceType === 'RENT_PAYMENT') ?? null;
}

/**
 * Lấy invoice hoàn cọc (DEPOSIT_REFUND)
 */
export function getDepositRefundInvoice(invoices: Invoice[]): Invoice | null {
    return invoices.find((inv) => inv.invoiceType === 'DEPOSIT_REFUND') ?? null;
}

/**
 * Tính tổng số tiền đã thanh toán thành công
 */
export function getTotalPaidAmount(invoices: Invoice[]): number {
    return invoices
        .filter((inv) => inv.invoiceStatus === 'SUCCEEDED' && inv.invoiceType === 'RENT_PAYMENT')
        .reduce((sum, inv) => sum + inv.totalAmount, 0);
}

/**
 * Tính tổng số tiền hoàn lại
 */
export function getTotalRefundedAmount(invoices: Invoice[]): number {
    return invoices
        .filter((inv) => inv.invoiceStatus === 'SUCCEEDED' && inv.invoiceType === 'DEPOSIT_REFUND')
        .reduce((sum, inv) => sum + inv.totalAmount, 0);
}

/**
 * Map invoice type sang label hiển thị
 */
export function getInvoiceTypeLabel(type: InvoiceType): string {
    switch (type) {
        case 'RENT_PAYMENT':
            return 'Rental Payment';
        case 'DEPOSIT_REFUND':
            return 'Deposit Refund';
        case 'DAMAGE_FEE':
            return 'Damage Fee';
        case 'LATE_FEE':
            return 'Late Fee';
        default:
            return 'Other';
    }
}

/**
 * Map invoice status sang label và màu
 */
export function getInvoiceStatusMeta(status: InvoiceStatus): { label: string; color: string } {
    switch (status) {
        case 'SUCCEEDED':
            return { label: 'Paid', color: '#15803d' };
        case 'PENDING':
            return { label: 'Pending', color: '#b45309' };
        case 'FAILED':
            return { label: 'Failed', color: '#dc2626' };
        case 'CANCELLED':
            return { label: 'Cancelled', color: '#6b7280' };
        case 'REFUNDED':
            return { label: 'Refunded', color: '#0891b2' };
        default:
            return { label: status, color: '#6b7280' };
    }
}

/**
 * Map payment method sang label
 */
export function getPaymentMethodLabel(method: PaymentMethod): string {
    switch (method) {
        case 'VNPAY':
            return 'VNPay';
        case 'PAYOS':
            return 'PayOS';
        case 'BANK_ACCOUNT':
            return 'Bank Transfer';
        case 'CASH':
            return 'Cash';
        default:
            return 'Other';
    }
}
