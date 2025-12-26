/**
 * Bank Information Screen
 * Manage bank account information - Create, Read, Update, Delete
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { useAuth } from '@/contexts/AuthContext';
import {
    type BankInformation,
    createBankInformation,
    deleteBankInformation,
    fetchBankInformations,
    updateBankInformation,
} from '@/services/bank-informations';

// Common Vietnamese bank names for suggestions
const BANK_SUGGESTIONS = [
    'Vietcombank',
    'Techcombank',
    'BIDV',
    'Agribank',
    'VPBank',
    'MB Bank',
    'ACB',
    'Sacombank',
    'VIB',
    'TPBank',
    'HDBank',
    'OCB',
    'SHB',
    'Eximbank',
    'MSB',
    'SeABank',
    'LienVietPostBank',
    'Nam A Bank',
    'Bac A Bank',
    'VietBank',
];

type FormData = {
    bankName: string;
    bankHolder: string;
    cardNumber: string;
};

const initialFormData: FormData = {
    bankName: '',
    bankHolder: '',
    cardNumber: '',
};

export default function BankInformationsScreen() {
    const router = useRouter();
    const { session, ensureSession } = useAuth();

    // Data state
    const [banks, setBanks] = useState<BankInformation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form modal state
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingBank, setEditingBank] = useState<BankInformation | null>(null);
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Bank suggestions
    const [showSuggestions, setShowSuggestions] = useState(false);
    const filteredSuggestions = BANK_SUGGESTIONS.filter((bank) =>
        bank.toLowerCase().includes(formData.bankName.toLowerCase())
    );

    const loadBankInformations = useCallback(
        async (mode: 'initial' | 'refresh' = 'initial') => {
            if (mode === 'refresh') {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }
            setError(null);

            try {
                const activeSession = session?.accessToken ? session : await ensureSession();
                if (!activeSession?.accessToken) {
                    setError('Bạn cần đăng nhập để xem thông tin ngân hàng.');
                    return;
                }

                const data = await fetchBankInformations(activeSession);
                setBanks(data);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Không thể tải thông tin ngân hàng.';
                setError(message);
            } finally {
                if (mode === 'refresh') {
                    setIsRefreshing(false);
                } else {
                    setIsLoading(false);
                }
            }
        },
        [session, ensureSession]
    );

    useFocusEffect(
        useCallback(() => {
            loadBankInformations();
        }, [loadBankInformations])
    );

    const handleOpenAddModal = () => {
        setEditingBank(null);
        setFormData(initialFormData);
        setFormError(null);
        setIsModalVisible(true);
    };

    const handleOpenEditModal = (bank: BankInformation) => {
        setEditingBank(bank);
        setFormData({
            bankName: bank.bankName,
            bankHolder: bank.bankHolder,
            cardNumber: bank.cardNumber,
        });
        setFormError(null);
        setIsModalVisible(true);
    };

    const handleCloseModal = () => {
        setIsModalVisible(false);
        setEditingBank(null);
        setFormData(initialFormData);
        setFormError(null);
        setShowSuggestions(false);
    };

    const validateForm = (): string | null => {
        if (!formData.bankName.trim()) {
            return 'Vui lòng nhập tên ngân hàng.';
        }
        if (!formData.bankHolder.trim()) {
            return 'Vui lòng nhập tên chủ tài khoản.';
        }
        if (!formData.cardNumber.trim()) {
            return 'Vui lòng nhập số tài khoản.';
        }
        if (!/^\d+$/.test(formData.cardNumber.trim())) {
            return 'Số tài khoản chỉ được chứa chữ số.';
        }
        return null;
    };

    const handleSubmit = async () => {
        const validationError = validateForm();
        if (validationError) {
            setFormError(validationError);
            return;
        }

        setIsSubmitting(true);
        setFormError(null);

        try {
            const activeSession = session?.accessToken ? session : await ensureSession();
            if (!activeSession?.accessToken) {
                setFormError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
                return;
            }

            const payload = {
                bankName: formData.bankName.trim(),
                bankHolder: formData.bankHolder.trim().toUpperCase(),
                cardNumber: formData.cardNumber.trim(),
            };

            if (editingBank) {
                // Update existing
                await updateBankInformation(editingBank.bankInformationId, payload, activeSession);
                Toast.show({
                    type: 'success',
                    text1: 'Cập nhật thành công',
                    text2: 'Thông tin ngân hàng đã được cập nhật.',
                });
            } else {
                // Create new
                await createBankInformation(payload, activeSession);
                Toast.show({
                    type: 'success',
                    text1: 'Thêm thành công',
                    text2: 'Thông tin ngân hàng đã được thêm.',
                });
            }

            handleCloseModal();
            loadBankInformations('refresh');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.';
            setFormError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = (bank: BankInformation) => {
        Alert.alert(
            'Xác nhận xóa',
            `Bạn có chắc chắn muốn xóa tài khoản ${bank.bankName} - ${bank.cardNumber}?`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xóa',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const activeSession = session?.accessToken ? session : await ensureSession();
                            if (!activeSession?.accessToken) {
                                Toast.show({
                                    type: 'error',
                                    text1: 'Lỗi',
                                    text2: 'Phiên đăng nhập đã hết hạn.',
                                });
                                return;
                            }

                            await deleteBankInformation(bank.bankInformationId, activeSession);
                            Toast.show({
                                type: 'success',
                                text1: 'Đã xóa',
                                text2: 'Thông tin ngân hàng đã được xóa.',
                            });
                            loadBankInformations('refresh');
                        } catch (err) {
                            const message = err instanceof Error ? err.message : 'Không thể xóa thông tin ngân hàng.';
                            Toast.show({
                                type: 'error',
                                text1: 'Lỗi',
                                text2: message,
                            });
                        }
                    },
                },
            ]
        );
    };

    const selectBankSuggestion = (bank: string) => {
        setFormData((prev) => ({ ...prev, bankName: bank }));
        setShowSuggestions(false);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('vi-VN');
        } catch {
            return '';
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={22} color="#111111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Thông tin ngân hàng</Text>
                <TouchableOpacity style={styles.headerButton} onPress={handleOpenAddModal}>
                    <Ionicons name="add" size={24} color="#111111" />
                </TouchableOpacity>
            </View>

            {/* Content */}
            {isLoading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color="#111111" />
                    <Text style={styles.stateText}>Đang tải...</Text>
                </View>
            ) : error ? (
                <View style={styles.centerState}>
                    <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
                    <Text style={styles.stateText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => loadBankInformations()}>
                        <Text style={styles.retryButtonText}>Thử lại</Text>
                    </TouchableOpacity>
                </View>
            ) : banks.length === 0 ? (
                <View style={styles.centerState}>
                    <Ionicons name="card-outline" size={64} color="#d1d5db" />
                    <Text style={styles.stateTitle}>Chưa có thông tin ngân hàng</Text>
                    <Text style={styles.stateText}>Thêm tài khoản ngân hàng để nhận hoàn tiền cọc</Text>
                    <TouchableOpacity style={styles.addButton} onPress={handleOpenAddModal}>
                        <Ionicons name="add" size={20} color="#ffffff" />
                        <Text style={styles.addButtonText}>Thêm tài khoản</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={() => loadBankInformations('refresh')} />
                    }
                >
                    {banks.map((bank) => (
                        <View key={bank.bankInformationId} style={styles.bankCard}>
                            <View style={styles.bankCardHeader}>
                                <View style={styles.bankIcon}>
                                    <Ionicons name="business-outline" size={24} color="#111111" />
                                </View>
                                <View style={styles.bankInfo}>
                                    <Text style={styles.bankName}>{bank.bankName}</Text>
                                    <Text style={styles.bankHolder}>{bank.bankHolder}</Text>
                                </View>
                                <View style={styles.bankActions}>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleOpenEditModal(bank)}
                                    >
                                        <Ionicons name="pencil-outline" size={18} color="#6b7280" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.deleteButton]}
                                        onPress={() => handleDelete(bank)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View style={styles.bankCardBody}>
                                <View style={styles.cardNumberRow}>
                                    <Ionicons name="card-outline" size={16} color="#6b7280" />
                                    <Text style={styles.cardNumber}>{bank.cardNumber}</Text>
                                </View>
                                {bank.createdAt && (
                                    <Text style={styles.bankMeta}>Thêm ngày {formatDate(bank.createdAt)}</Text>
                                )}
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}

            {/* Add/Edit Modal */}
            <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={handleCloseModal}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingBank ? 'Sửa thông tin ngân hàng' : 'Thêm thông tin ngân hàng'}
                            </Text>
                            <TouchableOpacity onPress={handleCloseModal} style={styles.modalCloseButton}>
                                <Ionicons name="close" size={24} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                            {/* Bank Name */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Tên ngân hàng</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="VD: Vietcombank, BIDV, MB Bank..."
                                    placeholderTextColor="#9ca3af"
                                    value={formData.bankName}
                                    onChangeText={(text) => {
                                        setFormData((prev) => ({ ...prev, bankName: text }));
                                        setShowSuggestions(text.length > 0);
                                    }}
                                    onFocus={() => setShowSuggestions(formData.bankName.length > 0)}
                                />
                                {showSuggestions && filteredSuggestions.length > 0 && (
                                    <View style={styles.suggestionsContainer}>
                                        {filteredSuggestions.slice(0, 5).map((bank) => (
                                            <Pressable
                                                key={bank}
                                                style={styles.suggestionItem}
                                                onPress={() => selectBankSuggestion(bank)}
                                            >
                                                <Text style={styles.suggestionText}>{bank}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Bank Holder */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Tên chủ tài khoản</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="NGUYEN VAN A"
                                    placeholderTextColor="#9ca3af"
                                    value={formData.bankHolder}
                                    onChangeText={(text) => setFormData((prev) => ({ ...prev, bankHolder: text }))}
                                    autoCapitalize="characters"
                                />
                                <Text style={styles.formHint}>Nhập đúng tên trên thẻ ngân hàng (viết hoa, không dấu)</Text>
                            </View>

                            {/* Card Number */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Số tài khoản</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="VD: 1234567890"
                                    placeholderTextColor="#9ca3af"
                                    value={formData.cardNumber}
                                    onChangeText={(text) => setFormData((prev) => ({ ...prev, cardNumber: text.replace(/\D/g, '') }))}
                                    keyboardType="number-pad"
                                />
                            </View>

                            {formError && (
                                <View style={styles.formErrorBanner}>
                                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                                    <Text style={styles.formErrorText}>{formError}</Text>
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.cancelButton} onPress={handleCloseModal}>
                                <Text style={styles.cancelButtonText}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                                onPress={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Text style={styles.submitButtonText}>{editingBank ? 'Cập nhật' : 'Thêm'}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    headerButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: '#f9fafb',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111111',
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 12,
    },
    stateTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111111',
    },
    stateText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 12,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#111111',
        borderRadius: 12,
    },
    retryButtonText: {
        color: '#ffffff',
        fontWeight: '600',
    },
    addButton: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#111111',
        borderRadius: 12,
    },
    addButtonText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 15,
    },
    list: {
        flex: 1,
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    bankCard: {
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    bankCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    bankIcon: {
        width: 48,
        height: 48,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    bankInfo: {
        flex: 1,
    },
    bankName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
    },
    bankHolder: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 2,
    },
    bankActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 36,
        height: 36,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    deleteButton: {
        borderColor: '#fecaca',
        backgroundColor: '#fef2f2',
    },
    bankCardBody: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    cardNumberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cardNumber: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111111',
        letterSpacing: 1,
    },
    bankMeta: {
        marginTop: 8,
        fontSize: 12,
        color: '#9ca3af',
    },
    // Modal styles
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111111',
    },
    modalCloseButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBody: {
        padding: 20,
    },
    formGroup: {
        marginBottom: 20,
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    formInput: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: '#111111',
    },
    formHint: {
        marginTop: 6,
        fontSize: 12,
        color: '#9ca3af',
    },
    suggestionsContainer: {
        marginTop: 4,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        overflow: 'hidden',
    },
    suggestionItem: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    suggestionText: {
        fontSize: 15,
        color: '#111111',
    },
    formErrorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#fef2f2',
        borderRadius: 12,
        marginBottom: 16,
    },
    formErrorText: {
        flex: 1,
        fontSize: 13,
        color: '#ef4444',
        fontWeight: '500',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    submitButton: {
        flex: 1,
        paddingVertical: 14,
        backgroundColor: '#111111',
        borderRadius: 12,
        alignItems: 'center',
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
});
