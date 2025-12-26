/**
 * Orders Screen
 * Displays rental orders with filtering, details, contract signing, and payment
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import ContractPdfDownloader from '@/components/ContractPdfDownloader';
import HandoverPdfDownloader from '@/components/HandoverPdfDownloader';
import EmailEditorModal from '@/components/modals/EmailEditorModal';
import ExtendRentalModal from '@/components/modals/ExtendRentalModal';
import HandoverReportsModal from '@/components/modals/HandoverReportsModal';
import HandoverSignModal from '@/components/modals/HandoverSignModal';
import OrderDetailsModal from '@/components/modals/OrderDetailsModal';
import OrderStepsModal from '@/components/modals/OrderStepsModal';
import PaymentModal from '@/components/modals/PaymentModal';
import RentalExpiryModal from '@/components/modals/RentalExpiryModal';
import RentalOrderStepsContent from '@/components/modals/RentalOrderStepsContent';
import SettlementModal from '@/components/modals/SettlementModal';
import { OrderCard, OrdersEmptyState, OrdersHeader } from '@/components/orders';
import { useContractSigning } from '@/hooks/use-contract-signing';
import { useOrderDetails } from '@/hooks/use-order-details';
import { useOrdersData } from '@/hooks/use-orders-data';
import { usePaymentFlow } from '@/hooks/use-payment-flow';
import type { ConditionDefinitionResponse } from '@/services/conditions';
import { getConditionDefinitions } from '@/services/conditions';
import {
  fetchHandoverReportsByOrderId,
  sendHandoverReportPin,
  signHandoverReport,
} from '@/services/handover-reports';
import type { PaymentMethod } from '@/services/payments';
import {
  confirmReturnRentalOrder,
  extendRentalOrder,
} from '@/services/rental-orders';
import {
  fetchSettlementByOrderId,
  respondSettlement,
} from '@/services/settlements';
import {
  getConfirmedReturnOrders,
  saveConfirmedReturnOrder,
} from '@/storage/confirmed-returns';
import { useAuth } from '@/stores/auth-store';
import styles from '@/style/orders.styles';
import type { HandoverReport } from '@/types/handover-reports';
import type { OrderCard as OrderCardType } from '@/types/orders';
import type { Settlement } from '@/types/settlements';
import { ITEMS_PER_PAGE, PAYMENT_OPTIONS } from '@/utils/order-utils';

export default function OrdersScreen() {
  const router = useRouter();
  const { session, ensureSession, user } = useAuth();
  const { flow, orderId: routeOrderId } = useLocalSearchParams<{
    flow?: string | string[];
    orderId?: string | string[];
  }>();

  const defaultVerificationEmail = useMemo(() => user?.email?.trim() ?? '', [user?.email]);

  // Custom Hooks
  const ordersData = useOrdersData();
  const orderDetails = useOrderDetails();
  const contractSigning = useContractSigning(defaultVerificationEmail);
  const paymentFlow = usePaymentFlow();

  // Handover PDF Downloader ref
  const handoverPdfDownloaderRef = useRef<((report: HandoverReport) => Promise<void>) | null>(null);

  // Handover Reports State
  const [isHandoverModalVisible, setHandoverModalVisible] = useState(false);
  const [handoverReports, setHandoverReports] = useState<HandoverReport[]>([]);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [conditionDefinitions, setConditionDefinitions] = useState<ConditionDefinitionResponse[]>([]);
  const [isHandoverSignModalVisible, setHandoverSignModalVisible] = useState(false);
  const [activeHandoverReport, setActiveHandoverReport] = useState<HandoverReport | null>(null);

  // Settlement State
  const [isSettlementModalVisible, setSettlementModalVisible] = useState(false);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);

  // End Contract / Rental Expiry State
  const [isRentalExpiryModalVisible, setRentalExpiryModalVisible] = useState(false);
  const [expiringOrder, setExpiringOrder] = useState<OrderCardType | null>(null);
  const [confirmedReturnOrders, setConfirmedReturnOrders] = useState<Set<number>>(new Set());

  // Extend Rental State
  const [isExtendModalVisible, setExtendModalVisible] = useState(false);
  const [processingExtend, setProcessingExtend] = useState(false);

  // Load confirmed return orders on mount
  useEffect(() => {
    const loadConfirmedReturns = async () => {
      try {
        const confirmed = await getConfirmedReturnOrders();
        setConfirmedReturnOrders(confirmed);
      } catch (error) {
        console.error('[Orders] Failed to load confirmed returns:', error);
      }
    };
    loadConfirmedReturns();
  }, []);

  // Computed values
  const isReturnConfirmed = useCallback(
    (orderId: number) => confirmedReturnOrders.has(orderId),
    [confirmedReturnOrders],
  );

  const daysUntilExpiry = useMemo(() => {
    if (!orderDetails.orderData?.endDate) return undefined;
    const endDate = new Date(orderDetails.orderData.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    const diffTime = endDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [orderDetails.orderData?.endDate]);

  const canEndContract = useMemo(() => {
    return orderDetails.orderData?.orderStatus === 'IN_USE';
  }, [orderDetails.orderData?.orderStatus]);

  const shouldShowHandoverButton = useMemo(() => {
    const status = orderDetails.orderData?.orderStatus?.toUpperCase();
    return ['DELIVERING', 'RESCHEDULED', 'DELIVERY_CONFIRMED', 'IN_USE', 'COMPLETED'].includes(status || '');
  }, [orderDetails.orderData?.orderStatus]);

  const hasUnsignedHandover = useMemo(() => {
    return handoverReports.some((r) => r.staffSigned && !r.customerSigned);
  }, [handoverReports]);

  const hasPendingSettlement = useMemo(() => {
    return settlement?.state === 'AWAITING_RESPONSE';
  }, [settlement?.state]);

  const contractForSelectedOrder = useMemo(
    () =>
      orderDetails.targetOrderId
        ? ordersData.contractsByOrderId[String(orderDetails.targetOrderId)] ?? null
        : null,
    [ordersData.contractsByOrderId, orderDetails.targetOrderId],
  );

  // Handover handlers
  const loadHandoverReports = useCallback(
    async (orderId: number) => {
      if (!session?.accessToken) return;
      setHandoverLoading(true);
      setHandoverError(null);
      try {
        const [reports, conditions] = await Promise.all([
          fetchHandoverReportsByOrderId(session, orderId),
          getConditionDefinitions(session).catch(() => []),
        ]);
        setHandoverReports(reports);
        setConditionDefinitions(conditions);
      } catch (err) {
        setHandoverError(err instanceof Error ? err.message : 'Không thể tải biên bản bàn giao');
      } finally {
        setHandoverLoading(false);
      }
    },
    [session],
  );

  const handleOpenHandoverReports = useCallback(() => {
    if (orderDetails.targetOrderId) {
      loadHandoverReports(orderDetails.targetOrderId);
      setHandoverModalVisible(true);
    }
  }, [orderDetails.targetOrderId, loadHandoverReports]);

  const handleCloseHandoverReports = useCallback(() => {
    setHandoverModalVisible(false);
  }, []);

  const handleOpenHandoverSign = useCallback((report: HandoverReport) => {
    setActiveHandoverReport(report);
    setHandoverSignModalVisible(true);
  }, []);

  const handleCloseHandoverSign = useCallback(() => {
    setHandoverSignModalVisible(false);
    setActiveHandoverReport(null);
  }, []);

  const handleSendHandoverPin = useCallback(
    async (email: string) => {
      if (!session?.accessToken || !activeHandoverReport) return;
      await sendHandoverReportPin(session, activeHandoverReport.handoverReportId, { email });
    },
    [session, activeHandoverReport],
  );

  const handleSignHandover = useCallback(
    async (pinCode: string, signature: string) => {
      if (!session?.accessToken || !activeHandoverReport) return;
      await signHandoverReport(session, activeHandoverReport.handoverReportId, {
        pinCode,
        customerSignature: signature,
      });
      if (orderDetails.targetOrderId) {
        loadHandoverReports(orderDetails.targetOrderId);
      }
      handleCloseHandoverSign();
    },
    [session, activeHandoverReport, orderDetails.targetOrderId, loadHandoverReports, handleCloseHandoverSign],
  );

  // Settlement handlers
  const loadSettlement = useCallback(
    async (orderId: number) => {
      if (!session?.accessToken) return;
      setSettlementLoading(true);
      setSettlementError(null);
      try {
        const data = await fetchSettlementByOrderId(session, orderId);
        setSettlement(data);
      } catch (err) {
        setSettlementError(err instanceof Error ? err.message : 'Không thể tải thông tin quyết toán');
      } finally {
        setSettlementLoading(false);
      }
    },
    [session],
  );

  const handleOpenSettlement = useCallback(() => {
    if (orderDetails.targetOrderId) {
      loadSettlement(orderDetails.targetOrderId);
      setSettlementModalVisible(true);
    }
  }, [orderDetails.targetOrderId, loadSettlement]);

  const handleCloseSettlement = useCallback(() => {
    setSettlementModalVisible(false);
  }, []);

  const handleAcceptSettlement = useCallback(async () => {
    if (!session?.accessToken || !settlement) return;
    await respondSettlement(session, settlement.settlementId, true);
    if (orderDetails.targetOrderId) loadSettlement(orderDetails.targetOrderId);
  }, [session, settlement, orderDetails.targetOrderId, loadSettlement]);

  const handleRejectSettlement = useCallback(
    async (reason?: string) => {
      if (!session?.accessToken || !settlement) return;
      await respondSettlement(session, settlement.settlementId, false, reason);
      if (orderDetails.targetOrderId) loadSettlement(orderDetails.targetOrderId);
    },
    [session, settlement, orderDetails.targetOrderId, loadSettlement],
  );

  // End contract handlers
  const handleOpenEndContract = useCallback(() => {
    if (orderDetails.orderData && orderDetails.targetOrderId) {
      const orderCard = ordersData.orders.find((o) => o.orderId === orderDetails.targetOrderId);
      if (orderCard) {
        setExpiringOrder(orderCard);
        setRentalExpiryModalVisible(true);
      }
    }
  }, [orderDetails.orderData, orderDetails.targetOrderId, ordersData.orders]);

  const handleCloseEndContract = useCallback(() => {
    setRentalExpiryModalVisible(false);
    setExpiringOrder(null);
  }, []);

  const handleConfirmReturn = useCallback(async () => {
    if (!session?.accessToken || !expiringOrder) return;
    try {
      await confirmReturnRentalOrder(session, expiringOrder.orderId);
      await saveConfirmedReturnOrder(expiringOrder.orderId);
      setConfirmedReturnOrders((prev) => {
        const newSet = new Set(prev);
        newSet.add(expiringOrder.orderId);
        return newSet;
      });
      ordersData.loadOrders('refresh');
    } catch (error) {
      console.error('[Orders] Error confirming return:', error);
      throw error;
    }
  }, [session, expiringOrder, ordersData]);

  // Extend rental handlers
  const handleOpenExtendModal = useCallback(() => {
    setRentalExpiryModalVisible(false);
    setExtendModalVisible(true);
  }, []);

  const handleCloseExtendModal = useCallback(() => {
    setExtendModalVisible(false);
  }, []);

  const handleExtendRequest = useCallback(
    async (newEndDate: string) => {
      if (!session?.accessToken || !expiringOrder) {
        throw new Error('Không có thông tin đơn hàng để gia hạn.');
      }
      try {
        setProcessingExtend(true);
        await extendRentalOrder(session, expiringOrder.orderId, newEndDate);
        setExtendModalVisible(false);
        setExpiringOrder(null);
        ordersData.loadOrders('refresh');
      } catch (error) {
        throw error;
      } finally {
        setProcessingExtend(false);
      }
    },
    [session, expiringOrder, ordersData],
  );

  // Card actions
  const handleCardAction = useCallback(
    (order: OrderCardType) => {
      if (!order.action) return;

      switch (order.action.type) {
        case 'continueProcess':
          contractSigning.openFlow(order, ordersData.contractsByOrderId);
          break;
        case 'completeKyc':
          router.push('/(app)/kyc-documents');
          break;
        case 'extendRental':
          Alert.alert('Extend Rental', 'Our team will reach out to help extend this rental.');
          break;
        case 'confirmReceipt':
          Alert.alert('Receipt Confirmed', 'Thanks for confirming delivery.');
          break;
        case 'cancelOrder':
          Alert.alert('Cancel Order', 'Your cancellation request has been submitted.');
          break;
        case 'rentAgain':
          Alert.alert('Rent Again', "We'll move this device to your cart.");
          break;
        default:
          break;
      }
    },
    [contractSigning, ordersData.contractsByOrderId, router],
  );

  const handleQuickPaymentStart = useCallback(
    (order: OrderCardType, method: PaymentMethod) => {
      paymentFlow.setSelectedPayment(method);
      contractSigning.openFlow(order, ordersData.contractsByOrderId);
    },
    [contractSigning, ordersData.contractsByOrderId, paymentFlow],
  );

  const handleViewDetails = useCallback(
    (order: OrderCardType) => {
      orderDetails.openDetails(order.orderId);
    },
    [orderDetails],
  );

  // Handle flow param for deep linking
  useEffect(() => {
    const flowParam = Array.isArray(flow) ? flow[0] : flow;
    if (flowParam !== 'continue') return;

    const orderIdParam = Array.isArray(routeOrderId) ? routeOrderId[0] : routeOrderId;
    const targetOrder =
      ordersData.orders.find((order) => order.id === orderIdParam) ||
      ordersData.orders.find(
        (order) => order.action?.type === 'continueProcess' || order.action?.type === 'completeKyc',
      );

    if (targetOrder) {
      ordersData.setSelectedFilter(targetOrder.statusFilter);
      ordersData.setHighlightedOrderId(targetOrder.id);
    }

    if (ordersData.orders.length > 0) {
      router.replace('/(app)/(tabs)/orders');
    }
  }, [flow, routeOrderId, ordersData, router]);

  // Render loading overlay for payment WebView
  const renderPaymentLoading = useCallback(
    () => (
      <View style={styles.paymentWebViewLoadingOverlay}>
        <ActivityIndicator size="large" color="#111111" />
        <Text style={styles.paymentModalPlaceholderText}>Loading checkout…</Text>
      </View>
    ),
    [],
  );

  return (
    <ContractPdfDownloader ensureSession={ensureSession} session={session}>
      {({ downloadContract, downloadingContractId }) => {
        const isSelectedContractDownloading = Boolean(
          contractForSelectedOrder?.contractId &&
          downloadingContractId === contractForSelectedOrder.contractId,
        );
        const isActiveContractDownloading = Boolean(
          contractSigning.activeContract?.contractId &&
          downloadingContractId === contractSigning.activeContract.contractId,
        );

        return (
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <FlatList
              ref={ordersData.listRef}
              data={ordersData.displayedOrders}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshing={ordersData.isRefreshing}
              onRefresh={ordersData.handleRefresh}
              removeClippedSubviews={true}
              maxToRenderPerBatch={5}
              windowSize={5}
              updateCellsBatchingPeriod={50}
              initialNumToRender={5}
              getItemLayout={(_, index) => ({
                length: 200,
                offset: 200 * index,
                index,
              })}
              ListFooterComponent={
                ordersData.hasMoreToShow ? (
                  <Pressable
                    onPress={ordersData.handleLoadMore}
                    style={{
                      paddingVertical: 16,
                      paddingHorizontal: 24,
                      marginHorizontal: 16,
                      marginBottom: 16,
                      backgroundColor: '#f3f4f6',
                      borderRadius: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#111', fontSize: 14, fontWeight: '600' }}>
                      Load More ({ordersData.filteredOrders.length - ordersData.displayedOrders.length} remaining)
                    </Text>
                  </Pressable>
                ) : ordersData.filteredOrders.length > ITEMS_PER_PAGE ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <Text style={{ color: '#9ca3af', fontSize: 13 }}>All orders loaded</Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <OrderCard
                  item={item}
                  isHighlighted={ordersData.highlightedOrderId === item.id}
                  onViewDetails={() => handleViewDetails(item)}
                  onAction={() => handleCardAction(item)}
                  onQuickPay={(method) => handleQuickPaymentStart(item, method)}
                  onExpiryAction={() => {
                    setExpiringOrder(item);
                    setRentalExpiryModalVisible(true);
                  }}
                />
              )}
              ListHeaderComponent={() => (
                <OrdersHeader
                  selectedFilter={ordersData.selectedFilter}
                  onFilterChange={ordersData.setSelectedFilter}
                  errorMessage={ordersData.errorMessage}
                  ordersCount={ordersData.orders.length}
                  onRetry={ordersData.handleRetry}
                  searchQuery={ordersData.searchQuery}
                  onSearchChange={ordersData.setSearchQuery}
                  onSearch={ordersData.searchOrders}
                  isSearching={ordersData.isSearching}
                  onClearSearch={ordersData.clearSearch}
                  isSearchActive={ordersData.isSearchActive}
                  isSearchExpanded={ordersData.isSearchExpanded}
                  onToggleSearchExpanded={ordersData.setSearchExpanded}
                />
              )}
              ListEmptyComponent={() => (
                <OrdersEmptyState
                  isLoading={ordersData.isLoading}
                  errorMessage={ordersData.errorMessage}
                  onRetry={ordersData.handleRetry}
                />
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />

            {/* Contract Signing Modal */}
            <OrderStepsModal
              visible={contractSigning.isModalVisible}
              onClose={contractSigning.resetFlow}
              currentStep={contractSigning.currentStep}
              progressWidth={contractSigning.progressWidth}
            >
              <RentalOrderStepsContent
                currentStep={contractSigning.currentStep}
                activeOrder={contractSigning.activeOrder}
                activeContract={contractSigning.activeContract}
                isContractAlreadySigned={contractSigning.isContractAlreadySigned}
                isContractLoading={contractSigning.isContractLoading}
                contractErrorMessage={contractSigning.contractErrorMessage}
                onRetryContract={contractSigning.retryContract}
                isDownloadingActiveContract={isActiveContractDownloading}
                onDownloadContract={() =>
                  downloadContract(contractSigning.activeContract, contractSigning.activeOrder?.title)
                }
                hasAgreed={contractSigning.hasAgreed}
                onToggleAgreement={contractSigning.handleToggleAgreement}
                isAgreementComplete={contractSigning.isAgreementComplete}
                isSendingPin={contractSigning.isSendingPin}
                onAgreementContinue={contractSigning.handleAgreementContinue}
                onResetFlow={contractSigning.resetFlow}
                verificationEmail={contractSigning.verificationEmail}
                otpDigits={contractSigning.otpDigits}
                otpRefs={contractSigning.otpRefs}
                onOtpChange={contractSigning.handleOtpChange}
                onOtpKeyPress={contractSigning.handleOtpKeyPress}
                verificationError={contractSigning.verificationError}
                onResendCode={contractSigning.handleResendCode}
                isOtpComplete={contractSigning.isOtpComplete}
                onVerifyCode={contractSigning.handleVerifyCode}
                isSigningContract={contractSigning.isSigningContract}
                onOpenEmailEditor={contractSigning.handleOpenEmailEditor}
                onGoBack={contractSigning.goToPreviousStep}
                paymentOptions={PAYMENT_OPTIONS}
                selectedPayment={paymentFlow.selectedPayment}
                onSelectPayment={paymentFlow.handleSelectPayment}
                paymentError={paymentFlow.paymentError}
                onCreatePayment={() =>
                  contractSigning.activeOrder && paymentFlow.handleCreatePayment(contractSigning.activeOrder)
                }
                isCreatingPayment={paymentFlow.isCreatingPayment}
              />
            </OrderStepsModal>

            {/* Email Editor Modal */}
            <EmailEditorModal
              visible={contractSigning.isEmailEditorVisible}
              value={contractSigning.pendingEmailInput}
              error={contractSigning.emailEditorError}
              onChangeText={(value) => {
                contractSigning.setPendingEmailInput(value);
                if (contractSigning.emailEditorError) {
                  contractSigning.setEmailEditorError(null);
                }
              }}
              onCancel={contractSigning.handleCloseEmailEditor}
              onSave={contractSigning.handleSaveEmail}
            />

            {/* Order Details Modal */}
            <OrderDetailsModal
              visible={orderDetails.isVisible}
              loading={orderDetails.isLoading}
              error={orderDetails.error}
              order={orderDetails.orderData}
              deviceDetailsLookup={ordersData.deviceDetailsLookup}
              contract={contractForSelectedOrder}
              isDownloadingContract={isSelectedContractDownloading}
              onClose={orderDetails.closeDetails}
              onRetry={orderDetails.retry}
              onDownloadContract={
                contractForSelectedOrder
                  ? () =>
                    downloadContract(
                      contractForSelectedOrder,
                      orderDetails.orderData ? `Order #${orderDetails.orderData.orderId}` : undefined,
                    )
                  : undefined
              }
              onViewHandoverReports={handleOpenHandoverReports}
              onViewSettlement={handleOpenSettlement}
              onEndContract={canEndContract ? handleOpenEndContract : undefined}
              hasUnsignedHandover={hasUnsignedHandover}
              hasPendingSettlement={hasPendingSettlement}
              canEndContract={canEndContract}
              daysUntilExpiry={daysUntilExpiry}
              shouldShowHandoverButton={shouldShowHandoverButton}
              invoices={orderDetails.invoices}
              invoicesLoading={orderDetails.invoicesLoading}
              settlement={orderDetails.settlement}
            />

            {/* Handover Reports Modal */}
            <HandoverPdfDownloader conditionDefinitions={conditionDefinitions}>
              {({ downloadHandoverReport }) => {
                handoverPdfDownloaderRef.current = downloadHandoverReport;
                return (
                  <HandoverReportsModal
                    visible={isHandoverModalVisible}
                    reports={handoverReports}
                    loading={handoverLoading}
                    error={handoverError}
                    onClose={handleCloseHandoverReports}
                    onViewReport={downloadHandoverReport}
                    onSignReport={handleOpenHandoverSign}
                    onRefresh={() =>
                      orderDetails.targetOrderId && loadHandoverReports(orderDetails.targetOrderId)
                    }
                  />
                );
              }}
            </HandoverPdfDownloader>

            {/* Handover Sign Modal */}
            <HandoverSignModal
              visible={isHandoverSignModalVisible}
              report={activeHandoverReport}
              userEmail={user?.email ?? ''}
              onClose={handleCloseHandoverSign}
              onSendPin={handleSendHandoverPin}
              onSign={handleSignHandover}
            />

            {/* Settlement Modal */}
            <SettlementModal
              visible={isSettlementModalVisible}
              settlement={settlement}
              loading={settlementLoading}
              error={settlementError}
              onClose={handleCloseSettlement}
              onAccept={handleAcceptSettlement}
              onReject={handleRejectSettlement}
              onRefresh={() => orderDetails.targetOrderId && loadSettlement(orderDetails.targetOrderId)}
            />

            {/* Rental Expiry Modal */}
            <RentalExpiryModal
              visible={isRentalExpiryModalVisible}
              orderId={expiringOrder?.orderId ?? 0}
              orderDisplayId={String(expiringOrder?.orderId ?? '')}
              startDate={expiringOrder?.planStartDate ?? ''}
              endDate={expiringOrder?.planEndDate ?? ''}
              daysRemaining={daysUntilExpiry ?? 0}
              isConfirmed={expiringOrder ? isReturnConfirmed(expiringOrder.orderId) : false}
              canExtend={true}
              onConfirmReturn={handleConfirmReturn}
              onRequestExtend={handleOpenExtendModal}
              onClose={handleCloseEndContract}
            />

            {/* Extend Rental Modal */}
            <ExtendRentalModal
              visible={isExtendModalVisible}
              orderId={expiringOrder?.orderId ?? 0}
              orderDisplayId={String(expiringOrder?.orderId ?? '')}
              currentEndDate={expiringOrder?.planEndDate ?? ''}
              startDate={expiringOrder?.planStartDate ?? ''}
              onExtend={handleExtendRequest}
              onClose={handleCloseExtendModal}
            />

            {/* Payment Modal */}
            <PaymentModal
              visible={paymentFlow.isPaymentModalVisible}
              title={paymentFlow.paymentModalTitle}
              onClose={paymentFlow.handleClosePaymentModal}
              canOpenInBrowser={Boolean(paymentFlow.paymentCheckoutUrl)}
              onOpenInBrowser={
                paymentFlow.paymentCheckoutUrl ? paymentFlow.handleOpenPaymentInBrowser : undefined
              }
              errorMessage={paymentFlow.paymentModalError}
            >
              {paymentFlow.paymentCheckoutUrl ? (
                <View style={styles.paymentWebViewContainer}>
                  <WebView
                    key={`payment-webview-${paymentFlow.paymentWebViewKey}`}
                    source={{ uri: paymentFlow.paymentCheckoutUrl }}
                    javaScriptEnabled
                    domStorageEnabled
                    cacheEnabled={false}
                    sharedCookiesEnabled
                    setSupportMultipleWindows={false}
                    originWhitelist={['https://*', 'http://*']}
                    mixedContentMode="always"
                    onLoadStart={paymentFlow.handlePaymentWebViewLoadStart}
                    onLoadEnd={paymentFlow.handlePaymentWebViewLoadEnd}
                    onError={paymentFlow.handlePaymentWebViewError}
                    onHttpError={paymentFlow.handlePaymentWebViewHttpError}
                    style={styles.paymentWebView}
                  />
                  {paymentFlow.isPaymentWebViewLoading ? renderPaymentLoading() : null}
                </View>
              ) : (
                <View style={styles.paymentModalPlaceholder}>
                  <Ionicons name="warning-outline" size={24} color="#6b7280" />
                  <Text style={styles.paymentModalPlaceholderText}>
                    The payment link is unavailable. Close this screen and try again.
                  </Text>
                </View>
              )}
            </PaymentModal>
          </SafeAreaView>
        );
      }}
    </ContractPdfDownloader>
  );
}
