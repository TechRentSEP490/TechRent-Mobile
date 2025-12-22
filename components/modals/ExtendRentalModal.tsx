/**
 * ExtendRentalModal
 * Modal for extending rental order with date picker
 * Uses a simple date selection UI compatible with Expo Go
 */

import { diffDays, formatRemainingDaysText, getDaysRemaining } from '@/utils/dates';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

type ExtendRentalModalProps = {
    visible: boolean;
    orderId: number;
    orderDisplayId: string;
    currentEndDate: string;
    startDate?: string;
    onExtend: (newEndDate: string) => Promise<void>;
    onClose: () => void;
};

/**
 * ExtendRentalModal - Modal gia hạn đơn thuê
 * 
 * Features:
 * - Simple date input for selecting new end date
 * - Validation: new date must be at least 24h after current end date
 * - Shows extension duration calculation
 * - Loading state during API call
 * - Error handling and display
 */
export default function ExtendRentalModal({
    visible,
    orderId,
    orderDisplayId,
    currentEndDate,
    startDate,
    onExtend,
    onClose,
}: ExtendRentalModalProps) {
    // ========== STATE MANAGEMENT ==========
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Date input state (format: DD/MM/YYYY)
    const [dateInput, setDateInput] = useState('');
    const [timeInput, setTimeInput] = useState('12:00');

    // Parsed date from input
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Calculate minimum date (current end date + 24 hours)
    const minDate = useMemo(() => {
        const endDate = new Date(currentEndDate);
        endDate.setHours(endDate.getHours() + 24);
        return endDate;
    }, [currentEndDate]);

    // Initialize date input with minimum date when modal opens
    useEffect(() => {
        if (visible && !dateInput) {
            const day = String(minDate.getDate()).padStart(2, '0');
            const month = String(minDate.getMonth() + 1).padStart(2, '0');
            const year = minDate.getFullYear();
            setDateInput(`${day}/${month}/${year}`);
            setTimeInput(
                `${String(minDate.getHours()).padStart(2, '0')}:${String(minDate.getMinutes()).padStart(2, '0')}`
            );
        }
    }, [visible, minDate, dateInput]);

    // Parse date input whenever it changes
    useEffect(() => {
        if (!dateInput || !timeInput) {
            setSelectedDate(null);
            return;
        }

        // Parse DD/MM/YYYY format
        const dateParts = dateInput.split('/');
        if (dateParts.length !== 3) {
            setSelectedDate(null);
            return;
        }

        const [day, month, year] = dateParts.map(Number);
        if (!day || !month || !year || day > 31 || month > 12) {
            setSelectedDate(null);
            return;
        }

        // Parse HH:mm format
        const timeParts = timeInput.split(':');
        if (timeParts.length !== 2) {
            setSelectedDate(null);
            return;
        }

        const [hours, minutes] = timeParts.map(Number);
        if (isNaN(hours) || isNaN(minutes) || hours > 23 || minutes > 59) {
            setSelectedDate(null);
            return;
        }

        const date = new Date(year, month - 1, day, hours, minutes);
        if (isNaN(date.getTime())) {
            setSelectedDate(null);
            return;
        }

        setSelectedDate(date);
    }, [dateInput, timeInput]);

    // Calculate extension days
    const extensionDays = useMemo(() => {
        if (!selectedDate) return 0;
        return diffDays(currentEndDate, selectedDate);
    }, [currentEndDate, selectedDate]);

    // Days remaining calculation
    const daysRemaining = useMemo(() => {
        return getDaysRemaining(currentEndDate);
    }, [currentEndDate]);

    // Validation message
    const validationError = useMemo(() => {
        if (!selectedDate) return null;
        if (selectedDate < minDate) {
            return 'Ngày kết thúc mới phải sau ngày kết thúc hiện tại ít nhất 24 giờ';
        }
        return null;
    }, [selectedDate, minDate]);

    /**
     * Format date for display (Vietnamese format)
     */
    const formatDate = useCallback((date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    }, []);

    /**
     * Format time for display
     */
    const formatTime = useCallback((date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }, []);

    /**
     * Format date to ISO string for API (without timezone)
     */
    const formatForApi = useCallback((date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }, []);

    /**
     * Handle extend request submission
     */
    const handleSubmit = useCallback(async () => {
        if (!selectedDate) {
            setError('Vui lòng nhập ngày kết thúc mới hợp lệ');
            return;
        }

        if (selectedDate < minDate) {
            setError('Ngày kết thúc mới phải sau ngày kết thúc hiện tại ít nhất 24 giờ');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const formattedDate = formatForApi(selectedDate);
            await onExtend(formattedDate);

            // Show success and close
            Alert.alert(
                'Thành công',
                'Yêu cầu gia hạn đơn hàng đã được gửi thành công!',
                [{ text: 'OK', onPress: onClose }]
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể gửi yêu cầu gia hạn';
            setError(message);
        } finally {
            setIsProcessing(false);
        }
    }, [selectedDate, minDate, formatForApi, onExtend, onClose]);

    /**
     * Reset state when modal closes
     */
    const handleClose = useCallback(() => {
        setDateInput('');
        setTimeInput('12:00');
        setSelectedDate(null);
        setError(null);
        onClose();
    }, [onClose]);

    // Quick date options (add X days from min date)
    const quickOptions = useMemo(() => [
        { label: '+7 ngày', days: 7 },
        { label: '+14 ngày', days: 14 },
        { label: '+30 ngày', days: 30 },
    ], []);

    const handleQuickSelect = useCallback((days: number) => {
        const newDate = new Date(minDate);
        newDate.setDate(newDate.getDate() + days);

        const day = String(newDate.getDate()).padStart(2, '0');
        const month = String(newDate.getMonth() + 1).padStart(2, '0');
        const year = newDate.getFullYear();
        setDateInput(`${day}/${month}/${year}`);
        setError(null);
    }, [minDate]);

    const isValid = selectedDate && !validationError;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={[styles.iconCircle, { backgroundColor: '#dbeafe' }]}>
                            <Ionicons name="calendar-outline" size={32} color="#3b82f6" />
                        </View>
                        <Text style={styles.title}>Yêu cầu gia hạn</Text>
                        <Pressable style={styles.closeButton} onPress={handleClose}>
                            <Ionicons name="close" size={24} color="#6b7280" />
                        </Pressable>
                    </View>

                    {/* Content */}
                    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Order Info */}
                        <View style={styles.infoCard}>
                            <Text style={styles.infoCardTitle}>Thông tin đơn hàng</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Mã đơn</Text>
                                <Text style={styles.infoValue}>#{orderDisplayId}</Text>
                            </View>
                            {startDate && (
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Ngày bắt đầu thuê</Text>
                                    <Text style={styles.infoValue}>{formatDate(startDate)}</Text>
                                </View>
                            )}
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Ngày kết thúc hiện tại</Text>
                                <Text style={styles.infoValue}>{formatDate(currentEndDate)}</Text>
                            </View>
                            {daysRemaining !== null && (
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Thời gian còn lại</Text>
                                    <Text style={[
                                        styles.infoValue,
                                        daysRemaining <= 0 && styles.urgentText,
                                        daysRemaining === 1 && styles.warningText,
                                    ]}>
                                        {formatRemainingDaysText(daysRemaining)}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Date Input Section */}
                        <View style={styles.dateSection}>
                            <Text style={styles.dateSectionTitle}>Chọn ngày kết thúc mới</Text>
                            <Text style={styles.dateSectionSubtitle}>
                                Tối thiểu: {formatDate(minDate)} {formatTime(minDate)}
                            </Text>

                            {/* Quick Select Options */}
                            <View style={styles.quickOptions}>
                                {quickOptions.map((option) => (
                                    <Pressable
                                        key={option.days}
                                        style={styles.quickOption}
                                        onPress={() => handleQuickSelect(option.days)}
                                    >
                                        <Text style={styles.quickOptionText}>{option.label}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Date Input */}
                            <View style={styles.inputRow}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Ngày (DD/MM/YYYY)</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={dateInput}
                                        onChangeText={(text) => {
                                            // Auto-format with slashes
                                            const cleaned = text.replace(/\D/g, '');
                                            let formatted = cleaned;
                                            if (cleaned.length > 2) {
                                                formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
                                            }
                                            if (cleaned.length > 4) {
                                                formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
                                            }
                                            setDateInput(formatted);
                                            setError(null);
                                        }}
                                        placeholder="DD/MM/YYYY"
                                        keyboardType="number-pad"
                                        maxLength={10}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Giờ (HH:MM)</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={timeInput}
                                        onChangeText={(text) => {
                                            // Auto-format with colon
                                            const cleaned = text.replace(/\D/g, '');
                                            let formatted = cleaned;
                                            if (cleaned.length > 2) {
                                                formatted = `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
                                            }
                                            setTimeInput(formatted);
                                            setError(null);
                                        }}
                                        placeholder="HH:MM"
                                        keyboardType="number-pad"
                                        maxLength={5}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Extension Summary */}
                        {isValid && extensionDays > 0 && (
                            <View style={styles.summaryCard}>
                                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                                <View style={styles.summaryContent}>
                                    <Text style={styles.summaryTitle}>
                                        Gia hạn thêm {extensionDays} ngày
                                    </Text>
                                    <Text style={styles.summarySubtitle}>
                                        Ngày kết thúc mới: {formatDate(selectedDate!)} {formatTime(selectedDate!)}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Validation Error */}
                        {validationError && (
                            <View style={styles.warningBox}>
                                <Ionicons name="warning-outline" size={20} color="#f59e0b" />
                                <Text style={styles.warningText}>{validationError}</Text>
                            </View>
                        )}

                        {/* Error Display */}
                        {error && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <Pressable
                            style={styles.secondaryButton}
                            onPress={handleClose}
                            disabled={isProcessing}
                        >
                            <Text style={styles.secondaryButtonText}>Hủy</Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.primaryButton,
                                (!isValid || isProcessing) && styles.primaryButtonDisabled,
                            ]}
                            onPress={handleSubmit}
                            disabled={!isValid || isProcessing}
                        >
                            {isProcessing ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="send" size={18} color="#ffffff" />
                                    <Text style={styles.primaryButtonText}>Gửi yêu cầu</Text>
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
        maxHeight: '90%',
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
    scrollContent: {
        paddingHorizontal: 24,
        paddingVertical: 16,
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
    urgentText: {
        color: '#dc2626',
    },
    warningText: {
        color: '#f59e0b',
    },
    dateSection: {
        marginBottom: 16,
    },
    dateSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    dateSectionSubtitle: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 12,
    },
    quickOptions: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    quickOption: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#3b82f6',
        alignItems: 'center',
    },
    quickOptionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#3b82f6',
    },
    inputRow: {
        flexDirection: 'row',
        gap: 12,
    },
    inputGroup: {
        flex: 1,
    },
    inputLabel: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 6,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
        backgroundColor: '#f9fafb',
    },
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: '#dcfce7',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    summaryContent: {
        flex: 1,
    },
    summaryTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#16a34a',
    },
    summarySubtitle: {
        fontSize: 13,
        color: '#15803d',
        marginTop: 2,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#fef3c7',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#fef2f2',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
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
        paddingTop: 8,
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
        backgroundColor: '#3b82f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonDisabled: {
        opacity: 0.5,
    },
    primaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
});
