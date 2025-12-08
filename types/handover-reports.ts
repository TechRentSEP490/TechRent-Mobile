/**
 * Handover Report Types
 * Used for checkout (delivery) and checkin (return) handover reports
 */

export type HandoverReportStatus =
    | 'DRAFT'
    | 'STAFF_SIGNED'
    | 'CUSTOMER_SIGNED'
    | 'BOTH_SIGNED'
    | 'COMPLETED';

export type HandoverReportType = 'CHECKOUT' | 'CHECKIN';

export type HandoverReportItem = {
    deviceId: number;
    deviceSerialNumber?: string;
    deviceModelName?: string;
    evidenceUrls?: string[];
};

export type HandoverReportStaff = {
    staffId: number;
    fullName: string;
    username: string;
    phoneNumber?: string;
    email?: string;
    role?: string;
};

export type HandoverReport = {
    handoverReportId: number;
    taskId?: number;
    orderId: number;
    customerInfo?: string;
    technicianInfo?: string;
    handoverType: HandoverReportType;
    status: HandoverReportStatus;
    handoverDateTime: string;
    handoverLocation: string;
    deliveryDateTime?: string;
    customerSigned: boolean;
    staffSigned: boolean;
    customerSignature?: string;
    staffSignature?: string;
    customerSignedAt?: string | null;
    staffSignedAt?: string | null;
    deliveryStaff?: HandoverReportStaff[];
    items?: HandoverReportItem[];
    deviceConditions?: unknown[];
    discrepancies?: unknown[];
    createdByStaff?: HandoverReportStaff;
};

export type HandoverReportListResponse = {
    status: string;
    message?: string;
    code: number;
    data: HandoverReport[] | null;
};

export type HandoverReportDetailResponse = {
    status: string;
    message?: string;
    code: number;
    data: HandoverReport | null;
};

export type SendHandoverPinPayload = {
    email: string;
};

export type SignHandoverPayload = {
    pinCode: string;
    customerSignature: string;
};

// Helper to translate status to Vietnamese
export const HANDOVER_STATUS_MAP: Record<HandoverReportStatus, { label: string; color: string }> = {
    DRAFT: { label: 'Bản nháp', color: '#6b7280' },
    STAFF_SIGNED: { label: 'Chờ khách ký', color: '#f59e0b' },
    CUSTOMER_SIGNED: { label: 'Khách đã ký', color: '#3b82f6' },
    BOTH_SIGNED: { label: 'Đã ký đầy đủ', color: '#10b981' },
    COMPLETED: { label: 'Hoàn thành', color: '#10b981' },
};

export const HANDOVER_TYPE_MAP: Record<HandoverReportType, string> = {
    CHECKOUT: 'Biên bản bàn giao',
    CHECKIN: 'Biên bản thu hồi',
};
