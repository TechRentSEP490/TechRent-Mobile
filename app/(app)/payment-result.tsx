import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { fetchRentalOrderById } from '@/services/rental-orders';
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

type PaymentStatus = 'loading' | 'success' | 'cancelled' | 'failed';

type OrderInfo = {
    orderId: number;
    orderCode: string | null;
    totalAmount: number;
    deviceSummary: string | null;
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

    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('loading');
    const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
    const [isLoadingOrder, setIsLoadingOrder] = useState(false);

    // Determine payment result from query params
    const paymentResult = useMemo(() => {
        // Check VNPay response
        const vnpResponseCode = params.vnp_ResponseCode;
        if (vnpResponseCode !== undefined) {
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

        // Check explicit status param
        const statusParam = params.status;
        if (statusParam === 'success') return 'success';
        if (statusParam === 'cancel' || statusParam === 'cancelled') return 'cancelled';
        if (statusParam === 'failure' || statusParam === 'failed') return 'failed';

        // Default to failed if we can't determine
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

    // Set payment status after determining result
    useEffect(() => {
        const timer = setTimeout(() => {
            setPaymentStatus(paymentResult as PaymentStatus);
        }, 500); // Small delay for smooth transition

        return () => clearTimeout(timer);
    }, [paymentResult]);

    // Load order details if we have orderId
    useEffect(() => {
        if (!extractedOrderId || paymentStatus === 'loading') {
            return;
        }

        let isMounted = true;

        const loadOrderDetails = async () => {
            try {
                setIsLoadingOrder(true);
                const activeSession = session?.accessToken ? session : await ensureSession();

                if (!isMounted || !activeSession?.accessToken) {
                    return;
                }

                const order = await fetchRentalOrderById(activeSession, extractedOrderId);

                if (!isMounted) {
                    return;
                }

                const totalDue = (order.depositAmount || 0) + (order.totalPrice || 0);
                const deviceNames = order.orderDetails
                    ?.map((d) => d.deviceModelName)
                    .filter((name): name is string => Boolean(name))
                    .slice(0, 2);

                setOrderInfo({
                    orderId: extractedOrderId,
                    orderCode: extractedOrderCode,
                    totalAmount: extractedAmount ?? totalDue,
                    deviceSummary: deviceNames?.length ? deviceNames.join(', ') : null,
                });
            } catch (error) {
                console.warn('[PaymentResult] Failed to load order details:', error);
                // Still show result even if order loading fails
                setOrderInfo({
                    orderId: extractedOrderId,
                    orderCode: extractedOrderCode,
                    totalAmount: extractedAmount ?? 0,
                    deviceSummary: null,
                });
            } finally {
                if (isMounted) {
                    setIsLoadingOrder(false);
                }
            }
        };

        loadOrderDetails();

        return () => {
            isMounted = false;
        };
    }, [extractedOrderId, extractedOrderCode, extractedAmount, paymentStatus, session, ensureSession]);

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

    if (paymentStatus === 'loading') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#111111" />
                    <Text style={styles.loadingText}>Đang xử lý kết quả thanh toán...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const isSuccess = paymentStatus === 'success';
    const isCancelled = paymentStatus === 'cancelled';

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
