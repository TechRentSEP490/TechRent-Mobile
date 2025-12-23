/**
 * Handover Report Types - Các kiểu dữ liệu cho Biên bản bàn giao & Thu hồi
 * 
 * Có 2 loại biên bản:
 * 1. CHECKOUT (Bàn giao): Khi giao thiết bị cho khách thuê
 * 2. CHECKIN (Thu hồi): Khi thu hồi thiết bị từ khách
 * 
 * Quy trình ký biên bản:
 * 1. Nhân viên tạo biên bản (DRAFT)
 * 2. Nhân viên ký trước (STAFF_SIGNED)
 * 3. Khách hàng ký sau (BOTH_SIGNED hoặc COMPLETED)
 * 
 * Lưu ý: Khách CHỈ được ký khi nhân viên đã ký trước (staffSigned = true)
 */

/**
 * Trạng thái biên bản bàn giao
 * - DRAFT: Mới tạo, chưa ai ký
 * - STAFF_SIGNED: Nhân viên đã ký, CHỜ KHÁCH KÝ → Đây là lúc khách có thể ký
 * - CUSTOMER_SIGNED: Khách đã ký (hiếm khi xảy ra trước nhân viên)
 * - BOTH_SIGNED: Cả hai bên đã ký xong
 * - COMPLETED: Biên bản hoàn tất, được lưu trữ
 */
export type HandoverReportStatus =
    | 'DRAFT'
    | 'STAFF_SIGNED'
    | 'CUSTOMER_SIGNED'
    | 'BOTH_SIGNED'
    | 'COMPLETED';

/**
 * Loại biên bản
 * - CHECKOUT: Biên bản BÀN GIAO (giao thiết bị cho khách)
 * - CHECKIN: Biên bản THU HỒI (thu lại thiết bị từ khách)
 */
export type HandoverReportType = 'CHECKOUT' | 'CHECKIN';

/**
 * Thông tin thiết bị trong biên bản
 */
export type HandoverReportItem = {
    deviceId: number;              // ID thiết bị cụ thể (từng máy)
    deviceSerialNumber?: string;   // Số serial thiết bị
    deviceModelName?: string;      // Tên model thiết bị
    evidenceUrls?: string[];       // Link ảnh chụp tình trạng thiết bị
};

/**
 * Thông tin nhân viên giao/nhận
 */
export type HandoverReportStaff = {
    staffId: number;
    fullName: string;
    username: string;
    phoneNumber?: string;
    email?: string;
    role?: string;                 // Vai trò: TECHNICIAN, DELIVERY, etc.
};

/**
 * Cấu trúc dữ liệu Biên bản bàn giao/thu hồi
 */
export type HandoverReport = {
    handoverReportId: number;      // ID biên bản
    taskId?: number;               // ID task liên quan (nếu có)
    orderId: number;               // ID đơn hàng
    customerInfo?: string;         // Thông tin khách hàng (tên, SĐT, CMND)
    technicianInfo?: string;       // Thông tin nhân viên kỹ thuật
    handoverType: HandoverReportType; // CHECKOUT hoặc CHECKIN
    status: HandoverReportStatus;  // Trạng thái biên bản
    handoverDateTime: string;      // Thời gian bàn giao thực tế
    handoverLocation: string;      // Địa điểm bàn giao
    deliveryDateTime?: string;     // Thời gian giao hàng dự kiến
    /**
     * Trạng thái ký tên - QUAN TRỌNG cho validation:
     * - customerSigned: Khách đã ký chưa?
     * - staffSigned: Nhân viên đã ký chưa?
     * 
     * Logic kiểm tra để hiển thị nút "Ký biên bản" cho khách:
     * canSign = staffSigned === true && customerSigned === false
     */
    customerSigned: boolean;
    staffSigned: boolean;
    customerSignature?: string;    // Chữ ký số của khách (base64 hoặc URL)
    staffSignature?: string;       // Chữ ký số của nhân viên
    customerSignedAt?: string | null; // Thời điểm khách ký
    staffSignedAt?: string | null;    // Thời điểm nhân viên ký
    deliveryStaff?: HandoverReportStaff[]; // Danh sách nhân viên giao hàng
    items?: HandoverReportItem[];         // Danh sách thiết bị trong biên bản
    deviceConditions?: unknown[];         // Tình trạng thiết bị
    discrepancies?: unknown[];            // Các điểm không khớp/khác biệt
    createdByStaff?: HandoverReportStaff; // Nhân viên tạo biên bản
};

/**
 * Response wrapper từ API - Danh sách biên bản
 */
export type HandoverReportListResponse = {
    status: string;
    message?: string;
    code: number;
    data: HandoverReport[] | null;
};

/**
 * Response wrapper từ API - Chi tiết biên bản
 */
export type HandoverReportDetailResponse = {
    status: string;
    message?: string;
    code: number;
    data: HandoverReport | null;
};

/**
 * Payload gửi mã PIN xác thực qua email
 * Dùng để xác minh danh tính trước khi ký
 */
export type SendHandoverPinPayload = {
    email: string;  // Email nhận mã PIN (6 số)
};

/**
 * Payload ký biên bản
 * Cần cả mã PIN (xác thực) và chữ ký số
 */
export type SignHandoverPayload = {
    pinCode: string;           // Mã PIN 6 số đã gửi qua email
    customerSignature: string; // Chữ ký số (thường là base64 của ảnh ký)
};

/**
 * Mapping trạng thái biên bản sang nhãn hiển thị và màu sắc
 * - label: Nhãn tiếng Việt cho người dùng
 * - color: Mã màu HEX dùng cho badge/tag
 */
export const HANDOVER_STATUS_MAP: Record<HandoverReportStatus, { label: string; color: string }> = {
    DRAFT: { label: 'Bản nháp', color: '#6b7280' },           // Xám - chưa ai ký
    STAFF_SIGNED: { label: 'Chờ khách ký', color: '#f59e0b' }, // Vàng - KHÁCH CẦN KÝ!
    CUSTOMER_SIGNED: { label: 'Khách đã ký', color: '#3b82f6' }, // Xanh dương
    BOTH_SIGNED: { label: 'Đã ký đầy đủ', color: '#10b981' },    // Xanh lá - hoàn thành
    COMPLETED: { label: 'Hoàn thành', color: '#10b981' },        // Xanh lá - lưu trữ
};

/**
 * Mapping loại biên bản sang tên tiếng Việt
 */
export const HANDOVER_TYPE_MAP: Record<HandoverReportType, string> = {
    CHECKOUT: 'Biên bản bàn giao',  // Khi GIAO thiết bị cho khách
    CHECKIN: 'Biên bản thu hồi',    // Khi THU LẠI thiết bị từ khách
};

// ==========================================
// CHECKIN (Thu hồi) Specific Types
// ==========================================

/**
 * Loại sự cố thiết bị khi thu hồi
 */
export type DiscrepancyType = 'DAMAGE' | 'LOSS' | 'OTHER';

/**
 * Sự cố phát hiện khi thu hồi thiết bị
 */
export type Discrepancy = {
    discrepancyId?: number;
    discrepancyType: DiscrepancyType;
    conditionDefinitionId: number;
    orderDetailId: number;
    deviceId: number;
    serialNumber?: string;          // Serial number của thiết bị bị lỗi
    deviceSerialNumber?: string;    // Alternative field name
    penaltyAmount?: number;         // Phí phạt (nếu có)
    staffNote?: string;             // Ghi chú của nhân viên
};

/**
 * Định nghĩa tình trạng thiết bị (để tính phí phạt)
 */
export type ConditionDefinition = {
    conditionDefinitionId: number;
    id?: number;                    // Alternative ID field
    name: string;
    description?: string;
    penaltyPercentage?: number;     // Phần trăm phạt
};

/**
 * Trạng thái chất lượng thiết bị
 */
export type QualityStatus = 'GOOD' | 'FAIR' | 'POOR';

/**
 * Thông tin chất lượng thiết bị
 */
export type DeviceQualityInfo = {
    deviceSerialNumber: string;
    deviceModelName: string;
    qualityStatus: QualityStatus;
    qualityDescription?: string;
};

/**
 * Tình trạng thiết bị (snapshots)
 */
export type DeviceCondition = {
    deviceConditionId?: number;
    deviceId: number;
    allocationId?: number;
    deviceSerial?: string;
    conditionDefinitionId?: number;
    baselineSnapshots?: Array<{
        source: string;
        conditionDetails?: Array<{
            conditionDefinitionId: number;
            severity: string;
        }>;
        images?: string[];
        deviceSerial?: string;
    }>;
};

// ==========================================
// Staff API Payload Types
// ==========================================

/**
 * Item trong checkin report (cho staff tạo)
 */
export type CheckinReportItem = {
    deviceId: number;
    evidenceUrls: string[];
};

/**
 * Payload tạo biên bản thu hồi mới
 * POST /api/staff/handover-reports/checkin
 */
export type CreateCheckinReportBody = {
    taskId: number;
    customerInfo: string;        // Format: "Họ tên • SĐT • Email"
    technicianInfo: string;
    handoverDateTime: string;    // ISO string
    handoverLocation: string;
    customerSignature: string;   // base64 hoặc URL
    items: CheckinReportItem[];
    discrepancies: Omit<Discrepancy, 'discrepancyId' | 'serialNumber' | 'deviceSerialNumber' | 'penaltyAmount'>[];
};

/**
 * Payload cập nhật biên bản thu hồi
 * PUT /api/staff/handover-reports/checkin/{id}
 */
export type UpdateCheckinReportBody = Omit<CreateCheckinReportBody, 'taskId'>;

/**
 * Payload ký biên bản (staff)
 * PATCH /api/staff/handover-reports/{id}/signature
 */
export type StaffSignPayload = {
    pinCode: string;
    staffSignature: string;
};
