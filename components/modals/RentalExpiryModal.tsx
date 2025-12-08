/**
 * RentalExpiryModal
 * Shows when rental is about to expire (1 day before endDate)
 * Allows customer to confirm return / end contract
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type RentalExpiryModalProps = {
    visible: boolean;
    orderId: number;
    orderDisplayId: string;
    endDate: string;
    daysRemaining: number;
    onConfirmReturn: () => Promise<void>;
    onClose: () => void;
};

export default function RentalExpiryModal({
    visible,
    orderId,
    orderDisplayId,
    endDate,
    daysRemaining,
    onConfirmReturn,
    onClose,
}: RentalExpiryModalProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return dateString;
        }
    };

    const handleConfirmReturn = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            await onConfirmReturn();
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể xác nhận kết thúc hợp đồng';
            setError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    const getRemainingText = () => {
        if (daysRemaining < 0) return 'Đã quá hạn';
        if (daysRemaining === 0) return 'Hết hạn hôm nay';
        if (daysRemaining === 1) return 'Còn 1 ngày';
        return `Còn ${daysRemaining} ngày`;
    };

    const getAlertColor = () => {
        if (daysRemaining <= 0) return '#dc2626';
        if (daysRemaining === 1) return '#f59e0b';
        return '#3b82f6';
    };

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

                        <View style={styles.infoBox}>
                            <Ionicons name="information-circle-outline" size={20} color="#3b82f6" />
                            <Text style={styles.infoText}>
                                Khi bạn xác nhận kết thúc hợp đồng, nhân viên sẽ liên hệ để thu hồi thiết bị và tiến hành quyết toán hoàn cọc.
                            </Text>
                        </View>

                        {error && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <Pressable
                            style={styles.secondaryButton}
                            onPress={onClose}
                            disabled={isProcessing}
                        >
                            <Text style={styles.secondaryButtonText}>Để sau</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.primaryButton, isProcessing && styles.primaryButtonDisabled]}
                            onPress={handleConfirmReturn}
                            disabled={isProcessing}
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
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    primaryButton: {
        flex: 1,
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
});
