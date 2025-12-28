import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import AnnexesList from '@/components/orders/AnnexesList';
import type { ContractResponse } from '@/services/contracts';
import type {
  Invoice
} from '@/services/invoices';
import type { RentalOrderResponse } from '@/services/rental-orders';
import styles from '@/style/orders.styles';
import type { ContractAnnex } from '@/types/annexes';
import type { DeviceLookupEntry } from '@/types/orders';
import type { Settlement } from '@/types/settlements';
import {
  formatContractStatus,
  formatCurrency,
  formatDateTime,
  formatRentalPeriod,
  toTitleCase,
} from '@/utils/order-formatters';
import { STATUS_TEMPLATES } from '@/utils/order-utils';

export type OrderDetailsModalProps = {
  visible: boolean;
  loading: boolean;
  error: string | null;
  order: RentalOrderResponse | null;
  deviceDetailsLookup: Record<string, DeviceLookupEntry>;
  contract: ContractResponse | null;
  isDownloadingContract: boolean;
  onClose: () => void;
  onRetry: () => void;
  onDownloadContract?: () => void;
  // Handover/settlement features
  onViewHandoverReports?: () => void;
  onViewSettlement?: () => void;
  onEndContract?: () => void;
  hasUnsignedHandover?: boolean;
  hasPendingSettlement?: boolean;
  canEndContract?: boolean;
  daysUntilExpiry?: number;
  shouldShowHandoverButton?: boolean;
  // Invoice data for transparency
  invoices?: Invoice[];
  invoicesLoading?: boolean;
  // Settlement data for accurate deposit info
  settlement?: Settlement | null;
  // Annexes (phụ lục hợp đồng)
  annexes?: ContractAnnex[];
  annexesLoading?: boolean;
  annexesError?: string | null;
  onSignAnnex?: (annex: ContractAnnex) => void;
  onPayAnnex?: (annex: ContractAnnex) => void;
};

export default function OrderDetailsModal({
  visible,
  loading,
  error,
  order,
  deviceDetailsLookup,
  contract,
  isDownloadingContract,
  onClose,
  onRetry,
  onDownloadContract,
  onViewHandoverReports,
  onViewSettlement,
  onEndContract,
  hasUnsignedHandover,
  hasPendingSettlement,
  canEndContract,
  daysUntilExpiry,
  shouldShowHandoverButton,
  invoices,
  invoicesLoading,
  settlement,
  annexes,
  annexesLoading,
  annexesError,
  onSignAnnex,
  onPayAnnex,
}: OrderDetailsModalProps) {
  // Helper functions for invoice display
  const getInvoiceTypeLabel = (type: string): string => {
    switch (type) {
      case 'RENT_PAYMENT': return 'Thanh toán tiền thuê';
      case 'DEPOSIT_REFUND': return 'Hoàn trả cọc';
      case 'DAMAGE_FEE': return 'Phí bồi thường';
      case 'LATE_FEE': return 'Phí trả muộn';
      default: return type;
    }
  };

  const getInvoiceStatusMeta = (status: string): { label: string; color: string; bgColor: string } => {
    switch (status) {
      case 'SUCCEEDED': return { label: 'Thành công', color: '#15803d', bgColor: '#dcfce7' };
      case 'PENDING': return { label: 'Chờ xử lý', color: '#b45309', bgColor: '#fef3c7' };
      case 'FAILED': return { label: 'Thất bại', color: '#dc2626', bgColor: '#fee2e2' };
      case 'CANCELLED': return { label: 'Đã hủy', color: '#6b7280', bgColor: '#f3f4f6' };
      default: return { label: status, color: '#6b7280', bgColor: '#f3f4f6' };
    }
  };

  const getPaymentMethodLabel = (method: string): string => {
    switch (method) {
      case 'VNPAY': return 'VNPay';
      case 'PAYOS': return 'PayOS';
      case 'BANK_ACCOUNT': return 'Chuyển khoản';
      case 'CASH': return 'Tiền mặt';
      default: return method;
    }
  };
  // Priority: settlement > invoices > order data
  // Settlement provides most accurate data after rental is completed

  // Deposit Held: settlement.totalDeposit > order.depositAmountHeld
  const depositHeldAmount = settlement?.totalDeposit ?? null;

  // Deposit Used (fees): settlement fees > invoice fees > order.depositAmountUsed
  const settlementFees = settlement
    ? (settlement.damageFee ?? 0) + (settlement.lateFee ?? 0) + (settlement.accessoryFee ?? 0)
    : null;
  const invoiceFees = invoices
    ?.filter((inv) =>
      (inv.invoiceType === 'DAMAGE_FEE' || inv.invoiceType === 'LATE_FEE') &&
      inv.invoiceStatus === 'SUCCEEDED'
    )
    .reduce((sum, inv) => sum + inv.totalAmount, 0) ?? 0;

  // Deposit Refunded: settlement.finalReturnAmount > invoice refunds > order.depositAmountRefunded
  const settlementRefund = settlement?.finalReturnAmount ?? null;
  const invoiceRefunds = invoices
    ?.filter((inv) => inv.invoiceType === 'DEPOSIT_REFUND' && inv.invoiceStatus === 'SUCCEEDED')
    .reduce((sum, inv) => sum + inv.totalAmount, 0) ?? 0;
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.orderDetailsCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chi tiết đơn hàng</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color="#111" />
            </Pressable>
          </View>
          {loading ? (
            <View style={styles.orderDetailsState}>
              <ActivityIndicator color="#111111" />
              <Text style={styles.orderDetailsStateText}>Đang tải chi tiết...</Text>
            </View>
          ) : error ? (
            <View style={styles.orderDetailsState}>
              <Text style={[styles.orderDetailsStateText, styles.orderDetailsErrorText]}>{error}</Text>
              <Pressable style={styles.contractRetryButton} onPress={onRetry}>
                <Text style={styles.contractRetryButtonText}>Thử lại</Text>
              </Pressable>
            </View>
          ) : order ? (
            <ScrollView style={styles.orderDetailsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>Tóm tắt</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Mã đơn hàng</Text>
                  <Text style={styles.detailValue}>#{order.orderId}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Trạng thái</Text>
                  <Text style={styles.detailValue}>
                    {STATUS_TEMPLATES[toTitleCase(order.orderStatus) as keyof typeof STATUS_TEMPLATES]?.defaultLabel ??
                      toTitleCase(order.orderStatus)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Ngày tạo</Text>
                  <Text style={styles.detailValue}>{formatDateTime(order.createdAt)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Thời gian thuê</Text>
                  <Text style={styles.detailValue}>
                    {formatRentalPeriod(order.planStartDate, order.planEndDate)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Địa chỉ giao hàng</Text>
                  <Text style={[styles.detailValue, styles.detailValueMultiline]}>
                    {order.shippingAddress || '—'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>Thanh toán</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tổng thanh toán</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(order.totalPrice + order.depositAmount)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tổng tiền thuê</Text>
                  <Text style={styles.detailValue}>{formatCurrency(order.totalPrice)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Đơn giá / ngày</Text>
                  <Text style={styles.detailValue}>{formatCurrency(order.pricePerDay)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    Cọc {order.depositAmountHeld > 0 ? '(Đã cọc)' : '(Yêu cầu)'}
                  </Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(order.depositAmountHeld > 0 ? order.depositAmountHeld : order.depositAmount)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cọc đã dùng (Phí)</Text>
                  <Text style={[
                    styles.detailValue,
                    ((settlementFees ?? 0) > 0 || invoiceFees > 0 || order.depositAmountUsed > 0) && { color: '#dc2626' }
                  ]}>
                    {formatCurrency(
                      settlementFees !== null ? settlementFees :
                        invoiceFees > 0 ? invoiceFees :
                          order.depositAmountUsed
                    )}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cọc hoàn trả</Text>
                  <Text style={[
                    styles.detailValue,
                    ((settlementRefund ?? 0) > 0 || invoiceRefunds > 0 || order.depositAmountRefunded > 0) && { color: '#15803d' }
                  ]}>
                    {formatCurrency(
                      settlementRefund !== null ? settlementRefund :
                        invoiceRefunds > 0 ? invoiceRefunds :
                          order.depositAmountRefunded
                    )}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>Thiết bị</Text>
                {order.orderDetails && order.orderDetails.length > 0 ? (
                  order.orderDetails.map((item) => {
                    const details = deviceDetailsLookup[String(item.deviceModelId)];
                    const deviceName = details?.name ?? `Mẫu thiết bị ${item.deviceModelId}`;
                    const imageSource =
                      details?.imageURL && details.imageURL.trim().length > 0
                        ? { uri: details.imageURL }
                        : null;
                    return (
                      <View key={item.orderDetailId} style={styles.detailItemRow}>
                        <View style={styles.detailItemContent}>
                          {imageSource ? (
                            <Image source={imageSource} style={styles.detailItemImage} />
                          ) : (
                            <View style={styles.detailItemImageFallback}>
                              <Text style={styles.detailItemImageFallbackLabel}>IMG</Text>
                            </View>
                          )}
                          <View style={styles.detailItemInfo}>
                            <View style={styles.detailItemHeader}>
                              <Text style={styles.detailItemName}>{deviceName}</Text>
                              <Text style={styles.detailItemQty}>×{item.quantity}</Text>
                            </View>
                            <Text style={styles.detailItemMeta}>
                              Giá / ngày: {formatCurrency(item.pricePerDay)}
                            </Text>
                            <Text style={styles.detailItemMeta}>
                              Cọc / máy: {formatCurrency(item.depositAmountPerUnit)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.detailEmptyText}>Không tìm thấy thiết bị nào.</Text>
                )}
              </View>

              {/* Payment History Section - Lịch sử thanh toán */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>Lịch sử thanh toán</Text>
                {invoicesLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }}>
                    <ActivityIndicator size="small" color="#111" />
                    <Text style={{ color: '#6f6f6f', fontSize: 14 }}>Đang tải lịch sử thanh toán...</Text>
                  </View>
                ) : invoices && invoices.length > 0 ? (
                  invoices.map((invoice) => {
                    const statusMeta = getInvoiceStatusMeta(invoice.invoiceStatus);
                    const isRefund = invoice.invoiceType === 'DEPOSIT_REFUND';
                    return (
                      <View
                        key={invoice.invoiceId}
                        style={{
                          backgroundColor: '#f9fafb',
                          borderRadius: 12,
                          padding: 14,
                          marginBottom: 10,
                          borderLeftWidth: 4,
                          borderLeftColor: statusMeta.color,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111' }}>
                              {getInvoiceTypeLabel(invoice.invoiceType)}
                            </Text>
                            <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                              {getPaymentMethodLabel(invoice.paymentMethod)}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{
                              fontSize: 16,
                              fontWeight: '700',
                              color: isRefund ? '#15803d' : '#111',
                            }}>
                              {isRefund ? '+' : ''}{formatCurrency(invoice.totalAmount)}
                            </Text>
                            <View style={{
                              backgroundColor: statusMeta.bgColor,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 999,
                              marginTop: 4,
                            }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: statusMeta.color }}>
                                {statusMeta.label}
                              </Text>
                            </View>
                          </View>
                        </View>
                        {invoice.paymentDate && (
                          <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                            {formatDateTime(invoice.paymentDate)}
                          </Text>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.detailEmptyText}>Chưa có lịch sử thanh toán.</Text>
                )}
              </View>
              {contract ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionHeading}>Hợp đồng</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Trạng thái</Text>
                    <Text style={styles.detailValue}>{formatContractStatus(contract.status)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Số hợp đồng</Text>
                    <Text style={styles.detailValue}>
                      {contract.contractNumber && contract.contractNumber.trim().length > 0
                        ? contract.contractNumber.trim()
                        : `#${contract.contractId}`}
                    </Text>
                  </View>
                  <Pressable
                    style={[
                      styles.detailDownloadButton,
                      isDownloadingContract && styles.detailDownloadButtonDisabled,
                    ]}
                    onPress={isDownloadingContract ? undefined : onDownloadContract}
                    disabled={isDownloadingContract}
                  >
                    {isDownloadingContract ? (
                      <ActivityIndicator color="#1f7df4" />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={18} color="#1f7df4" />
                        <Text style={styles.detailDownloadLabel}>Tải hợp đồng</Text>
                      </>
                    )}
                  </Pressable>
                  {/* Handover Document Button - beside Download Contract */}
                  {shouldShowHandoverButton && onViewHandoverReports && (
                    <Pressable
                      style={[
                        styles.detailDownloadButton,
                        { marginTop: 8, borderColor: hasUnsignedHandover ? '#ef4444' : '#3b82f6' },
                      ]}
                      onPress={onViewHandoverReports}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={18}
                        color={hasUnsignedHandover ? '#ef4444' : '#3b82f6'}
                      />
                      <Text style={[
                        styles.detailDownloadLabel,
                        { color: hasUnsignedHandover ? '#ef4444' : '#3b82f6' }
                      ]}>
                        Biên bản
                      </Text>
                      {hasUnsignedHandover && (
                        <View style={{
                          backgroundColor: '#ef4444',
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 999,
                          marginLeft: 8,
                        }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: '#fff' }}>
                            Chờ xử lý
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                  <Text style={styles.detailDownloadHint}>
                    Hợp đồng PDF đã bao gồm vị trí ký tên cho cả hai bên.
                  </Text>
                </View>
              ) : null}

              {/* Quick Actions Section */}
              {((shouldShowHandoverButton && onViewHandoverReports) || onViewSettlement || (canEndContract && onEndContract)) && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionHeading}>Thao tác</Text>

                  {/* Rental Expiry Warning */}
                  {canEndContract && daysUntilExpiry !== undefined && daysUntilExpiry <= 3 && (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: daysUntilExpiry <= 1 ? '#fef2f2' : '#fffbeb',
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 12,
                      gap: 10,
                    }}>
                      <Ionicons
                        name="time-outline"
                        size={20}
                        color={daysUntilExpiry <= 1 ? '#dc2626' : '#f59e0b'}
                      />
                      <Text style={{
                        flex: 1,
                        fontSize: 14,
                        color: daysUntilExpiry <= 1 ? '#b91c1c' : '#b45309',
                      }}>
                        {daysUntilExpiry <= 0
                          ? 'Đã hết hạn thuê'
                          : daysUntilExpiry === 1
                            ? 'Còn 1 ngày nữa hết hạn thuê'
                            : `Còn ${daysUntilExpiry} ngày nữa hết hạn`}
                      </Text>
                    </View>
                  )}

                  {/* Settlement Button - only show for IN_USE orders */}
                  {onViewSettlement && order.orderStatus === 'IN_USE' && (
                    <Pressable
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#f9fafb',
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 10,
                        gap: 12,
                      }}
                      onPress={onViewSettlement}
                    >
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#dcfce7',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Ionicons name="wallet-outline" size={20} color="#22c55e" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>
                          Quyết toán & Hoàn cọc
                        </Text>
                        <Text style={{ fontSize: 13, color: '#6b7280' }}>
                          Xem chi tiết quyết toán
                        </Text>
                      </View>
                      {hasPendingSettlement && (
                        <View style={{
                          backgroundColor: '#f59e0b',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 999,
                        }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>
                            Chờ xác nhận
                          </Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                    </Pressable>
                  )}



                  {/* Contract Annexes Section */}
                  {onSignAnnex && (
                    <AnnexesList
                      annexes={annexes || []}
                      isLoading={annexesLoading || false}
                      error={annexesError || null}
                      onSignAnnex={onSignAnnex}
                      onPayAnnex={onPayAnnex}
                    />
                  )}
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.orderDetailsState}>
              <Text style={styles.orderDetailsStateText}>Không có thông tin chi tiết.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
