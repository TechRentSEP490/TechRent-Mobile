/**
 * RentalExpiryModal
 * Shows when rental is about to expire (1 day before endDate)
 * Allows customer to confirm return / end contract
 * Shows success/thank you view after confirmation
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type RentalExpiryModalProps = {
    visible: boolean;
    orderId: number;
    orderDisplayId: string;
    endDate: string;
    startDate?: string;
    daysRemaining: number;
    isConfirmed?: boolean; // Whether this order was already confirmed for return
    hasPendingExtension?: boolean; // Has a pending extension request
    hasAnyAnnex?: boolean; // Has annex that needs signing
    canExtend?: boolean; // Whether extend action is allowed
    onConfirmReturn: () => Promise<void>;
    onRequestExtend?: () => void; // Opens extend modal
    onClose: () => void;
};

/**
 * RentalExpiryModal - Modal kết thúc hợp đồng thuê
 * 
 * Chức năng:
 * 1. Hiển thị thông tin hết hạn thuê (ngày hết hạn, số ngày còn lại)
 * 2. Cho phép khách xác nhận kết thúc hợp đồng
 * 3. Sau khi xác nhận, hiển thị màn hình cảm ơn với các bước tiếp theo
 */
export default function RentalExpiryModal({
    visible,
    orderId,
    orderDisplayId,
    endDate,
    startDate,
    daysRemaining,
    isConfirmed = false, // Đã xác nhận trước đó chưa (lưu trong AsyncStorage)
    hasPendingExtension = false,
    hasAnyAnnex = false,
    canExtend = true,
    onConfirmReturn,
    onRequestExtend,
    onClose,
}: RentalExpiryModalProps) {
    // ========== STATE MANAGEMENT ==========
    // Trạng thái đang gọi API xác nhận
    const [isProcessing, setIsProcessing] = useState(false);
    // Lỗi khi xác nhận (nếu có)
    const [error, setError] = useState<string | null>(null);
    // Hiển thị màn hình thành công/cảm ơn
    const [showSuccessView, setShowSuccessView] = useState(false);

    /**
     * useEffect: Reset trạng thái khi modal đóng
     * 
     * Logic: Khi modal đóng (visible = false), reset:
     * - showSuccessView = false (ẩn màn hình thành công)
     * - error = null (xóa lỗi cũ)
     * 
     * Mục đích: Đảm bảo lần mở tiếp theo modal ở trạng thái sạch
     */
    useEffect(() => {
        if (!visible) {
            setShowSuccessView(false);
            setError(null);
        }
    }, [visible]);

    /**
     * useEffect: Hiển thị màn hình thành công nếu đã xác nhận trước đó
     * 
     * Logic: Khi modal mở (visible = true) VÀ đơn đã được xác nhận (isConfirmed = true)
     * → Tự động chuyển sang màn hình thành công
     * 
     * Mục đích: Nếu khách đã xác nhận trước đó, không cần hiện lại form xác nhận
     */
    useEffect(() => {
        if (visible && isConfirmed) {
            setShowSuccessView(true);
        }
    }, [visible, isConfirmed]);

    /**
     * Format ngày sang định dạng Việt Nam (DD/MM/YYYY)
     * Có try-catch để tránh crash khi chuỗi ngày không hợp lệ
     */
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            // Fallback: trả về chuỗi gốc nếu không parse được
            return dateString;
        }
    };

    /**
     * PHÉP TÍNH: Tính số ngày thuê tổng cộng
     * 
     * Công thức:
     * 1. Lấy timestamp của ngày bắt đầu và kết thúc
     * 2. Tính hiệu số (milliseconds)
     * 3. Chia cho số ms trong 1 ngày (1000 * 60 * 60 * 24)
     * 4. Làm tròn lên (Math.ceil) để đảm bảo đủ ngày
     * 
     * Ví dụ: 15/01 - 20/01 → 5 ngày
     */
    const calculateRentalDays = () => {
        // Validation: Cả 2 ngày phải có giá trị
        if (!startDate || !endDate) return null;
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            // Math.abs để đảm bảo kết quả luôn dương
            const diffTime = Math.abs(end.getTime() - start.getTime());
            // Chuyển từ ms sang ngày, làm tròn lên
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        } catch {
            return null;
        }
    };

    /**
     * Xử lý xác nhận kết thúc hợp đồng
     * 
     * Flow:
     * 1. Set trạng thái đang xử lý
     * 2. Gọi API qua callback onConfirmReturn()
     * 3. Thành công → Hiển thị màn hình cảm ơn (không đóng modal)
     * 4. Lỗi → Hiển thị thông báo lỗi
     */
    const handleConfirmReturn = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            await onConfirmReturn();
            // Không đóng modal, mà chuyển sang màn hình thành công
            setShowSuccessView(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể xác nhận kết thúc hợp đồng';
            setError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * LOGIC HIỂN THỊ: Xác định text số ngày còn lại
     * 
     * Các trường hợp:
     * - daysRemaining < 0: "Đã quá hạn" (đã trễ deadline)
     * - daysRemaining = 0: "Hết hạn hôm nay"
     * - daysRemaining = 1: "Còn 1 ngày" (không dùng "ngày" số nhiều)
     * - daysRemaining > 1: "Còn X ngày"
     */
    const getRemainingText = () => {
        if (daysRemaining < 0) return 'Đã quá hạn';
        if (daysRemaining === 0) return 'Hết hạn hôm nay';
        if (daysRemaining === 1) return 'Còn 1 ngày';
        return `Còn ${daysRemaining} ngày`;
    };

    /**
     * LOGIC HIỂN THỊ: Xác định màu sắc theo mức độ khẩn cấp
     * 
     * Quy tắc:
     * - daysRemaining <= 0: Đỏ (#dc2626) - QUÁ HẠN hoặc hết hạn hôm nay
     * - daysRemaining = 1: Cam (#f59e0b) - CẢNH BÁO, còn 1 ngày
     * - daysRemaining > 1: Xanh (#3b82f6) - BÌNH THƯỜNG/THÔNG TIN
     */
    const getAlertColor = () => {
        if (daysRemaining <= 0) return '#dc2626'; // Đỏ - Khẩn cấp
        if (daysRemaining === 1) return '#f59e0b'; // Cam - Cảnh báo
        return '#3b82f6'; // Xanh - Thông tin
    };

    // ========== CONDITIONAL RENDERING ==========

    /**
     * Màn hình thành công/cảm ơn
     * Hiển thị khi: showSuccessView = true (sau khi xác nhận hoặc đã xác nhận trước)
     */
    if (showSuccessView) {
        const rentalDays = calculateRentalDays();

        return (
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={onClose}
            >
                <View style={styles.overlay}>
                    <View style={styles.card}>
                        {/* Success Header */}
                        <View style={styles.header}>
                            <View style={[styles.iconCircle, { backgroundColor: '#dcfce7' }]}>
                                <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                            </View>
                            <Text style={styles.title}>Cảm ơn bạn!</Text>
                            <Pressable style={styles.closeButton} onPress={onClose}>
                                <Ionicons name="close" size={24} color="#6b7280" />
                            </Pressable>
                        </View>

                        {/* Success Content */}
                        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                            <View style={styles.successMessage}>
                                <Text style={styles.successText}>
                                    Chúng tôi đã nhận được xác nhận trả hàng của bạn cho đơn hàng{' '}
                                    <Text style={styles.successOrderId}>#{orderDisplayId}</Text>
                                </Text>
                            </View>

                            {/* Order Info */}
                            <View style={styles.infoCard}>
                                <Text style={styles.infoCardTitle}>Thông tin đơn hàng</Text>
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Mã đơn hàng</Text>
                                    <Text style={styles.infoValue}>#{orderDisplayId}</Text>
                                </View>
                                {startDate && (
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Ngày bắt đầu thuê</Text>
                                        <Text style={styles.infoValue}>{formatDate(startDate)}</Text>
                                    </View>
                                )}
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Ngày kết thúc thuê</Text>
                                    <Text style={styles.infoValue}>{formatDate(endDate)}</Text>
                                </View>
                                {rentalDays && (
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Số ngày thuê</Text>
                                        <Text style={styles.infoValue}>{rentalDays} ngày</Text>
                                    </View>
                                )}
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Trạng thái</Text>
                                    <View style={styles.statusBadge}>
                                        <Text style={styles.statusText}>Đã xác nhận trả hàng</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Next Steps */}
                            <View style={styles.nextStepsCard}>
                                <Text style={styles.nextStepsTitle}>Những việc tiếp theo</Text>
                                <View style={styles.stepItem}>
                                    <View style={styles.stepBullet}>
                                        <Ionicons name="cube-outline" size={18} color="#3b82f6" />
                                    </View>
                                    <Text style={styles.stepText}>
                                        Vui lòng chuẩn bị thiết bị và tất cả phụ kiện đi kèm để bàn giao
                                    </Text>
                                </View>
                                <View style={styles.stepItem}>
                                    <View style={styles.stepBullet}>
                                        <Ionicons name="shield-checkmark-outline" size={18} color="#3b82f6" />
                                    </View>
                                    <Text style={styles.stepText}>
                                        Đảm bảo thiết bị được đóng gói cẩn thận và an toàn
                                    </Text>
                                </View>
                                <View style={styles.stepItem}>
                                    <View style={styles.stepBullet}>
                                        <Ionicons name="document-text-outline" size={18} color="#3b82f6" />
                                    </View>
                                    <Text style={styles.stepText}>
                                        Kiểm tra lại danh sách thiết bị và phụ kiện theo hợp đồng trước khi bàn giao
                                    </Text>
                                </View>
                            </View>
                        </ScrollView>

                        {/* Close Button */}
                        <View style={styles.actions}>
                            <Pressable style={styles.primaryButton} onPress={onClose}>
                                <Ionicons name="checkmark" size={20} color="#ffffff" />
                                <Text style={styles.primaryButtonText}>Đã hiểu</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    // Confirmation View (default)
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={[styles.iconCircle, { backgroundColor: getAlertColor() + '20' }]}>
                            <Ionicons name="time-outline" size={32} color={getAlertColor()} />
                        </View>
                        <Text style={styles.title}>Sắp hết hạn thuê</Text>
                        <Pressable style={styles.closeButton} onPress={onClose}>
                            <Ionicons name="close" size={24} color="#6b7280" />
                        </Pressable>
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        <View style={styles.orderInfo}>
                            <Text style={styles.orderLabel}>Đơn hàng</Text>
                            <Text style={styles.orderId}>#{orderDisplayId}</Text>
                        </View>

                        <View style={styles.dateInfo}>
                            <View style={styles.dateRow}>
                                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                                <Text style={styles.dateLabel}>Ngày hết hạn:</Text>
                                <Text style={styles.dateValue}>{formatDate(endDate)}</Text>
                            </View>
                            <View style={[styles.remainingBadge, { backgroundColor: getAlertColor() + '20' }]}>
                                <Text style={[styles.remainingText, { color: getAlertColor() }]}>
                                    {getRemainingText()}
                                </Text>
                            </View>
                        </View>

                        {/* Status Cards */}
                        {hasPendingExtension && (
                            <View style={styles.pendingBox}>
                                <Ionicons name="hourglass-outline" size={20} color="#f59e0b" />
                                <Text style={styles.pendingText}>
                                    Đang có yêu cầu gia hạn đang xử lý. Vui lòng đợi phản hồi từ hệ thống.
                                </Text>
                            </View>
                        )}

                        {hasAnyAnnex && !hasPendingExtension && (
                            <View style={styles.annexBox}>
                                <Ionicons name="document-text-outline" size={20} color="#8b5cf6" />
                                <Text style={styles.annexText}>
                                    Bạn có phụ lục gia hạn cần ký. Vui lòng ký phụ lục trước khi thực hiện thao tác khác.
                                </Text>
                            </View>
                        )}

                        {!hasPendingExtension && !hasAnyAnnex && (
                            <View style={styles.infoBox}>
                                <Ionicons name="information-circle-outline" size={20} color="#3b82f6" />
                                <Text style={styles.infoText}>
                                    Khi bạn xác nhận kết thúc hợp đồng, nhân viên sẽ liên hệ để thu hồi thiết bị và tiến hành quyết toán hoàn cọc.
                                </Text>
                            </View>
                        )}

                        {error && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}
                    </View>

                    {/* Actions */}
                    <View style={styles.actionsVertical}>
                        {/* Extend Button - Only show if extend is allowed and callback provided */}
                        {canExtend && onRequestExtend && !hasPendingExtension && !hasAnyAnnex && (
                            <Pressable
                                style={styles.extendButton}
                                onPress={onRequestExtend}
                                disabled={isProcessing}
                            >
                                <Ionicons name="calendar-outline" size={20} color="#3b82f6" />
                                <Text style={styles.extendButtonText}>Yêu cầu gia hạn</Text>
                            </Pressable>
                        )}

                        <Pressable
                            style={[
                                styles.primaryButtonFull,
                                (isProcessing || hasPendingExtension || hasAnyAnnex) && styles.primaryButtonDisabled
                            ]}
                            onPress={handleConfirmReturn}
                            disabled={isProcessing || hasPendingExtension || hasAnyAnnex}
                        >
                            {isProcessing ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                                    <Text style={styles.primaryButtonText}>Kết thúc hợp đồng</Text>
                                </>
                            )}
                        </Pressable>

                        <Pressable
                            style={styles.secondaryButtonFull}
                            onPress={onClose}
                            disabled={isProcessing}
                        >
                            <Text style={styles.secondaryButtonText}>Để sau</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        overflow: 'hidden',
    },
    header: {
        alignItems: 'center',
        paddingTop: 24,
        paddingHorizontal: 24,
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
    },
    content: {
        padding: 24,
        gap: 16,
    },
    orderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    orderLabel: {
        fontSize: 15,
        color: '#6b7280',
    },
    orderId: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    dateInfo: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 16,
        gap: 12,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateLabel: {
        fontSize: 14,
        color: '#6b7280',
    },
    dateValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    remainingBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
    },
    remainingText: {
        fontSize: 14,
        fontWeight: '600',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        padding: 14,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#1e40af',
        lineHeight: 20,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#fef2f2',
        borderRadius: 12,
        padding: 14,
    },
    errorText: {
        flex: 1,
        fontSize: 14,
        color: '#dc2626',
        lineHeight: 20,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        padding: 24,
        paddingTop: 0,
    },
    secondaryButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonFull: {
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    primaryButton: {
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#111827',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonFull: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#111827',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
    // Success view styles
    scrollContent: {
        maxHeight: 400,
        paddingHorizontal: 24,
        paddingBottom: 8,
    },
    successMessage: {
        marginBottom: 16,
    },
    successText: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 22,
        textAlign: 'center',
    },
    successOrderId: {
        fontWeight: '700',
        color: '#111827',
    },
    infoCard: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        gap: 12,
    },
    infoCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    infoLabel: {
        fontSize: 14,
        color: '#6b7280',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    statusBadge: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#16a34a',
    },
    nextStepsCard: {
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        gap: 12,
    },
    nextStepsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e40af',
        marginBottom: 4,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    stepBullet: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#dbeafe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepText: {
        flex: 1,
        fontSize: 14,
        color: '#1e40af',
        lineHeight: 20,
    },
    // Pending extension status styles
    pendingBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#fef3c7',
        borderRadius: 12,
        padding: 14,
    },
    pendingText: {
        flex: 1,
        fontSize: 14,
        color: '#b45309',
        lineHeight: 20,
    },
    // Annex status styles
    annexBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#f3e8ff',
        borderRadius: 12,
        padding: 14,
    },
    annexText: {
        flex: 1,
        fontSize: 14,
        color: '#7c3aed',
        lineHeight: 20,
    },
    // Vertical actions container
    actionsVertical: {
        padding: 24,
        paddingTop: 0,
        gap: 12,
    },
    // Extend button
    extendButton: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#3b82f6',
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    extendButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#3b82f6',
    },
});
