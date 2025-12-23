/**
 * Handover Report PDF Utilities
 * Full-featured version matching web implementation
 * Includes device conditions, evidence images, and grouped discrepancies
 */

import type { ConditionDefinition, HandoverReport } from '@/types/handover-reports';
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
 * Translate discrepancy type to Vietnamese
 */
export function translateDiscrepancyType(type: string | undefined | null): string {
  const t = String(type || "").toUpperCase();
  switch (t) {
    case "DAMAGE": return "Hư hỏng";
    case "LOSS": return "Mất mát";
    case "OTHER": return "Khác";
    default: return type || "—";
  }
}

/**
 * Translate quality status to Vietnamese
 */
export function translateQualityStatus(status: string | undefined | null): string {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "GOOD": return "Tốt";
    case "FAIR": return "Khá";
    case "POOR": return "Kém";
    default: return status || "—";
  }
}

/**
 * Format number to VND currency string
 */
export function formatVND(amount: number | undefined | null): string {
  if (amount == null || isNaN(Number(amount))) return "—";
  return Number(amount).toLocaleString("vi-VN") + " VNĐ";
}

/**
 * Get color hex for status badges
 */
export function getStatusColor(status: string | undefined | null): string {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "BOTH_SIGNED":
    case "COMPLETED":
      return "#52c41a"; // green
    case "STAFF_SIGNED":
    case "CUSTOMER_SIGNED":
      return "#faad14"; // orange
    case "PENDING_STAFF_SIGNATURE":
    case "DRAFT":
      return "#1890ff"; // blue
    default:
      return "#999999"; // gray
  }
}

/**
 * Build customer info string from components
 */
export function buildCustomerInfoString(name: string, phone: string, email: string): string {
  return [name, phone, email].filter(Boolean).join(" • ");
}

/**
 * National header HTML for official documents
 */
const NATIONAL_HEADER_HTML = `
  <div style="text-align:center;margin-bottom:16px">
    <div style="font-weight:700;font-size:14px;letter-spacing:.3px;text-transform:uppercase">
      CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
    </div>
    <div style="font-size:13px;margin-top:2px">
      Độc lập – Tự do – Hạnh phúc
    </div>
    <div style="width:200px;height:0;border-top:1px solid #111;margin:6px auto 0"></div>
  </div>
`;

/**
 * Global print CSS styles
 */
const GLOBAL_PRINT_CSS = `
  <style>
    .print-pdf-root,
    .print-pdf-root * {
      font-family: Arial, Helvetica, 'Times New Roman', sans-serif !important;
      -webkit-font-smoothing: antialiased !important;
      text-rendering: optimizeLegibility !important;
    }
    .print-pdf-root h1, .print-pdf-root h2, .print-pdf-root h3 { 
      margin: 8px 0 6px; 
      font-weight: 700; 
    }
    .print-pdf-root h3 { 
      font-size: 14px; 
      text-transform: uppercase; 
    }
    .print-pdf-root p { margin: 6px 0; }
    .print-pdf-root .kv { margin-bottom: 10px; }
    .print-pdf-root .kv div { margin: 2px 0; }
    .print-pdf-root table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    .print-pdf-root table th, .print-pdf-root table td { 
      border: 1px solid #ddd; 
      padding: 8px; 
      text-align: left; 
      vertical-align: top;
    }
    .print-pdf-root table th { background-color: #f5f5f5; font-weight: 600; }
    .print-pdf-root .penalty-total {
      border-top: 1px solid #ddd;
      display: block;
      padding-top: 4px;
      margin-top: 4px;
      font-weight: 700;
    }
  </style>
`;

// Type definitions for internal use
type DiscrepancyItem = {
  discrepancyType?: string;
  serialNumber?: string;
  deviceSerialNumber?: string;
  deviceId?: number;
  conditionDefinitionId?: number;
  penaltyAmount?: number;
  staffNote?: string;
  conditionName?: string;
};

type GroupedDiscrepancy = {
  deviceSerial: string;
  discrepancyType: string;
  items: Array<{
    conditionName: string;
    penaltyAmount: number;
    staffNote: string;
  }>;
  totalPenalty: number;
};

// Local type for device condition (from API response)
type BaselineSnapshot = {
  source: string;
  conditionDetails?: Array<{
    conditionDefinitionId: number;
    severity: string;
  }>;
  images?: string[];
  deviceSerial?: string;
};

type DeviceCondition = {
  deviceConditionId?: number;
  deviceId: number;
  allocationId?: number;
  deviceSerial?: string;
  conditionDefinitionId?: number;
  baselineSnapshots?: BaselineSnapshot[];
};

type ConditionMap = Record<number, { name: string; description?: string }>;

/**
 * Build printable HTML for handover report
 * Full-featured version matching web implementation
 */
export function buildHandoverReportHtml(
  report: HandoverReport,
  conditionDefinitions: ConditionDefinition[] = []
): string {
  const customerInfo = parseInfoString(report.customerInfo);
  const technicianInfo = parseInfoString(report.technicianInfo);
  const customerName = customerInfo.name || "—";

  // Build condition map for quick lookup
  const conditionMap: ConditionMap = {};
  conditionDefinitions.forEach(cd => {
    const key = cd.conditionDefinitionId || (cd as any).id;
    if (key) conditionMap[key] = { name: cd.name, description: cd.description };
  });

  // Get technician entries
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

  // Determine handover type
  const handoverType = String(report.handoverType || "").toUpperCase();
  const isCheckin = handoverType === "CHECKIN";
  const reportTitle = isCheckin ? "BIÊN BẢN THU HỒI THIẾT BỊ" : "BIÊN BẢN BÀN GIAO THIẾT BỊ";
  const itemsLabel = isCheckin ? "Danh sách thiết bị thu hồi" : "Danh sách thiết bị bàn giao";
  const conditionColumnLabel = isCheckin ? "Tình trạng thiết bị khi bàn giao" : "Tình trạng thiết bị";

  // Build deviceConditions map by deviceId for quick lookup
  const deviceConditionsByDeviceId: Record<number, DeviceCondition[]> = {};
  if (Array.isArray(report.deviceConditions)) {
    (report.deviceConditions as DeviceCondition[]).forEach(dc => {
      if (dc.deviceId) {
        if (!deviceConditionsByDeviceId[dc.deviceId]) {
          deviceConditionsByDeviceId[dc.deviceId] = [];
        }
        deviceConditionsByDeviceId[dc.deviceId].push(dc);
      }
    });
  }

  // Helper function to get conditions and images for a device
  const getDeviceConditionsHtml = (deviceId: number | undefined): { conditions: string; images: string } => {
    if (!deviceId) return { conditions: "—", images: "—" };

    const deviceConditions = deviceConditionsByDeviceId[deviceId] || [];
    if (deviceConditions.length === 0) {
      return { conditions: "—", images: "—" };
    }

    const uniqueConditions = new Set<string>();
    const uniqueImages = new Set<string>();

    deviceConditions.forEach(dc => {
      const snapshots = dc.baselineSnapshots || [];
      if (snapshots.length === 0) return;

      // Prioritize HANDOVER_OUT snapshot, fallback to QC_BEFORE, then others
      const handoverOutSnapshot = snapshots.find((s: BaselineSnapshot) => String(s.source || "").toUpperCase() === "HANDOVER_OUT");
      const qcBeforeSnapshot = snapshots.find((s: BaselineSnapshot) => String(s.source || "").toUpperCase() === "QC_BEFORE");
      const selectedSnapshot = handoverOutSnapshot || qcBeforeSnapshot || snapshots[0];

      // Collect conditions from selected snapshot
      const conditionDetails = selectedSnapshot.conditionDetails || [];
      conditionDetails.forEach((cd: { conditionDefinitionId: number; severity: string }) => {
        const conditionDef = conditionMap[cd.conditionDefinitionId];
        const conditionName = conditionDef?.name || `Tình trạng #${cd.conditionDefinitionId}`;
        uniqueConditions.add(conditionName);
      });

      // Collect images from selected snapshot
      if (Array.isArray(selectedSnapshot.images)) {
        selectedSnapshot.images.forEach((img: string) => {
          uniqueImages.add(img);
        });
      }
    });

    const conditionsArray = Array.from(uniqueConditions);
    const conditionsHtml = conditionsArray.length > 0
      ? conditionsArray.map(c => `<div>• ${escapeHtml(c)}</div>`).join("")
      : "Tốt";

    const imagesArray = Array.from(uniqueImages);
    const imagesHtml = imagesArray.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px">
          ${imagesArray.slice(0, 3).map((img, imgIdx) => `
            <img 
              src="${escapeHtml(img)}" 
              alt="Ảnh ${imgIdx + 1}"
              style="max-width:60px;max-height:60px;border:1px solid #ddd;border-radius:4px;object-fit:contain"
              onerror="this.style.display='none'"
            />
          `).join("")}
          ${imagesArray.length > 3 ? `<div style="font-size:10px;color:#666">+${imagesArray.length - 3}</div>` : ""}
        </div>`
      : "—";

    return { conditions: conditionsHtml, images: imagesHtml };
  };

  // Build items rows with conditions and images
  const itemsRows = (report.items || []).map((item, idx) => {
    const deviceName = item.deviceModelName || "—";
    const serialNumber = item.deviceSerialNumber || "—";
    const { conditions, images } = getDeviceConditionsHtml(item.deviceId);
    const hasEvidence = Array.isArray(item.evidenceUrls) && item.evidenceUrls.length > 0;

    // If item has evidenceUrls, use those for images column
    const itemImages = hasEvidence
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px">
          ${item.evidenceUrls!.slice(0, 3).map((url, imgIdx) => `
            <img 
              src="${escapeHtml(url)}" 
              alt="Ảnh ${imgIdx + 1}"
              style="max-width:60px;max-height:60px;border:1px solid #ddd;border-radius:4px;object-fit:contain"
              onerror="this.style.display='none'"
            />
          `).join("")}
          ${item.evidenceUrls!.length > 3 ? `<div style="font-size:10px;color:#666">+${item.evidenceUrls!.length - 3}</div>` : ""}
        </div>`
      : images;

    return `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${escapeHtml(deviceName)}</td>
        <td>${escapeHtml(serialNumber)}</td>
        <td style="text-align:center">cái</td>
        <td style="text-align:center">1</td>
        <td style="text-align:center">1</td>
        <td>${conditions}</td>
        <td>${itemImages}</td>
      </tr>
    `;
  }).join("");

  // Build grouped discrepancies for CHECKIN reports (like web version)
  let discrepanciesHtml = "";
  if (isCheckin && Array.isArray(report.discrepancies) && report.discrepancies.length > 0) {
    const discrepanciesArray = report.discrepancies as DiscrepancyItem[];

    // Group discrepancies by serialNumber + discrepancyType
    const groupedDiscrepancies: Record<string, GroupedDiscrepancy> = {};

    discrepanciesArray.forEach((disc) => {
      const deviceSerial = disc.serialNumber || disc.deviceSerialNumber || "—";
      const discrepancyType = disc.discrepancyType || "OTHER";
      const groupKey = `${deviceSerial}_${discrepancyType}`;

      if (!groupedDiscrepancies[groupKey]) {
        groupedDiscrepancies[groupKey] = {
          deviceSerial,
          discrepancyType,
          items: [],
          totalPenalty: 0,
        };
      }

      // Get condition name
      const conditionDef = disc.conditionDefinitionId ? conditionMap[disc.conditionDefinitionId] : null;
      const conditionName = conditionDef?.name || disc.conditionName || `Tình trạng #${disc.conditionDefinitionId || 'N/A'}`;
      const penaltyAmount = Number(disc.penaltyAmount || 0);

      groupedDiscrepancies[groupKey].items.push({
        conditionName,
        penaltyAmount,
        staffNote: disc.staffNote || "",
      });

      groupedDiscrepancies[groupKey].totalPenalty += penaltyAmount;
    });

    const groupedArray = Object.values(groupedDiscrepancies);

    discrepanciesHtml = `
      <h3>SỰ CỐ THIẾT BỊ KHI THU HỒI</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px">STT</th>
            <th>Loại sự cố</th>
            <th>Thiết bị (Serial Number)</th>
            <th>Tình trạng thiết bị</th>
            <th style="width:120px;text-align:right">Phí phạt</th>
          </tr>
        </thead>
        <tbody>
          ${groupedArray.map((group, idx) => {
      const discrepancyTypeLabel = translateDiscrepancyType(group.discrepancyType);

      // Build conditions with individual penalties (like the image shows)
      const conditionsWithPenalty = group.items.map(item =>
        `${escapeHtml(item.conditionName)}: ${item.penaltyAmount > 0 ? formatVND(item.penaltyAmount) : "—"}`
      ).join("<br/>");

      // Show total if more than 1 item
      const totalPenaltyText = group.items.length > 1 && group.totalPenalty > 0
        ? `<br/><span class="penalty-total">Tổng: ${formatVND(group.totalPenalty)}</span>`
        : "";

      return `
              <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td>${discrepancyTypeLabel}</td>
                <td>${escapeHtml(group.deviceSerial)}</td>
                <td>${conditionsWithPenalty}${totalPenaltyText}</td>
                <td style="text-align:right;font-weight:600">${group.totalPenalty > 0 ? formatVND(group.totalPenalty) : "—"}</td>
              </tr>
            `;
    }).join("") || `<tr><td colspan="5" style="text-align:center">Không có sự cố nào</td></tr>`}
        </tbody>
      </table>
    `;
  }

  // Build evidence URLs section
  const allEvidenceUrls: string[] = [];
  (report.items || []).forEach(item => {
    if (Array.isArray(item.evidenceUrls)) {
      allEvidenceUrls.push(...item.evidenceUrls);
    }
  });

  const evidenceHtml = allEvidenceUrls.length > 0 ? `
    <h3>ẢNH BẰNG CHỨNG</h3>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin:12px 0">
      ${allEvidenceUrls.slice(0, 8).map((url, idx) => `
        <div style="flex:0 0 auto">
          <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#333">Bằng chứng ${idx + 1}</div>
          <img 
            src="${escapeHtml(url)}" 
            alt="Bằng chứng ${idx + 1}"
            style="max-width:150px;max-height:150px;border:1px solid #ddd;border-radius:4px;object-fit:contain"
            onerror="this.style.display='none'"
          />
        </div>
      `).join("")}
      ${allEvidenceUrls.length > 8 ? `<div style="padding:8px;color:#666">+${allEvidenceUrls.length - 8} ảnh khác</div>` : ""}
    </div>
  ` : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        ${GLOBAL_PRINT_CSS}
      </head>
      <body>
        <div class="print-pdf-root" style="padding:24px;font-size:12px;line-height:1.6;color:#000">
          ${NATIONAL_HEADER_HTML}
          
          <h1 style="text-align:center;margin:16px 0">${reportTitle}</h1>
          
          <section class="kv">
            <div><b>Mã biên bản:</b> #${report.handoverReportId}</div>
            <div><b>Mã đơn hàng:</b> #${report.orderId}</div>
            <div><b>${isCheckin ? "Thời gian thu hồi:" : "Thời gian bàn giao:"}</b> ${formatDateTime(report.handoverDateTime)}</div>
            <div><b>${isCheckin ? "Địa điểm thu hồi:" : "Địa điểm bàn giao:"}</b> ${report.handoverLocation || "—"}</div>
            <div><b>Trạng thái:</b> ${translateHandoverStatus(report.status)}</div>
          </section>
          
          <h3>Thông tin khách hàng</h3>
          <section class="kv">
            <div><b>Họ và tên:</b> ${escapeHtml(customerName)}</div>
            ${customerInfo.phone ? `<div><b>Số điện thoại:</b> ${escapeHtml(customerInfo.phone)}</div>` : ""}
            ${customerInfo.email ? `<div><b>Email:</b> ${escapeHtml(customerInfo.email)}</div>` : ""}
          </section>
          
          <h3>Kỹ thuật viên tham gia</h3>
          <section class="kv">
            ${technicianEntries.length > 0
      ? technicianEntries.map(tech => `
                <div style="margin-bottom:6px">
                  <b>${escapeHtml(tech.name)}</b>
                  ${tech.phone ? `<br/><span>Số điện thoại: ${escapeHtml(tech.phone)}</span>` : ""}
                  ${tech.email ? `<br/><span>Email: ${escapeHtml(tech.email)}</span>` : ""}
                </div>
              `).join("")
      : `<div>—</div>`
    }
          </section>
          
          <h3>${itemsLabel}</h3>
          <table>
            <thead>
              <tr>
                <th style="width:40px">STT</th>
                <th>Tên thiết bị</th>
                <th>Mã thiết bị (Serial Number)</th>
                <th style="width:60px">Đơn vị</th>
                <th style="width:60px;text-align:center">SL đặt</th>
                <th style="width:60px;text-align:center">SL giao</th>
                <th>${conditionColumnLabel}</th>
                <th>Ảnh bằng chứng</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows || `<tr><td colspan="8" style="text-align:center">Không có thiết bị</td></tr>`}
            </tbody>
          </table>
          
          ${discrepanciesHtml}
          
          ${report.createdByStaff ? `
            <h3>Người tạo biên bản</h3>
            <section class="kv">
              <div><b>Họ và tên:</b> ${escapeHtml(report.createdByStaff.fullName || report.createdByStaff.username || `Nhân viên #${report.createdByStaff.staffId}`)}</div>
              ${report.createdByStaff.email ? `<div><b>Email:</b> ${escapeHtml(report.createdByStaff.email)}</div>` : ""}
              ${report.createdByStaff.phoneNumber ? `<div><b>Số điện thoại:</b> ${escapeHtml(report.createdByStaff.phoneNumber)}</div>` : ""}
              ${report.createdByStaff.role ? `<div><b>Vai trò:</b> ${translateRole(report.createdByStaff.role)}</div>` : ""}
            </section>
          ` : ""}
          
          ${evidenceHtml}
          
          <section style="display:flex;justify-content:space-between;gap:24px;margin-top:28px">
            <div style="flex:1;text-align:center">
              <div><b>KHÁCH HÀNG</b></div>
              <div style="height:72px;display:flex;align-items:center;justify-content:center">
                ${report.customerSigned ? '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>' : ""}
              </div>
              <div>
                ${report.customerSigned
      ? `<div style="color:#000;font-weight:600">${escapeHtml(customerName)}</div>`
      : "(Ký, ghi rõ họ tên)"}
              </div>
              ${report.customerSignedAt ? `<div style="font-size:11px;color:#666">Ký ngày: ${formatDateTime(report.customerSignedAt)}</div>` : ""}
            </div>
            <div style="flex:1;text-align:center">
              <div><b>NHÂN VIÊN</b></div>
              <div style="height:72px;display:flex;align-items:center;justify-content:center">
                ${report.staffSigned ? '<div style="font-size:48px;color:#16a34a;line-height:1">✓</div>' : ""}
              </div>
              <div>
                ${report.staffSigned
      ? `<div style="color:#000;font-weight:600">${escapeHtml(technicianDisplayName)}</div>`
      : "(Ký, ghi rõ họ tên)"}
              </div>
              ${report.staffSignedAt ? `<div style="font-size:11px;color:#666">Ký ngày: ${formatDateTime(report.staffSignedAt)}</div>` : ""}
            </div>
          </section>
        </div>
      </body>
    </html>
  `;
}

/**
 * Build discrepancies HTML table for checkin reports (standalone function)
 */
export function buildDiscrepanciesHtml(
  discrepancies: Array<{
    discrepancyType?: string;
    serialNumber?: string;
    deviceSerialNumber?: string;
    conditionDefinitionId?: number;
    penaltyAmount?: number;
    staffNote?: string;
    conditionName?: string;
  }>,
  conditionDefinitions: Array<{ conditionDefinitionId?: number; id?: number; name: string }> = []
): string {
  if (!discrepancies || discrepancies.length === 0) return "";

  // Build condition map
  const conditionMap: Record<number, string> = {};
  conditionDefinitions.forEach(cd => {
    const key = cd.conditionDefinitionId || cd.id;
    if (key) conditionMap[key] = cd.name;
  });

  // Group discrepancies by serial + type
  const grouped: Record<string, GroupedDiscrepancy> = {};

  discrepancies.forEach((disc) => {
    const deviceSerial = disc.serialNumber || disc.deviceSerialNumber || "—";
    const discrepancyType = disc.discrepancyType || "OTHER";
    const groupKey = `${deviceSerial}_${discrepancyType}`;

    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        deviceSerial,
        discrepancyType,
        items: [],
        totalPenalty: 0,
      };
    }

    const conditionName = disc.conditionDefinitionId
      ? (conditionMap[disc.conditionDefinitionId] || disc.conditionName || `Tình trạng #${disc.conditionDefinitionId}`)
      : (disc.conditionName || "—");
    const penaltyAmount = Number(disc.penaltyAmount || 0);

    grouped[groupKey].items.push({
      conditionName,
      penaltyAmount,
      staffNote: disc.staffNote || "",
    });

    grouped[groupKey].totalPenalty += penaltyAmount;
  });

  const groupedArray = Object.values(grouped);

  const rows = groupedArray.map((group, idx) => {
    const conditionsWithPenalty = group.items.map(item =>
      `${escapeHtml(item.conditionName)}: ${item.penaltyAmount > 0 ? formatVND(item.penaltyAmount) : "—"}`
    ).join("<br/>");

    const totalPenaltyText = group.items.length > 1 && group.totalPenalty > 0
      ? `<br/><span class="penalty-total">Tổng: ${formatVND(group.totalPenalty)}</span>`
      : "";

    return `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${translateDiscrepancyType(group.discrepancyType)}</td>
        <td>${escapeHtml(group.deviceSerial)}</td>
        <td>${conditionsWithPenalty}${totalPenaltyText}</td>
        <td style="text-align:right;font-weight:600">${group.totalPenalty > 0 ? formatVND(group.totalPenalty) : "—"}</td>
      </tr>
    `;
  }).join("");

  return `
    <h3>SỰ CỐ THIẾT BỊ KHI THU HỒI</h3>
    <table>
      <thead>
        <tr>
          <th style="width:40px">STT</th>
          <th>Loại sự cố</th>
          <th>Thiết bị (Serial Number)</th>
          <th>Tình trạng thiết bị</th>
          <th style="width:120px;text-align:right">Phí phạt</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="5" style="text-align:center">Không có sự cố</td></tr>`}
      </tbody>
    </table>
  `;
}

export default {
  buildHandoverReportHtml,
  buildDiscrepanciesHtml,
  parseInfoString,
  translateRole,
  translateHandoverStatus,
  translateDiscrepancyType,
  translateQualityStatus,
  formatVND,
  getStatusColor,
  buildCustomerInfoString,
};
