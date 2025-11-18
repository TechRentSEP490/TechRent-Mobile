import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { ContractResponse } from '@/services/contracts';
import type { RentalOrderResponse } from '@/services/rental-orders';
import styles from '@/style/orders.styles';
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
  deviceNameLookup: Record<string, string>;
  contract: ContractResponse | null;
  isDownloadingContract: boolean;
  onClose: () => void;
  onRetry: () => void;
  onDownloadContract?: () => void;
};

export default function OrderDetailsModal({
  visible,
  loading,
  error,
  order,
  deviceNameLookup,
  contract,
  isDownloadingContract,
  onClose,
  onRetry,
  onDownloadContract,
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
                    const deviceName =
                      deviceNameLookup[String(item.deviceModelId)] ?? `Device Model ${item.deviceModelId}`;
                    return (
                      <View key={item.orderDetailId} style={styles.detailItemRow}>
                        <View style={styles.detailItemHeader}>
                          <Text style={styles.detailItemName}>{deviceName}</Text>
                          <Text style={styles.detailItemQty}>×{item.quantity}</Text>
                        </View>
                        <Text style={styles.detailItemMeta}>Price / Day: {formatCurrency(item.pricePerDay)}</Text>
                        <Text style={styles.detailItemMeta}>
                          Deposit / Unit: {formatCurrency(item.depositAmountPerUnit)}
                        </Text>
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
                  <Text style={styles.detailDownloadHint}>
                    The contract PDF includes signature placeholders for both parties.
                  </Text>
                </View>
              ) : null}
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
