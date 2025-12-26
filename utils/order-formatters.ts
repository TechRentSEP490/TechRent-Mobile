/**
 * Order Formatters - Các hàm format hiển thị dữ liệu đơn hàng
 * 
 * Tất cả các hàm đều có xử lý lỗi (try-catch) để đảm bảo:
 * - Không crash app khi dữ liệu không hợp lệ
 * - Luôn trả về giá trị mặc định có thể hiển thị được
 */

/**
 * Format số tiền sang định dạng tiền Việt Nam
 * 
 * Logic:
 * 1. Sử dụng Intl.NumberFormat với locale 'vi-VN' và currency 'VND'
 * 2. Nếu lỗi (ví dụ: thiết bị không hỗ trợ), fallback sang format thủ công
 * 
 * Ví dụ:
 * - formatCurrency(1500000) → "1.500.000 ₫"
 * - formatCurrency(0) → "0 ₫"
 * - formatCurrency(NaN) → "0 ₫" (fallback)
 */
export const formatCurrency = (value: number): string => {
  try {
    // Sử dụng API chuẩn của JavaScript để format tiền tệ
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  } catch {
    // Fallback: Nếu Intl không khả dụng, format thủ công
    // Number.isFinite kiểm tra value có phải số hợp lệ không (loại bỏ NaN, Infinity)
    return `${Number.isFinite(value) ? Math.round(value).toLocaleString('vi-VN') : '0'} ₫`;
  }
};

/**
 * Format khoảng thời gian thuê từ ngày bắt đầu đến ngày kết thúc
 * 
 * Logic validation:
 * 1. Kiểm tra ngày bắt đầu có hợp lệ không (không phải null và parse được)
 * 2. Kiểm tra ngày kết thúc có hợp lệ không
 * 3. Nếu cùng năm, bỏ năm ở ngày đầu để gọn hơn
 * 
 * Ví dụ:
 * - ("2024-01-15", "2024-01-20") → "15 thg 1 - 20 thg 1, 2024"
 * - ("2024-12-25", "2025-01-05") → "25 thg 12, 2024 - 05 thg 1, 2025"
 * - ("2024-01-15", null) → "Starting 15 thg 1, 2024"
 * - (null, null) → "—"
 */
export const formatRentalPeriod = (startDateIso: string, endDateIso: string): string => {
  // Parse chuỗi ISO thành Date object
  const startDate = startDateIso ? new Date(startDateIso) : null;
  const endDate = endDateIso ? new Date(endDateIso) : null;

  // Validation: Kiểm tra ngày bắt đầu có hợp lệ không
  // getTime() trả về NaN nếu Date không hợp lệ
  if (!startDate || Number.isNaN(startDate.getTime())) {
    return '—'; // Trả về dấu gạch ngang nếu không có ngày hợp lệ
  }

  // Kiểm tra ngày kết thúc có hợp lệ không
  const hasValidEnd = Boolean(endDate && !Number.isNaN(endDate.getTime()));

  try {
    // Kiểm tra nếu cùng năm thì bỏ năm ở ngày đầu cho gọn
    const sameYear = hasValidEnd && endDate ? startDate.getFullYear() === endDate.getFullYear() : false;

    // Tạo formatter cho ngày bắt đầu
    // Nếu cùng năm: bỏ năm (dùng spread operator rỗng)
    // Nếu khác năm: thêm năm vào
    const startFormatter = new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
    const startLabel = startFormatter.format(startDate);

    if (hasValidEnd && endDate) {
      // Có ngày kết thúc hợp lệ → Hiển thị dạng "ngày - ngày"
      const endFormatter = new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric', // Luôn hiển thị năm ở ngày cuối
      });
      const endLabel = endFormatter.format(endDate);
      return `${startLabel} - ${endLabel}`;
    }

    // Không có ngày kết thúc → Hiển thị "Bắt đầu từ..."
    return `Bắt đầu từ ${startLabel}`;
  } catch {
    // Fallback khi Intl không khả dụng: dùng toDateString()
    if (hasValidEnd && endDate) {
      return `${startDate.toDateString()} - ${endDate.toDateString()}`;
    }

    return startDate.toDateString();
  }
};

/**
 * Format ngày giờ từ chuỗi ISO sang định dạng Việt Nam
 * 
 * Validation:
 * 1. Kiểm tra input có null/undefined không
 * 2. Kiểm tra Date có parse được không (không phải NaN)
 * 
 * Ví dụ:
 * - "2024-01-15T10:30:00Z" → "15 thg 1, 2024, 10:30"
 * - null → "—"
 * - "invalid-date" → "—"
 */
export const formatDateTime = (iso: string | null | undefined): string => {
  // Validation: Kiểm tra input không rỗng
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);

  // Validation: Kiểm tra date có hợp lệ không
  // new Date("invalid") tạo ra Invalid Date với getTime() = NaN
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  try {
    // Format đầy đủ: ngày, tháng, năm, giờ, phút
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    // Fallback khi Intl không khả dụng
    return date.toLocaleString();
  }
};

/**
 * Format trạng thái hợp đồng sang dạng Title Case
 * 
 * Logic chuyển đổi:
 * 1. Thay thế underscore và khoảng trắng bằng dấu cách
 * 2. Chuyển toàn bộ sang lowercase
 * 3. Viết hoa chữ cái đầu mỗi từ
 * 
 * Ví dụ:
 * - "PENDING_APPROVAL" → "Pending Approval"
 * - "IN_PROGRESS" → "In Progress"
 * - "signed" → "Signed"
 * - null → "Unknown"
 */
export const formatContractStatus = (status: string | null | undefined): string => {
  // Validation: Trả về mặc định nếu không có status
  if (!status) {
    return 'Không xác định';
  }

  // Chuẩn hóa: Thay underscore/nhiều khoảng trắng bằng 1 khoảng trắng
  const normalized = status.replace(/[_\s]+/g, ' ').toLowerCase();

  // Regex: Tìm chữ cái đầu tiên sau đầu chuỗi (^) hoặc sau khoảng trắng (\s)
  // Thay thế bằng chữ in hoa
  return normalized.replace(/(?:^|\s)([a-z])/g, (_, char: string) => char.toUpperCase());
};

/**
 * Chuyển chuỗi bất kỳ sang dạng Title Case
 * 
 * Logic xử lý:
 * 1. Chuyển toàn bộ sang lowercase
 * 2. Tách theo underscore hoặc khoảng trắng
 * 3. Lọc bỏ chuỗi rỗng
 * 4. Viết hoa chữ cái đầu mỗi phần
 * 5. Ghép lại bằng khoảng trắng
 * 
 * Ví dụ:
 * - "hello_world" → "Hello World"
 * - "PENDING" → "Pending"
 * - "in use" → "In Use"
 */
export const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    // Split theo underscore hoặc khoảng trắng (có thể nhiều liên tiếp)
    .split(/[_\s]+/)
    // Lọc bỏ chuỗi rỗng (trường hợp có nhiều _ liên tiếp)
    .filter(Boolean)
    // Map mỗi từ: viết hoa chữ đầu + ghép phần còn lại
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    // Ghép lại thành chuỗi với khoảng trắng
    .join(' ');
