/**
 * SettlementModal
 * Displays settlement details and allows accept/reject
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Settlement } from '@/types/settlements';
import { SETTLEMENT_STATUS_MAP, splitSettlementAmounts } from '@/types/settlements';

type SettlementModalProps = {
    visible: boolean;
    settlement: Settlement | null;
    loading: boolean;
    error: string | null;
    onClose: () => void;
    onAccept: () => Promise<void>;
    onReject: (reason?: string) => Promise<void>;
    onRefresh: () => void;
};

export default function SettlementModal({
    visible,
    settlement,
    loading,
    error,
    onClose,
    onAccept,
    onReject,
    onRefresh,
}: SettlementModalProps) {
    // ========== STATE MANAGEMENT ==========
    // Trạng thái xử lý: đang gọi API hay không
    const [isProcessing, setIsProcessing] = useState(false);
    // Lỗi khi thực hiện action (chấp nhận/từ chối)
    const [actionError, setActionError] = useState<string | null>(null);
    // Hiển thị form nhập lý do từ chối hay không
    const [showRejectForm, setShowRejectForm] = useState(false);
    // Lý do từ chối do người dùng nhập
    const [rejectReason, setRejectReason] = useState('');

    /**
     * Format số tiền sang định dạng VND
     * Sử dụng Intl.NumberFormat với locale 'vi-VN'
     */
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
        }).format(amount);
    };

    /**
     * Xử lý chấp nhận quyết toán
     * 1. Set trạng thái đang xử lý (hiển thị loading)
     * 2. Gọi API qua callback onAccept()
     * 3. Nếu thành công: đóng modal
     * 4. Nếu lỗi: hiển thị thông báo lỗi
     */
    const handleAccept = async () => {
        setIsProcessing(true);
        setActionError(null);
        try {
            await onAccept();
            onClose(); // Đóng modal sau khi thành công
        } catch (err) {
            // Lấy message từ Error object hoặc dùng message mặc định
            const message = err instanceof Error ? err.message : 'Không thể chấp nhận quyết toán';
            setActionError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Xử lý từ chối quyết toán
     * 
     * VALIDATION: Bắt buộc phải nhập lý do từ chối
     * - Nếu rỗng hoặc chỉ có khoảng trắng → báo lỗi, không gọi API
     */
    const handleReject = async () => {
        // Validation: Kiểm tra lý do từ chối không được rỗng
        if (!rejectReason.trim()) {
            setActionError('Vui lòng nhập lý do từ chối');
            return; // Dừng, không gọi API
        }

        setIsProcessing(true);
        setActionError(null);
        try {
            await onReject(rejectReason); // Gửi lý do kèm theo
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể từ chối quyết toán';
            setActionError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * ĐIỀU KIỆN LOGIC: Kiểm tra khách có thể phản hồi quyết toán không
     * 
     * Cho phép phản hồi khi:
     * - settlement tồn tại (không null)
     * - Trạng thái KHÔNG nằm trong danh sách đã xử lý xong
     * 
     * Các trạng thái cho phép phản hồi: DRAFT, PENDING, AWAITING_CUSTOMER, SUBMITTED, AWAITING_RESPONSE, etc.
     * Các trạng thái KHÔNG cho phép: ISSUED, REJECTED, CANCELLED, CLOSED
     * 
     * Logic này phù hợp với phiên bản web (MyOrderSettlementTab.jsx)
     */
    const FINALIZED_STATES = ['ISSUED', 'REJECTED', 'CANCELLED', 'CLOSED'];
    const normalizedState = settlement?.state?.toUpperCase() ?? '';
    const canRespond = settlement !== null && !FINALIZED_STATES.includes(normalizedState);

    const renderContent = () => {
        // ========== CÁC TRẠNG THÁI HIỂN THỊ ==========

        // Trạng thái: Đang tải
        if (loading) {
            return (
                <View style={styles.loadingState}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Đang tải thông tin quyết toán...</Text>
                </View>
            );
        }

        // Trạng thái: Lỗi khi tải
        if (error) {
            return (
                <View style={styles.errorState}>
                    <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
                    <Text style={styles.errorTitle}>Không thể tải quyết toán</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable style={styles.retryButton} onPress={onRefresh}>
                        <Ionicons name="refresh-outline" size={18} color="#ffffff" />
                        <Text style={styles.retryButtonText}>Thử lại</Text>
                    </Pressable>
                </View>
            );
        }

        // Trạng thái: Chưa có quyết toán
        // Xảy ra khi đơn hàng chưa hoàn tất quy trình thu hồi
        if (!settlement) {
            return (
                <View style={styles.emptyState}>
                    <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>Chưa có quyết toán</Text>
                    <Text style={styles.emptySubtitle}>
                        Quyết toán sẽ được tạo sau khi thu hồi thiết bị
                    </Text>
                </View>
            );
        }

        // ========== LOGIC XỬ LÝ DỮ LIỆU QUYẾT TOÁN ==========

        /**
         * Normalize state to uppercase for consistent comparison
         * API may return "Draft", "Awaiting_Response" etc. but we need "DRAFT", "AWAITING_RESPONSE"
         */
        const normalizedState = settlement.state?.toUpperCase() as keyof typeof SETTLEMENT_STATUS_MAP;

        /**
         * Lấy thông tin hiển thị cho trạng thái
         * - label: Nhãn tiếng Việt
         * - color: Màu sắc badge
         * Fallback về giá trị mặc định nếu trạng thái không có trong map
         */
        const statusMeta = SETTLEMENT_STATUS_MAP[normalizedState] || {
            label: settlement.state,
            color: '#6b7280',
        };

        /**
         * PHÉP TÍNH QUAN TRỌNG: Tách số tiền quyết toán
         * 
         * Input: settlement.finalReturnAmount (có thể âm hoặc dương)
         * Output:
         * - refundAmount: Số tiền khách được HOÀN (khi finalAmount > 0)
         * - customerDueAmount: Số tiền khách phải TRẢ THÊM (khi finalAmount < 0)
         * - netAmount: Giá trị gốc, dùng để xác định hiển thị "được hoàn" hay "phải trả"
         */
        const { refundAmount, customerDueAmount, netAmount } = splitSettlementAmounts(
            settlement.finalReturnAmount
        );

        /**
         * Kiểm tra có phí phát sinh không
         * Nếu có bất kỳ phí nào > 0, hiển thị section "Các khoản phí"
         */
        const hasFees = settlement.damageFee > 0 || settlement.lateFee > 0 || settlement.accessoryFee > 0;

        return (
            <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
                {/* Status Badge */}
                <View style={styles.statusSection}>
                    <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + '20' }]}>
                        {/* Icon thay đổi theo trạng thái:
                            - ISSUED/CLOSED: checkmark (thành công)
                            - REJECTED: close (thất bại)  
                            - Còn lại: time (đang chờ) */}
                        <Ionicons
                            name={
                                settlement.state === 'ISSUED' || settlement.state === 'CLOSED'
                                    ? 'checkmark-circle-outline'
                                    : settlement.state === 'REJECTED'
                                        ? 'close-circle-outline'
                                        : 'time-outline'
                            }
                            size={16}
                            color={statusMeta.color}
                        />
                        <Text style={[styles.statusText, { color: statusMeta.color }]}>
                            {statusMeta.label}
                        </Text>
                    </View>
                </View>

                {/* Deposit Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tiền cọc</Text>
                    <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>Tiền cọc đã đặt</Text>
                        <Text style={styles.amountValue}>{formatCurrency(settlement.totalDeposit)}</Text>
                    </View>
                </View>

                {/* Fees Section */}
                {hasFees && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Các khoản phí</Text>
                        {settlement.damageFee > 0 && (
                            <View style={styles.feeRow}>
                                <View style={styles.feeIcon}>
                                    <Ionicons name="construct-outline" size={16} color="#ef4444" />
                                </View>
                                <Text style={styles.feeLabel}>Phí hư hỏng thiết bị</Text>
                                <Text style={styles.feeValue}>-{formatCurrency(settlement.damageFee)}</Text>
                            </View>
                        )}
                        {settlement.lateFee > 0 && (
                            <View style={styles.feeRow}>
                                <View style={styles.feeIcon}>
                                    <Ionicons name="time-outline" size={16} color="#f59e0b" />
                                </View>
                                <Text style={styles.feeLabel}>Phí trả trễ</Text>
                                <Text style={styles.feeValue}>-{formatCurrency(settlement.lateFee)}</Text>
                            </View>
                        )}
                        {settlement.accessoryFee > 0 && (
                            <View style={styles.feeRow}>
                                <View style={styles.feeIcon}>
                                    <Ionicons name="cube-outline" size={16} color="#6366f1" />
                                </View>
                                <Text style={styles.feeLabel}>Phí phụ kiện thiếu</Text>
                                <Text style={styles.feeValue}>-{formatCurrency(settlement.accessoryFee)}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Final Amount */}
                <View style={styles.totalSection}>
                    <Text style={styles.totalLabel}>
                        {netAmount >= 0 ? 'Số tiền được hoàn' : 'Số tiền cần thanh toán'}
                    </Text>
                    <Text style={[
                        styles.totalValue,
                        netAmount >= 0 ? styles.totalPositive : styles.totalNegative
                    ]}>
                        {formatCurrency(Math.abs(netAmount))}
                    </Text>
                    {netAmount >= 0 && (
                        <Text style={styles.totalNote}>
                            Tiền sẽ được hoàn vào tài khoản sau khi xác nhận
                        </Text>
                    )}
                </View>

                {/* Staff Notes */}
                {settlement.staffNote && (
                    <View style={styles.noteSection}>
                        <Text style={styles.noteTitle}>Ghi chú từ nhân viên</Text>
                        <Text style={styles.noteText}>{settlement.staffNote}</Text>
                    </View>
                )}

                {actionError && (
                    <View style={styles.actionErrorBox}>
                        <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
                        <Text style={styles.actionErrorText}>{actionError}</Text>
                    </View>
                )}

                {/* Reject Form */}
                {showRejectForm && (
                    <View style={styles.rejectForm}>
                        <Text style={styles.rejectFormLabel}>Lý do từ chối</Text>
                        <TextInput
                            style={styles.rejectInput}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            placeholder="Nhập lý do từ chối quyết toán..."
                            placeholderTextColor="#9ca3af"
                            multiline
                            numberOfLines={3}
                        />
                        <View style={styles.rejectActions}>
                            <Pressable
                                style={styles.rejectCancelButton}
                                onPress={() => {
                                    setShowRejectForm(false);
                                    setRejectReason('');
                                    setActionError(null);
                                }}
                                disabled={isProcessing}
                            >
                                <Text style={styles.rejectCancelText}>Hủy</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.rejectConfirmButton, isProcessing && styles.buttonDisabled]}
                                onPress={handleReject}
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator color="#ffffff" size="small" />
                                ) : (
                                    <Text style={styles.rejectConfirmText}>Gửi từ chối</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                )}

                {/* Action Buttons */}
                {canRespond && !showRejectForm && (
                    <View style={styles.actions}>
                        <Pressable
                            style={styles.rejectButton}
                            onPress={() => setShowRejectForm(true)}
                            disabled={isProcessing}
                        >
                            <Ionicons name="close-circle-outline" size={20} color="#dc2626" />
                            <Text style={styles.rejectButtonText}>Từ chối</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.acceptButton, isProcessing && styles.buttonDisabled]}
                            onPress={handleAccept}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                                    <Text style={styles.acceptButtonText}>Chấp nhận</Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                )}
            </ScrollView>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Quyết toán & Hoàn cọc</Text>
                    <Pressable style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close" size={24} color="#374151" />
                    </Pressable>
                </View>

                {renderContent()}
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentScroll: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
        gap: 20,
    },
    statusSection: {
        alignItems: 'center',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    section: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        gap: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    amountLabel: {
        fontSize: 15,
        color: '#374151',
    },
    amountValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    feeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    feeIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    feeLabel: {
        flex: 1,
        fontSize: 15,
        color: '#374151',
    },
    feeValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ef4444',
    },
    totalSection: {
        backgroundColor: '#111827',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        gap: 8,
    },
    totalLabel: {
        fontSize: 14,
        color: '#9ca3af',
    },
    totalValue: {
        fontSize: 28,
        fontWeight: '700',
    },
    totalPositive: {
        color: '#22c55e',
    },
    totalNegative: {
        color: '#ef4444',
    },
    totalNote: {
        fontSize: 13,
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 4,
    },
    noteSection: {
        backgroundColor: '#fffbeb',
        borderRadius: 12,
        padding: 14,
        gap: 6,
    },
    noteTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#b45309',
        textTransform: 'uppercase',
    },
    noteText: {
        fontSize: 14,
        color: '#92400e',
        lineHeight: 20,
    },
    actionErrorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#fef2f2',
        borderRadius: 10,
        padding: 12,
    },
    actionErrorText: {
        flex: 1,
        fontSize: 14,
        color: '#dc2626',
    },
    rejectForm: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        gap: 12,
    },
    rejectFormLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    rejectInput: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        color: '#111827',
        minHeight: 80,
        textAlignVertical: 'top',
    },
    rejectActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    rejectCancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center',
    },
    rejectCancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    rejectConfirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#ef4444',
        alignItems: 'center',
    },
    rejectConfirmText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    rejectButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fecaca',
        backgroundColor: '#fef2f2',
    },
    rejectButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#dc2626',
    },
    acceptButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#22c55e',
    },
    acceptButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    loadingState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 15,
        color: '#6b7280',
    },
    errorState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 8,
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginTop: 12,
    },
    errorText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#3b82f6',
        marginTop: 16,
    },
    retryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
        marginBottom: 4,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
    },
});
