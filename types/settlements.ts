/**
 * Settlement Types - Các kiểu dữ liệu cho Quyết toán & Hoàn cọc
 * 
 * Quy trình quyết toán:
 * 1. Sau khi khách hàng trả thiết bị, nhân viên kiểm tra và tạo quyết toán
 * 2. Hệ thống tính toán: Tiền cọc - (Phí hư hỏng + Phí trễ hạn + Phí phụ kiện)
 * 3. Kết quả:
 *    - finalReturnAmount > 0: Khách được hoàn tiền
 *    - finalReturnAmount < 0: Khách phải thanh toán thêm
 *    - finalReturnAmount = 0: Vừa đủ, không hoàn/không thu thêm
 */

/**
 * Các trạng thái của quyết toán
 * - PENDING: Nhân viên đang xử lý, chưa gửi cho khách
 * - AWAITING_RESPONSE: Đã gửi, chờ khách xác nhận (chấp nhận/từ chối)
 * - ISSUED: Khách đã chấp nhận quyết toán
 * - REJECTED: Khách đã từ chối quyết toán (cần xem xét lại)
 * - CANCELLED: Quyết toán bị hủy bỏ
 * - CLOSED: Đã tất toán xong, hoàn cọc thành công
 */
export type SettlementState =
    | 'DRAFT'
    | 'PENDING'
    | 'AWAITING_RESPONSE'
    | 'ISSUED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'CLOSED';

/**
 * Cấu trúc dữ liệu Settlement - Phiếu quyết toán
 */
export type Settlement = {
    settlementId: number;          // ID phiếu quyết toán
    orderId: number;               // ID đơn hàng liên quan
    state: SettlementState;        // Trạng thái hiện tại
    totalDeposit: number;          // Tổng tiền cọc ban đầu khách đã đặt
    damageFee: number;             // Phí hư hỏng thiết bị (nếu có)
    lateFee: number;               // Phí trả trễ hạn (nếu có)
    accessoryFee: number;          // Phí phụ kiện thiếu/hỏng (nếu có)
    /**
     * Số tiền cuối cùng:
     * = totalDeposit - (damageFee + lateFee + accessoryFee)
     * - Giá trị dương: Khách được hoàn lại
     * - Giá trị âm: Khách phải trả thêm
     */
    finalReturnAmount: number;
    customerNote?: string;         // Ghi chú của khách hàng
    staffNote?: string;            // Ghi chú của nhân viên
    createdAt?: string;            // Thời điểm tạo
    updatedAt?: string;            // Thời điểm cập nhật
    respondedAt?: string;          // Thời điểm khách phản hồi
};

/**
 * Response wrapper từ API khi gọi settlement
 */
export type SettlementResponse = {
    status: string;       // 'SUCCESS' hoặc 'ERROR'
    message?: string;     // Thông báo từ server
    code: number;         // HTTP status code
    data: Settlement | null;
};

/**
 * Payload gửi lên khi khách phản hồi quyết toán
 */
export type RespondSettlementPayload = {
    accepted: boolean;    // true = chấp nhận, false = từ chối
    customerNote?: string; // Lý do từ chối (bắt buộc khi từ chối)
};

/**
 * Hàm tính toán và tách các số tiền từ finalAmount
 * 
 * Logic tính:
 * - netAmount: Giữ nguyên giá trị gốc (có thể âm hoặc dương)
 * - refundAmount: Số tiền khách được HOÀN (chỉ khi netAmount > 0)
 * - customerDueAmount: Số tiền khách phải TRẢ THÊM (chỉ khi netAmount < 0)
 * 
 * Ví dụ:
 * - finalAmount = 500,000 → refundAmount = 500,000, customerDueAmount = 0
 * - finalAmount = -200,000 → refundAmount = 0, customerDueAmount = 200,000
 * - finalAmount = 0 → refundAmount = 0, customerDueAmount = 0
 */
export const splitSettlementAmounts = (finalAmount: number) => {
    const netAmount = finalAmount;
    // Nếu netAmount > 0: Khách được hoàn lại số tiền này
    const refundAmount = netAmount > 0 ? netAmount : 0;
    // Nếu netAmount < 0: Lấy giá trị tuyệt đối để hiển thị số tiền khách cần trả
    const customerDueAmount = netAmount < 0 ? Math.abs(netAmount) : 0;
    return { refundAmount, customerDueAmount, netAmount };
};

/**
 * Mapping trạng thái quyết toán sang nhãn hiển thị và màu sắc
 * - label: Nhãn tiếng Việt hiển thị cho người dùng
 * - color: Mã màu HEX dùng cho badge/tag
 */
export const SETTLEMENT_STATUS_MAP: Record<SettlementState, { label: string; color: string }> = {
    DRAFT: { label: 'Nháp', color: '#6b7280' },                   // Xám - nhân viên đang soạn
    PENDING: { label: 'Đang xử lý', color: '#6b7280' },           // Xám - đang chờ
    AWAITING_RESPONSE: { label: 'Chờ xác nhận', color: '#f59e0b' }, // Vàng - cần hành động
    ISSUED: { label: 'Đã chấp nhận', color: '#10b981' },          // Xanh lá - thành công
    REJECTED: { label: 'Đã từ chối', color: '#ef4444' },          // Đỏ - bị từ chối
    CANCELLED: { label: 'Đã hủy', color: '#6b7280' },             // Xám - đã hủy
    CLOSED: { label: 'Đã tất toán', color: '#10b981' },           // Xanh lá - hoàn tất
};

// ==========================================
// Utility Functions
// ==========================================

/**
 * Translate settlement status to Vietnamese label and color
 */
export const translateSettlementStatus = (state: string | undefined | null): { label: string; color: string } => {
    const key = String(state || "").toUpperCase() as SettlementState;
    return SETTLEMENT_STATUS_MAP[key] || { label: state || "—", color: "#999" };
};

/**
 * Check if customer can respond (accept/reject) to settlement
 * Returns true if settlement is waiting for customer response
 */
export const canRespondSettlement = (state: string | undefined | null): boolean => {
    const s = String(state || "").toUpperCase();
    // Customer can respond when state is PENDING, AWAITING_RESPONSE, or similar
    // Cannot respond if already ISSUED, REJECTED, CANCELLED, or CLOSED
    return !["ISSUED", "REJECTED", "CANCELLED", "CLOSED"].includes(s);
};

/**
 * Get status message for customer display
 */
export const getSettlementStatusMessage = (state: string | undefined | null): string => {
    const s = String(state || "").toUpperCase();
    switch (s) {
        case "ISSUED":
            return "✓ Bạn đã chấp nhận quyết toán này.";
        case "REJECTED":
            return "✗ Bạn đã từ chối quyết toán này.";
        case "CLOSED":
            return "✓ Quyết toán đã tất toán xong. Cảm ơn bạn!";
        case "CANCELLED":
            return "Quyết toán đã bị hủy.";
        case "AWAITING_RESPONSE":
        case "PENDING":
            return "Vui lòng xem và xác nhận quyết toán để hoàn tất việc hoàn cọc.";
        default:
            return "Quyết toán đang được xử lý.";
    }
};

/**
 * Format VND currency
 */
export const formatSettlementVND = (amount: number | undefined | null): string => {
    if (amount == null || isNaN(Number(amount))) return "0 ₫";
    return Number(amount).toLocaleString("vi-VN") + " ₫";
};

