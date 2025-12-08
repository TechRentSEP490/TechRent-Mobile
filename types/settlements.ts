/**
 * Settlement Types
 * Used for deposit refund after rental return
 */

export type SettlementState =
    | 'PENDING'
    | 'AWAITING_RESPONSE'
    | 'ISSUED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'CLOSED';

export type Settlement = {
    settlementId: number;
    orderId: number;
    state: SettlementState;
    totalDeposit: number;
    damageFee: number;
    lateFee: number;
    accessoryFee: number;
    finalReturnAmount: number; // Can be negative if customer owes money
    customerNote?: string;
    staffNote?: string;
    createdAt?: string;
    updatedAt?: string;
    respondedAt?: string;
};

export type SettlementResponse = {
    status: string;
    message?: string;
    code: number;
    data: Settlement | null;
};

export type RespondSettlementPayload = {
    accepted: boolean;
    customerNote?: string;
};

// Helper to calculate amounts from settlement
export const splitSettlementAmounts = (finalAmount: number) => {
    const netAmount = finalAmount;
    const refundAmount = netAmount > 0 ? netAmount : 0;
    const customerDueAmount = netAmount < 0 ? Math.abs(netAmount) : 0;
    return { refundAmount, customerDueAmount, netAmount };
};

// Status display map
export const SETTLEMENT_STATUS_MAP: Record<SettlementState, { label: string; color: string }> = {
    PENDING: { label: 'Đang xử lý', color: '#6b7280' },
    AWAITING_RESPONSE: { label: 'Chờ xác nhận', color: '#f59e0b' },
    ISSUED: { label: 'Đã chấp nhận', color: '#10b981' },
    REJECTED: { label: 'Đã từ chối', color: '#ef4444' },
    CANCELLED: { label: 'Đã hủy', color: '#6b7280' },
    CLOSED: { label: 'Đã tất toán', color: '#10b981' },
};
