/**
 * ExtendRentalModal
 * Modal for extending rental order with date picker
 * Uses a simple date selection UI compatible with Expo Go
 */

import DatePickerField from '@/components/date-picker-field';
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
 * - Date picker for selecting new end date
 * - Dropdown for selecting hour and minute
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

    // Date/Time state
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Time picker modal state
    const [showTimePickerModal, setShowTimePickerModal] = useState(false);
    const [tempHour, setTempHour] = useState(12);
    const [tempMinute, setTempMinute] = useState(0);

    // Calculate minimum date (current end date + 24 hours)
    const minDate = useMemo(() => {
        const endDate = new Date(currentEndDate);
        endDate.setHours(endDate.getHours() + 24);
        return endDate;
    }, [currentEndDate]);

    // Available hours (8:00 - 19:00)
    const availableHours = useMemo(() =>
        Array.from({ length: 12 }, (_, i) => i + 8), // 8 to 19
        []);

    // Available minutes (0, 15, 30, 45)
    const availableMinutes = useMemo(() => [0, 15, 30, 45], []);

    // Initialize date when modal opens
    useEffect(() => {
        if (visible && !selectedDate) {
            const initialDate = new Date(minDate);
            // Set to 12:00 if minDate hour is before 12
            if (initialDate.getHours() < 12) {
                initialDate.setHours(12, 0, 0, 0);
            }
            setSelectedDate(initialDate);
            setTempHour(initialDate.getHours());
            setTempMinute(Math.floor(initialDate.getMinutes() / 15) * 15);
        }
    }, [visible, minDate, selectedDate]);

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
     * Handle date change from DatePickerField
     */
    const handleDateChange = useCallback((date: Date) => {
        // Keep the time from selectedDate but update the date
        const newDate = new Date(date);
        if (selectedDate) {
            newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
        }
        setSelectedDate(newDate);
        setShowDatePicker(false);
        setError(null);
    }, [selectedDate]);

    /**
     * Open time picker modal
     */
    const openTimePickerModal = useCallback(() => {
        if (selectedDate) {
            setTempHour(selectedDate.getHours());
            setTempMinute(Math.floor(selectedDate.getMinutes() / 15) * 15);
        }
        setShowTimePickerModal(true);
    }, [selectedDate]);

    /**
     * Confirm time selection
     */
    const confirmTimeSelection = useCallback(() => {
        if (selectedDate) {
            const newDate = new Date(selectedDate);
            newDate.setHours(tempHour, tempMinute, 0, 0);
            setSelectedDate(newDate);
        }
        setShowTimePickerModal(false);
        setError(null);
    }, [selectedDate, tempHour, tempMinute]);

    /**
     * Handle extend request submission
     */
    const handleSubmit = useCallback(async () => {
        if (!selectedDate) {
            setError('Vui lòng chọn ngày kết thúc mới');
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
        setSelectedDate(null);
        setError(null);
        setShowDatePicker(false);
        setShowTimePickerModal(false);
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
        // Set time to 12:00
        newDate.setHours(12, 0, 0, 0);
        setSelectedDate(newDate);
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
                                        daysRemaining === 1 && styles.warningTextStyle,
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

                            {/* Date/Time Picker Row */}
                            <View style={styles.inputRow}>
                                {/* Date Picker */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Ngày (DD/MM/YYYY)</Text>
                                    <Pressable
                                        style={styles.pickerButton}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                                        <Text style={styles.pickerButtonText}>
                                            {selectedDate ? formatDate(selectedDate) : 'Chọn ngày'}
                                        </Text>
                                    </Pressable>
                                </View>

                                {/* Time Picker */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Giờ (HH:MM)</Text>
                                    <Pressable
                                        style={styles.pickerButton}
                                        onPress={openTimePickerModal}
                                    >
                                        <Ionicons name="time-outline" size={20} color="#6b7280" />
                                        <Text style={styles.pickerButtonText}>
                                            {selectedDate ? formatTime(selectedDate) : '12:00'}
                                        </Text>
                                    </Pressable>
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
                                <Text style={styles.warningTextStyle}>{validationError}</Text>
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

            {/* Date Picker Modal */}
            <Modal
                visible={showDatePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
            >
                <View style={styles.datePickerOverlay}>
                    <View style={styles.datePickerCard}>
                        <Text style={styles.timePickerTitle}>Chọn ngày kết thúc</Text>
                        <DatePickerField
                            value={selectedDate || minDate}
                            minimumDate={minDate}
                            onChange={handleDateChange}
                            showTime={false}
                        />
                        <Pressable
                            style={styles.datePickerDoneButton}
                            onPress={() => setShowDatePicker(false)}
                        >
                            <Text style={styles.datePickerDoneText}>Đóng</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Time Picker Modal */}
            <Modal
                visible={showTimePickerModal}
                transparent
                animationType="fade"
            >
                <View style={styles.timePickerOverlay}>
                    <View style={styles.timePickerCard}>
                        <Text style={styles.timePickerTitle}>Chọn giờ</Text>

                        {/* Preview */}
                        <View style={styles.timePreview}>
                            <Text style={styles.timePreviewText}>
                                {String(tempHour).padStart(2, '0')}:{String(tempMinute).padStart(2, '0')}
                            </Text>
                        </View>

                        {/* Hour Selection */}
                        <Text style={styles.timePickerLabel}>Giờ (08:00 - 19:00)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeOptionsScroll}>
                            <View style={styles.timeOptionsRow}>
                                {availableHours.map((hour) => (
                                    <Pressable
                                        key={`hour-${hour}`}
                                        style={[
                                            styles.timeOption,
                                            tempHour === hour && styles.timeOptionSelected,
                                        ]}
                                        onPress={() => setTempHour(hour)}
                                    >
                                        <Text style={[
                                            styles.timeOptionText,
                                            tempHour === hour && styles.timeOptionTextSelected,
                                        ]}>
                                            {String(hour).padStart(2, '0')}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </ScrollView>

                        {/* Minute Selection */}
                        <Text style={styles.timePickerLabel}>Phút</Text>
                        <View style={styles.minuteOptionsRow}>
                            {availableMinutes.map((minute) => (
                                <Pressable
                                    key={`minute-${minute}`}
                                    style={[
                                        styles.minuteOption,
                                        tempMinute === minute && styles.timeOptionSelected,
                                    ]}
                                    onPress={() => setTempMinute(minute)}
                                >
                                    <Text style={[
                                        styles.timeOptionText,
                                        tempMinute === minute && styles.timeOptionTextSelected,
                                    ]}>
                                        {String(minute).padStart(2, '0')}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Actions */}
                        <View style={styles.timePickerActions}>
                            <Pressable
                                style={styles.timePickerCancelButton}
                                onPress={() => setShowTimePickerModal(false)}
                            >
                                <Text style={styles.timePickerCancelText}>Hủy</Text>
                            </Pressable>
                            <Pressable
                                style={styles.timePickerConfirmButton}
                                onPress={confirmTimeSelection}
                            >
                                <Text style={styles.timePickerConfirmText}>Xác nhận</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
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
    warningTextStyle: {
        flex: 1,
        fontSize: 14,
        color: '#b45309',
        lineHeight: 20,
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
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#f9fafb',
    },
    pickerButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
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
    // Date Picker Modal Styles
    datePickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    datePickerCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        width: '100%',
        maxWidth: 350,
    },
    datePickerDoneButton: {
        marginTop: 12,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
    },
    datePickerDoneText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    // Time Picker Modal Styles
    timePickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    timePickerCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 350,
    },
    timePickerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 16,
    },
    timePreview: {
        alignItems: 'center',
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#f3f4f6',
        borderRadius: 10,
    },
    timePreviewText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#111827',
    },
    timePickerLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    timeOptionsScroll: {
        marginBottom: 16,
    },
    timeOptionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    timeOption: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    timeOptionSelected: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    timeOptionText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#374151',
    },
    timeOptionTextSelected: {
        color: '#ffffff',
    },
    minuteOptionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 20,
    },
    minuteOption: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center',
    },
    timePickerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    timePickerCancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center',
    },
    timePickerCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    timePickerConfirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
    },
    timePickerConfirmText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
});

