import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { getInvoiceByRentalOrderId, type Invoice } from '@/services/payments';
import { formatCurrency } from '@/utils/order-formatters';

// VNPay response codes
// 00 = Success
// 24 = User cancelled
// Other = Various errors
const VNPAY_SUCCESS_CODE = '00';

// PayOS response codes
// 00 = Success
// CANCELLED = Cancelled
const PAYOS_SUCCESS_CODE = '00';

// Retry configuration for waiting IPN callback
// Mobile needs longer delay than web because deep link redirects faster than browser
const RETRY_CONFIG = {
    maxRetries: 10,
    initialDelayMs: 3000,  // 3 seconds for mobile (vs 1.5s for web) - IPN takes time to reach backend
    maxDelayMs: 3000,
    backoffMultiplier: 1.2,
};

// Invoice statuses that indicate payment is complete (same as web)
const PAID_INVOICE_STATUSES = ['SUCCEEDED', 'COMPLETED', 'PAID'];

// Invoice statuses that indicate still processing
const PENDING_INVOICE_STATUSES = ['PENDING', 'PROCESSING', 'AWAITING_PAYMENT'];

type PaymentStatus = 'loading' | 'verifying' | 'success' | 'cancelled' | 'failed';

type OrderInfo = {
    orderId: number;
    orderCode: string | null;
    totalAmount: number;
    deviceSummary: string | null;
    invoiceStatus?: string;  // Changed from orderStatus to invoiceStatus
    paymentConfirmed: boolean;
};

export default function PaymentResultScreen() {
    const router = useRouter();
    const { session, ensureSession } = useAuth();
    const params = useLocalSearchParams<{
        // Common params
        status?: string;
        orderId?: string;
        orderCode?: string;
        // VNPay params
        vnp_ResponseCode?: string;
        vnp_Amount?: string;
        vnp_TxnRef?: string;
        vnp_OrderInfo?: string;
        vnp_TransactionStatus?: string;
        // PayOS params
        code?: string;
        cancel?: string;
        id?: string;
    }>();

    // DEBUG: Log all received params to understand what backend is sending
    useEffect(() => {
        console.log('[PaymentResult] 🔍 ALL RECEIVED PARAMS:', JSON.stringify(params, null, 2));
        console.log('[PaymentResult] 🔍 Raw params keys:', Object.keys(params));
    }, [params]);

    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('loading');
    const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
    const [isLoadingOrder, setIsLoadingOrder] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [statusMessage, setStatusMessage] = useState('Đang xử lý kết quả thanh toán...');
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, []);

    // Determine payment result from query params (VNPay/PayOS response)
    const paymentGatewayResult = useMemo(() => {
        console.log('[PaymentResult] 🔍 Determining payment result from params...');

        // Check VNPay response code (direct from VNPay or passed through backend)
        const vnpResponseCode = params.vnp_ResponseCode;
        if (vnpResponseCode !== undefined) {
            console.log('[PaymentResult] Found vnp_ResponseCode:', vnpResponseCode);
            if (vnpResponseCode === VNPAY_SUCCESS_CODE) {
                return 'success';
            }
            // VNPay code 24 = user cancelled
            if (vnpResponseCode === '24') {
                return 'cancelled';
            }
            return 'failed';
        }

        // Check PayOS response
        const payosCode = params.code;
        const payosCancel = params.cancel;

        if (payosCancel === 'true') {
            return 'cancelled';
        }

        if (payosCode !== undefined) {
            if (payosCode === PAYOS_SUCCESS_CODE) {
                return 'success';
            }
            return 'failed';
        }

        // Check explicit status param (from backend redirect)
        // Note: expo-router returns an array if param appears multiple times in URL
        const statusParamRaw = params.status;
        const statusParam = Array.isArray(statusParamRaw) ? statusParamRaw[0] : statusParamRaw;
        console.log('[PaymentResult] Checking status param:', statusParam);

        if (statusParam && typeof statusParam === 'string') {
            const lowerStatus = statusParam.toLowerCase();
            if (lowerStatus === 'success' || lowerStatus === 'succeeded' || lowerStatus === '00') {
                return 'success';
            }
            if (lowerStatus === 'cancel' || lowerStatus === 'cancelled') {
                return 'cancelled';
            }
            if (lowerStatus === 'failure' || lowerStatus === 'failed') {
                return 'failed';
            }
        }

        // Check VNPay transaction status (alternative param)
        const vnpTransactionStatus = params.vnp_TransactionStatus;
        if (vnpTransactionStatus === '00') {
            console.log('[PaymentResult] Found vnp_TransactionStatus=00, treating as success');
            return 'success';
        }

        // If we have orderId but no explicit failure indicators, 
        // treat as "verifying" - we'll check invoice status to confirm
        // This handles the case where backend redirects to frontendSuccessUrl
        // without explicit status params
        if (params.orderId) {
            console.log('[PaymentResult] Has orderId but no status params - will verify with invoice API');
            return 'success';  // Assume success since backend redirected to success URL
        }

        // Default to failed if we can't determine
        console.log('[PaymentResult] ⚠️ Could not determine status, defaulting to failed');
        return 'failed';
    }, [params]);

    // Extract order info from params
    const extractedOrderId = useMemo(() => {
        const orderId = params.orderId;
        if (orderId) {
            const parsed = parseInt(orderId, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        }
        return null;
    }, [params.orderId]);

    const extractedOrderCode = useMemo(() => {
        return params.orderCode ?? params.vnp_TxnRef ?? null;
    }, [params.orderCode, params.vnp_TxnRef]);

    const extractedAmount = useMemo(() => {
        // VNPay amount is in smallest unit (VND * 100)
        const vnpAmount = params.vnp_Amount;
        if (vnpAmount) {
            const parsed = parseInt(vnpAmount, 10);
            if (Number.isFinite(parsed)) {
                return parsed / 100; // Convert back to VND
            }
        }
        return null;
    }, [params.vnp_Amount]);

    // Check if invoice status indicates payment is confirmed
    const isPaymentConfirmedByStatus = useCallback((status: string | undefined): boolean => {
        if (!status) return false;
        const upperStatus = status.toUpperCase();
        return PAID_INVOICE_STATUSES.some((s) => upperStatus.includes(s));
    }, []);

    // Check if invoice status indicates still pending
    const isPaymentPendingByStatus = useCallback((status: string | undefined): boolean => {
        if (!status) return true; // Assume pending if no status
        const upperStatus = status.toUpperCase();
        return PENDING_INVOICE_STATUSES.some((s) => upperStatus.includes(s));
    }, []);

    // Load invoice with retry logic to wait for IPN callback (same logic as web)
    const loadInvoiceWithRetry = useCallback(
        async (orderId: number, currentRetry: number = 0) => {
            try {
                setRetryCount(currentRetry);
                setIsLoadingOrder(true);

                if (currentRetry === 0) {
                    setStatusMessage('Đang xác nhận thanh toán với hệ thống...');
                } else {
                    setStatusMessage(`Đang đồng bộ với cổng thanh toán (${currentRetry}/${RETRY_CONFIG.maxRetries})...`);
                }

                const activeSession = session?.accessToken ? session : await ensureSession();

                if (!activeSession?.accessToken) {
                    console.warn('[PaymentResult] No active session');
                    setPaymentStatus(paymentGatewayResult === 'success' ? 'success' : 'failed');
                    setIsLoadingOrder(false);
                    return;
                }

                // Fetch invoices for this order (same API as web)
                const invoices = await getInvoiceByRentalOrderId(activeSession, orderId);

                console.log('[PaymentResult] Invoice API response:', {
                    orderId,
                    invoicesCount: invoices.length,
                    retryCount: currentRetry,
                });

                // Find RENT_PAYMENT invoice with SUCCEEDED status first, then any RENT_PAYMENT
                let invoice: Invoice | null = null;
                if (invoices.length > 0) {
                    invoice =
                        invoices.find(
                            (inv) =>
                                String(inv.invoiceType || '').toUpperCase() === 'RENT_PAYMENT' &&
                                isPaymentConfirmedByStatus(inv.invoiceStatus)
                        ) ||
                        invoices.find(
                            (inv) => String(inv.invoiceType || '').toUpperCase() === 'RENT_PAYMENT'
                        ) ||
                        invoices[0];
                }

                if (invoice) {
                    const invoiceStatus = invoice.invoiceStatus;
                    const isConfirmed = isPaymentConfirmedByStatus(invoiceStatus);
                    const isPending = isPaymentPendingByStatus(invoiceStatus);

                    console.log('[PaymentResult] Invoice status check:', {
                        invoiceId: invoice.invoiceId,
                        invoiceStatus,
                        isConfirmed,
                        isPending,
                        retryCount: currentRetry,
                    });

                    const newOrderInfo: OrderInfo = {
                        orderId,
                        orderCode: extractedOrderCode,
                        totalAmount: extractedAmount ?? invoice.totalAmount ?? 0,
                        deviceSummary: null,
                        invoiceStatus,
                        paymentConfirmed: isConfirmed,
                    };

                    // If payment is confirmed, show success immediately
                    if (isConfirmed) {
                        console.log('[PaymentResult] ✅ Payment confirmed as SUCCEEDED');
                        setOrderInfo(newOrderInfo);
                        setPaymentStatus('success');
                        setIsLoadingOrder(false);
                        return;
                    }

                    // If still pending and we have retries left, wait and retry
                    if (isPending && currentRetry < RETRY_CONFIG.maxRetries && paymentGatewayResult === 'success') {
                        const delay = Math.min(
                            RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, currentRetry),
                            RETRY_CONFIG.maxDelayMs
                        );

                        console.log(`[PaymentResult] ⏳ Invoice still ${invoiceStatus}, retrying in ${delay}ms...`);

                        retryTimeoutRef.current = setTimeout(() => {
                            loadInvoiceWithRetry(orderId, currentRetry + 1);
                        }, delay);
                        return;
                    }

                    // Max retries reached - show success based on VNPay response
                    console.log('[PaymentResult] Max retries reached. Showing success based on gateway response.');
                    setOrderInfo(newOrderInfo);
                    if (paymentGatewayResult === 'success') {
                        setPaymentStatus('success');
                    } else {
                        setPaymentStatus(paymentGatewayResult as PaymentStatus);
                    }
                    setIsLoadingOrder(false);
                } else {
                    // No invoice found - retry if possible
                    if (currentRetry < RETRY_CONFIG.maxRetries && paymentGatewayResult === 'success') {
                        const delay = Math.min(
                            RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, currentRetry),
                            RETRY_CONFIG.maxDelayMs
                        );

                        console.log(`[PaymentResult] ⏳ No invoice found, retrying in ${delay}ms...`);

                        retryTimeoutRef.current = setTimeout(() => {
                            loadInvoiceWithRetry(orderId, currentRetry + 1);
                        }, delay);
                        return;
                    }

                    console.warn('[PaymentResult] ❌ No invoice found after max retries');
                    setOrderInfo({
                        orderId,
                        orderCode: extractedOrderCode,
                        totalAmount: extractedAmount ?? 0,
                        deviceSummary: null,
                        paymentConfirmed: false,
                    });
                    setPaymentStatus(paymentGatewayResult === 'success' ? 'success' : 'failed');
                    setIsLoadingOrder(false);
                }
            } catch (error) {
                console.warn('[PaymentResult] Failed to load invoice:', error);

                // Retry on error if we have retries left
                if (currentRetry < RETRY_CONFIG.maxRetries && paymentGatewayResult === 'success') {
                    const delay = Math.min(
                        RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, currentRetry),
                        RETRY_CONFIG.maxDelayMs
                    );

                    console.log(`[PaymentResult] ⏳ Error occurred, retrying in ${delay}ms...`);

                    retryTimeoutRef.current = setTimeout(() => {
                        loadInvoiceWithRetry(orderId, currentRetry + 1);
                    }, delay);
                    return;
                }

                // Fallback: show status based on gateway response
                setOrderInfo({
                    orderId,
                    orderCode: extractedOrderCode,
                    totalAmount: extractedAmount ?? 0,
                    deviceSummary: null,
                    paymentConfirmed: false,
                });
                setPaymentStatus(paymentGatewayResult === 'success' ? 'success' : 'failed');
                setIsLoadingOrder(false);
            }
        },
        [session, ensureSession, extractedOrderCode, extractedAmount, paymentGatewayResult, isPaymentConfirmedByStatus, isPaymentPendingByStatus]
    );

    // Main effect to process payment result
    useEffect(() => {
        // If payment gateway says failure/cancelled, show immediately
        if (paymentGatewayResult !== 'success') {
            setPaymentStatus(paymentGatewayResult as PaymentStatus);

            // For failed payments, just set basic info without API call
            if (extractedOrderId) {
                setOrderInfo({
                    orderId: extractedOrderId,
                    orderCode: extractedOrderCode,
                    totalAmount: extractedAmount ?? 0,
                    deviceSummary: null,
                    paymentConfirmed: false,
                });
            }
            return;
        }

        // Payment gateway says success - verify with backend via invoice API
        setPaymentStatus('verifying');

        if (extractedOrderId) {
            // Add initial delay to give IPN callback time to reach backend
            const initialDelay = RETRY_CONFIG.initialDelayMs;
            console.log(`[PaymentResult] Waiting ${initialDelay}ms for IPN callback...`);

            retryTimeoutRef.current = setTimeout(() => {
                loadInvoiceWithRetry(extractedOrderId, 0);
            }, initialDelay);
        } else {
            // No order ID - just show success based on gateway response
            setPaymentStatus('success');
        }

        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, [paymentGatewayResult, extractedOrderId, extractedOrderCode, extractedAmount, loadInvoiceWithRetry]);

    const handleGoHome = () => {
        router.replace('/(app)/(tabs)/home');
    };

    const handleViewOrders = () => {
        if (extractedOrderId) {
            router.replace({
                pathname: '/(app)/(tabs)/orders',
                params: { orderId: String(extractedOrderId) },
            });
        } else {
            router.replace('/(app)/(tabs)/orders');
        }
    };

    const handleRetryPayment = () => {
        if (extractedOrderId) {
            router.replace({
                pathname: '/(app)/(tabs)/orders',
                params: { flow: 'continue', orderId: String(extractedOrderId) },
            });
        } else {
            router.replace('/(app)/(tabs)/orders');
        }
    };

    // Loading/Verifying state
    if (paymentStatus === 'loading' || paymentStatus === 'verifying') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#111111" />
                    <Text style={styles.loadingText}>{statusMessage}</Text>
                    {retryCount > 0 && (
                        <Text style={styles.loadingSubtext}>
                            Đang đồng bộ với cổng thanh toán...
                        </Text>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    const isSuccess = paymentStatus === 'success';
    const isCancelled = paymentStatus === 'cancelled';
    const paymentConfirmedByBackend = orderInfo?.paymentConfirmed ?? false;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Status Icon */}
                <View style={[styles.iconWrapper, isSuccess ? styles.iconSuccess : styles.iconError]}>
                    <Ionicons
                        name={isSuccess ? 'checkmark-circle' : isCancelled ? 'close-circle' : 'alert-circle'}
                        size={72}
                        color={isSuccess ? '#22c55e' : '#ef4444'}
                    />
                </View>

                {/* Title */}
                <Text style={styles.title}>
                    {isSuccess
                        ? 'Thanh toán thành công!'
                        : isCancelled
                            ? 'Thanh toán đã bị hủy'
                            : 'Thanh toán thất bại'}
                </Text>

                {/* Order Info Card */}
                {(orderInfo || extractedOrderCode) && (
                    <View style={styles.infoCard}>
                        {(orderInfo?.orderCode || extractedOrderCode) && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Mã đơn hàng</Text>
                                <Text style={styles.infoValue}>#{orderInfo?.orderCode || extractedOrderCode}</Text>
                            </View>
                        )}
                        {orderInfo?.orderId && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Order ID</Text>
                                <Text style={styles.infoValue}>#{orderInfo.orderId}</Text>
                            </View>
                        )}
                        {orderInfo?.totalAmount ? (
                            <View style={[styles.infoRow, styles.infoRowHighlight]}>
                                <Text style={styles.infoLabel}>Tổng tiền</Text>
                                <Text style={[styles.infoValue, isSuccess && styles.successAmount]}>
                                    {formatCurrency(orderInfo.totalAmount)}
                                </Text>
                            </View>
                        ) : null}
                        {orderInfo?.deviceSummary && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Thiết bị</Text>
                                <Text style={styles.infoValue}>{orderInfo.deviceSummary}</Text>
                            </View>
                        )}
                        {isLoadingOrder && (
                            <View style={styles.loadingOrderRow}>
                                <ActivityIndicator size="small" color="#6b7280" />
                                <Text style={styles.loadingOrderText}>Đang tải thông tin...</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Status Message */}
                <Text style={styles.subtitle}>
                    {isSuccess
                        ? 'Cảm ơn bạn đã thanh toán! Đơn thuê của bạn đang được xử lý.'
                        : isCancelled
                            ? 'Bạn đã hủy quá trình thanh toán. Đơn hàng vẫn được giữ nguyên và bạn có thể thanh toán lại.'
                            : 'Đã xảy ra lỗi trong quá trình thanh toán. Vui lòng thử lại.'}
                </Text>

                {/* Action Buttons */}
                <View style={styles.actions}>
                    <Pressable style={styles.primaryButton} onPress={handleViewOrders}>
                        <Ionicons name="receipt-outline" size={20} color="#ffffff" />
                        <Text style={styles.primaryButtonText}>Xem đơn hàng</Text>
                    </Pressable>

                    {!isSuccess && (
                        <Pressable style={styles.secondaryButton} onPress={handleRetryPayment}>
                            <Ionicons name="refresh-outline" size={20} color="#111111" />
                            <Text style={styles.secondaryButtonText}>Thử lại</Text>
                        </Pressable>
                    )}

                    <Pressable style={styles.tertiaryButton} onPress={handleGoHome}>
                        <Text style={styles.tertiaryButtonText}>Về trang chủ</Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: '#6b7280',
    },
    loadingSubtext: {
        fontSize: 13,
        color: '#9ca3af',
        marginTop: 4,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
    },
    iconWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    iconSuccess: {
        backgroundColor: '#dcfce7',
    },
    iconError: {
        backgroundColor: '#fee2e2',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111111',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 320,
    },
    infoCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoRowHighlight: {
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    infoLabel: {
        fontSize: 14,
        color: '#6b7280',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111111',
    },
    successAmount: {
        fontSize: 18,
        color: '#22c55e',
    },
    loadingOrderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingTop: 8,
    },
    loadingOrderText: {
        fontSize: 13,
        color: '#6b7280',
    },
    actions: {
        width: '100%',
        maxWidth: 320,
        gap: 12,
        marginTop: 12,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#111111',
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderWidth: 1,
        borderColor: '#d1d5db',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111111',
    },
    tertiaryButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    tertiaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f7df4',
    },
});
