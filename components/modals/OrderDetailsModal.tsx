import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { ContractResponse } from '@/services/contracts';
import type { RentalOrderResponse } from '@/services/rental-orders';
import styles from '@/style/orders.styles';
import type { DeviceLookupEntry } from '@/types/orders';
import {
  formatContractStatus,
  formatCurrency,
  formatDateTime,
  formatRentalPeriod,
  toTitleCase,
} from '@/utils/order-formatters';

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
  // New props for handover/settlement features
  onViewHandoverReports?: () => void;
  onViewSettlement?: () => void;
  onEndContract?: () => void;
  hasUnsignedHandover?: boolean;
  hasPendingSettlement?: boolean;
  canEndContract?: boolean;
  daysUntilExpiry?: number;
  shouldShowHandoverButton?: boolean; // Explicitly control handover button visibility
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
}: OrderDetailsModalProps) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.orderDetailsCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Order Details</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color="#111" />
            </Pressable>
          </View>
          {loading ? (
            <View style={styles.orderDetailsState}>
              <ActivityIndicator color="#111111" />
              <Text style={styles.orderDetailsStateText}>Loading order details…</Text>
            </View>
          ) : error ? (
            <View style={styles.orderDetailsState}>
              <Text style={[styles.orderDetailsStateText, styles.orderDetailsErrorText]}>{error}</Text>
              <Pressable style={styles.contractRetryButton} onPress={onRetry}>
                <Text style={styles.contractRetryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : order ? (
            <ScrollView style={styles.orderDetailsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>Summary</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Order ID</Text>
                  <Text style={styles.detailValue}>#{order.orderId}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={styles.detailValue}>{toTitleCase(order.orderStatus)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Created</Text>
                  <Text style={styles.detailValue}>{formatDateTime(order.createdAt)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Rental Period</Text>
                  <Text style={styles.detailValue}>
                    {formatRentalPeriod(order.startDate, order.endDate)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Shipping Address</Text>
                  <Text style={[styles.detailValue, styles.detailValueMultiline]}>
                    {order.shippingAddress || '—'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>Payment</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Due</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(order.totalPrice + order.depositAmount)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Price</Text>
                  <Text style={styles.detailValue}>{formatCurrency(order.totalPrice)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Price / Day</Text>
                  <Text style={styles.detailValue}>{formatCurrency(order.pricePerDay)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Deposit Due</Text>
                  <Text style={styles.detailValue}>{formatCurrency(order.depositAmount)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Deposit Held</Text>
                  <Text style={styles.detailValue}>{formatCurrency(order.depositAmountHeld)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Deposit Used</Text>
                  <Text style={styles.detailValue}>{formatCurrency(order.depositAmountUsed)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Deposit Refunded</Text>
                  <Text style={styles.detailValue}>{formatCurrency(order.depositAmountRefunded)}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>Items</Text>
                {order.orderDetails && order.orderDetails.length > 0 ? (
                  order.orderDetails.map((item) => {
                    const details = deviceDetailsLookup[String(item.deviceModelId)];
                    const deviceName = details?.name ?? `Device Model ${item.deviceModelId}`;
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
                              Price / Day: {formatCurrency(item.pricePerDay)}
                            </Text>
                            <Text style={styles.detailItemMeta}>
                              Deposit / Unit: {formatCurrency(item.depositAmountPerUnit)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.detailEmptyText}>No devices were found for this rental.</Text>
                )}
              </View>

              {contract ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionHeading}>Contract</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text style={styles.detailValue}>{formatContractStatus(contract.status)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Contract Number</Text>
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
                        <Text style={styles.detailDownloadLabel}>Download Contract</Text>
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
                        Handover Document
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
                            Pending
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                  <Text style={styles.detailDownloadHint}>
                    The contract PDF includes signature placeholders for both parties.
                  </Text>
                </View>
              ) : null}

              {/* Quick Actions Section */}
              {((shouldShowHandoverButton && onViewHandoverReports) || onViewSettlement || (canEndContract && onEndContract)) && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionHeading}>Actions</Text>

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

                  {/* Settlement Button */}
                  {onViewSettlement && (
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

                  {/* End Contract Button */}
                  {canEndContract && onEndContract && (
                    <Pressable
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#111827',
                        borderRadius: 12,
                        padding: 14,
                        gap: 12,
                      }}
                      onPress={onEndContract}
                    >
                      <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                        Kết thúc hợp đồng
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.orderDetailsState}>
              <Text style={styles.orderDetailsStateText}>No additional details are available.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
