/**
 * Handover Report PDF Utilities
 * Adapted from web version for React Native mobile
 */

import type { HandoverReport } from '@/types/handover-reports';
import { formatDateTime } from '@/utils/order-formatters';

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

/**
 * Parse info string (format: "name • phone • email")
 */
export function parseInfoString(infoStr: string | undefined | null): { name: string; phone: string; email: string } {
    if (!infoStr) return { name: "", phone: "", email: "" };
    const parts = infoStr.split("•").map(s => s.trim()).filter(Boolean);
    return {
        name: parts[0] || "",
        phone: parts[1] || "",
        email: parts[2] || "",
    };
}

/**
 * Translate role to Vietnamese
 */
export function translateRole(role: string | undefined | null): string {
    const r = String(role || "").toUpperCase();
    if (r === "TECHNICIAN") return "Kỹ thuật viên";
    return role || "";
}

/**
 * Translate handover status to Vietnamese
 */
export function translateHandoverStatus(status: string | undefined | null): string {
    const s = String(status || "").toUpperCase();
    if (s === "STAFF_SIGNED") return "Nhân viên đã ký";
    if (s === "CUSTOMER_SIGNED") return "Khách hàng đã ký";
    if (s === "BOTH_SIGNED") return "2 bên đã ký";
    if (s === "PENDING_STAFF_SIGNATURE") return "Chờ nhân viên ký";
    if (s === "COMPLETED") return "Hoàn thành";
    if (s === "DRAFT") return "Bản nháp";
    return status || "—";
}

/**
 * National header HTML for official documents
 */
const NATIONAL_HEADER_HTML = `
  <div style="text-align:center;margin-bottom:16px">
    <div style="font-weight:700">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
    <div style="font-weight:600">Độc lập - Tự do - Hạnh phúc</div>
    <div style="width:120px;border-bottom:2px solid #000;margin:8px auto"></div>
  </div>
`;

/**
 * Build printable HTML for handover report
 * Simplified version adapted for mobile PDF generation
 */
export function buildHandoverReportHtml(report: HandoverReport): string {
    const customerInfo = parseInfoString(report.customerInfo);
    const technicianInfo = parseInfoString(report.technicianInfo);
    const customerName = customerInfo.name || "—";

    // Get technician info from deliveryStaff array or fallback to parsed info
    const technicianEntries: Array<{ name: string; phone: string; email: string }> = [];

    if (Array.isArray(report.deliveryStaff) && report.deliveryStaff.length > 0) {
        report.deliveryStaff.forEach(staff => {
            if (staff.fullName || staff.phoneNumber || staff.email) {
                technicianEntries.push({
                    name: staff.fullName || staff.username || "—",
                    phone: staff.phoneNumber || "",
                    email: staff.email || "",
                });
            }
        });
    }

    if (technicianEntries.length === 0 && (technicianInfo.name || technicianInfo.phone || technicianInfo.email)) {
        technicianEntries.push({
            name: technicianInfo.name || "—",
            phone: technicianInfo.phone || "",
            email: technicianInfo.email || "",
        });
    }

    const technicianDisplayName = technicianEntries[0]?.name || technicianInfo.name || "—";

    // Build items rows
    const itemsRows = (report.items || []).map((item, idx) => {
        const deviceName = item.deviceModelName || "—";
        const serialNumber = item.deviceSerialNumber || "—";

        return `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${escapeHtml(deviceName)}</td>
        <td>${escapeHtml(serialNumber)}</td>
        <td style="text-align:center">cái</td>
        <td style="text-align:center">1</td>
      </tr>
    `;
    }).join("");

    // Determine handover type
    const handoverType = String(report.handoverType || "").toUpperCase();
    const isCheckin = handoverType === "CHECKIN";
    const reportTitle = isCheckin ? "BIÊN BẢN THU HỒI THIẾT BỊ" : "BIÊN BẢN BÀN GIAO THIẾT BỊ";
    const dateTimeLabel = isCheckin ? "Thời gian thu hồi:" : "Thời gian bàn giao:";
    const locationLabel = isCheckin ? "Địa điểm thu hồi:" : "Địa điểm bàn giao:";
    const itemsLabel = isCheckin ? "Danh sách thiết bị thu hồi" : "Danh sách thiết bị bàn giao";

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            padding: 24px;
            font-size: 12px;
            line-height: 1.6;
            color: #000;
          }
          h1 { font-size: 18px; text-align: center; margin: 16px 0; }
          h3 { font-size: 14px; text-transform: uppercase; margin: 16px 0 8px; }
          .kv { margin-bottom: 12px; }
          .kv div { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          table th, table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          table th { background-color: #f5f5f5; font-weight: 600; }
          .signature-section { display: flex; justify-content: space-between; gap: 24px; margin-top: 32px; }
          .signature-box { flex: 1; text-align: center; }
          .signature-area { height: 80px; display: flex; align-items: center; justify-content: center; }
          .signed-check { font-size: 48px; color: #16a34a; }
        </style>
      </head>
      <body>
        ${NATIONAL_HEADER_HTML}
        
        <h1>${reportTitle}</h1>
        
        <section class="kv">
          <div><b>Mã biên bản:</b> #${report.handoverReportId}</div>
          <div><b>Mã đơn hàng:</b> #${report.orderId}</div>
          <div><b>${dateTimeLabel}</b> ${formatDateTime(report.handoverDateTime)}</div>
          <div><b>${locationLabel}</b> ${report.handoverLocation || "—"}</div>
          <div><b>Trạng thái:</b> ${translateHandoverStatus(report.status)}</div>
        </section>
        
        <h3>Thông tin khách hàng</h3>
        <section class="kv">
          <div><b>Họ và tên:</b> ${escapeHtml(customerName)}</div>
          ${customerInfo.phone ? `<div><b>Số điện thoại:</b> ${escapeHtml(customerInfo.phone)}</div>` : ""}
          ${customerInfo.email ? `<div><b>Email:</b> ${escapeHtml(customerInfo.email)}</div>` : ""}
        </section>
        
        <h3>Kỹ thuật viên</h3>
        <section class="kv">
          ${technicianEntries.map(tech => `
            <div style="margin-bottom:8px">
              <div><b>Họ và tên:</b> ${escapeHtml(tech.name)}</div>
              ${tech.phone ? `<div><b>Số điện thoại:</b> ${escapeHtml(tech.phone)}</div>` : ""}
              ${tech.email ? `<div><b>Email:</b> ${escapeHtml(tech.email)}</div>` : ""}
            </div>
          `).join("") || `<div>—</div>`}
        </section>
        
        <h3>${itemsLabel}</h3>
        <table>
          <thead>
            <tr>
              <th style="width:40px">STT</th>
              <th>Tên thiết bị</th>
              <th>Mã thiết bị (Serial)</th>
              <th style="width:70px">Đơn vị</th>
              <th style="width:60px;text-align:center">SL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows || `<tr><td colspan="5" style="text-align:center">Không có thiết bị</td></tr>`}
          </tbody>
        </table>
        
        ${report.createdByStaff ? `
          <h3>Người tạo biên bản</h3>
          <section class="kv">
            <div><b>Họ và tên:</b> ${escapeHtml(report.createdByStaff.fullName || report.createdByStaff.username || `Nhân viên #${report.createdByStaff.staffId}`)}</div>
            ${report.createdByStaff.email ? `<div><b>Email:</b> ${escapeHtml(report.createdByStaff.email)}</div>` : ""}
            ${report.createdByStaff.phoneNumber ? `<div><b>Số điện thoại:</b> ${escapeHtml(report.createdByStaff.phoneNumber)}</div>` : ""}
            ${report.createdByStaff.role ? `<div><b>Vai trò:</b> ${translateRole(report.createdByStaff.role)}</div>` : ""}
          </section>
        ` : ""}
        
        <div class="signature-section">
          <div class="signature-box">
            <div><b>KHÁCH HÀNG</b></div>
            <div class="signature-area">
              ${report.customerSigned ? '<div class="signed-check">✓</div>' : ""}
            </div>
            <div>
              ${report.customerSigned
            ? `<div style="font-weight:600">${escapeHtml(customerName)}</div>`
            : "(Ký, ghi rõ họ tên)"}
            </div>
            ${report.customerSignedAt ? `<div style="font-size:11px;color:#666">Ký ngày: ${formatDateTime(report.customerSignedAt)}</div>` : ""}
          </div>
          <div class="signature-box">
            <div><b>NHÂN VIÊN</b></div>
            <div class="signature-area">
              ${report.staffSigned ? '<div class="signed-check">✓</div>' : ""}
            </div>
            <div>
              ${report.staffSigned
            ? `<div style="font-weight:600">${escapeHtml(technicianDisplayName)}</div>`
            : "(Ký, ghi rõ họ tên)"}
            </div>
            ${report.staffSignedAt ? `<div style="font-size:11px;color:#666">Ký ngày: ${formatDateTime(report.staffSignedAt)}</div>` : ""}
          </div>
        </div>
      </body>
    </html>
  `;
}

export default {
    buildHandoverReportHtml,
    parseInfoString,
    translateRole,
    translateHandoverStatus,
};
