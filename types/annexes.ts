/**
 * Contract Annex Types
 * Types for contract annexes (phụ lục hợp đồng) used with rental order extensions
 */

export type AnnexStatus =
    | 'PENDING_ADMIN_SIGNATURE'
    | 'PENDING_CUSTOMER_SIGNATURE'
    | 'PENDING_SIGNATURE'
    | 'SIGNED'
    | 'ACTIVE'
    | 'CANCELLED';

export type ExtensionStatus =
    | 'PROCESSING'
    | 'COMPLETED'
    | 'DONE'
    | 'PENDING'
    | 'CANCELLED'
    | 'IN_USE'
    | 'PAID'
    | 'DRAFT';

/**
 * Contract Annex - Phụ lục hợp đồng
 * Created when a rental extension is approved
 */
export type ContractAnnex = {
    id: number;
    annexId: number;
    contractId: number;
    extensionId: number;
    originalOrderId: number;
    annexNumber: string;
    contractNumber: string;
    title: string;
    description: string | null;
    annexContent: string | null;
    extensionStartDate: string;
    extensionEndDate: string;
    extensionDays: number;
    extensionFee: number;
    totalPayable: number;
    status: AnnexStatus;
    adminSignedAt: string | null;
    adminSignedBy: string | null;
    customerSignedAt: string | null;
    customerSignedBy: string | null;
    createdAt: string;
    invoiceStatus?: string; // Add optional invoiceStatus
};

/**
 * Rental Order Extension
 * Created when customer requests to extend rental period
 */
export type RentalOrderExtension = {
    extensionId: number;
    extensionStart: string;
    extensionEnd: string;
    durationDays: number;
    additionalPrice: number;
    status: ExtensionStatus;
    createdAt: string;
};

/**
 * Status mapping for UI display
 */
export const ANNEX_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
    PENDING_ADMIN_SIGNATURE: { label: 'Chờ admin ký', color: '#ea580c', bgColor: '#fff7ed' },
    PENDING_CUSTOMER_SIGNATURE: { label: 'Chờ bạn ký', color: '#d97706', bgColor: '#fffbeb' },
    PENDING_SIGNATURE: { label: 'Chờ ký', color: '#d97706', bgColor: '#fffbeb' },
    SIGNED: { label: 'Đã ký', color: '#16a34a', bgColor: '#dcfce7' },
    ACTIVE: { label: 'Có hiệu lực', color: '#16a34a', bgColor: '#dcfce7' },
    CANCELLED: { label: 'Đã hủy', color: '#dc2626', bgColor: '#fef2f2' },
};

export const EXTENSION_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
    PROCESSING: { label: 'Đang xử lý', color: '#2563eb', bgColor: '#dbeafe' },
    COMPLETED: { label: 'Hoàn thành', color: '#16a34a', bgColor: '#dcfce7' },
    DONE: { label: 'Hoàn thành', color: '#16a34a', bgColor: '#dcfce7' },
    PENDING: { label: 'Chờ xử lý', color: '#ea580c', bgColor: '#fff7ed' },
    CANCELLED: { label: 'Đã hủy', color: '#dc2626', bgColor: '#fef2f2' },
    IN_USE: { label: 'Có hiệu lực', color: '#16a34a', bgColor: '#dcfce7' },
    PAID: { label: 'Đã thanh toán', color: '#0891b2', bgColor: '#cffafe' },
    DRAFT: { label: 'Đang chờ xử lý', color: '#6b7280', bgColor: '#f3f4f6' },
};

/**
 * Helper function to check if annex needs customer signature
 */
export const annexNeedsCustomerSignature = (annex: ContractAnnex): boolean => {
    const status = annex.status?.toUpperCase();
    return status === 'PENDING_CUSTOMER_SIGNATURE' || status === 'PENDING_SIGNATURE';
};

/**
 * Helper function to check if annex is fully signed
 */
export const isAnnexFullySigned = (annex: ContractAnnex): boolean => {
    const status = annex.status?.toUpperCase();
    return status === 'SIGNED' || status === 'ACTIVE';
};

/**
 * Helper function to check if extension is already paid
 */
export const isExtensionPaid = (extension: RentalOrderExtension): boolean => {
    const status = extension.status?.toUpperCase();
    return ['IN_USE', 'PAID', 'COMPLETED', 'DONE'].includes(status ?? '');
};

/**
 * Get display metadata for annex status
 */
export const getAnnexStatusMeta = (status: string | null): { label: string; color: string; bgColor: string } => {
    if (!status) return { label: 'Không xác định', color: '#6b7280', bgColor: '#f3f4f6' };
    return ANNEX_STATUS_MAP[status.toUpperCase()] ?? { label: status, color: '#6b7280', bgColor: '#f3f4f6' };
};

/**
 * Get display metadata for extension status
 */
export const getExtensionStatusMeta = (status: string | null): { label: string; color: string; bgColor: string } => {
    if (!status) return { label: 'Không xác định', color: '#6b7280', bgColor: '#f3f4f6' };
    return EXTENSION_STATUS_MAP[status.toUpperCase()] ?? { label: status, color: '#6b7280', bgColor: '#f3f4f6' };
};
