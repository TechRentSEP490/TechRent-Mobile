/**
 * AnnexSignModal
 * Modal for signing contract annexes with email OTP verification
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import type { ContractAnnex } from '@/types/annexes';
import { getAnnexStatusMeta } from '@/types/annexes';

type AnnexSignModalProps = {
    visible: boolean;
    annex: ContractAnnex | null;
    userEmail: string;
    isSendingPin: boolean;
    isSigning: boolean;
    pinSent: boolean;
    error: string | null;
    onClose: () => void;
    onSendPin: (email: string) => Promise<boolean>;
    onSign: (pinCode: string) => Promise<boolean>;
};

/**
 * Format currency to VND
 */
const formatVND = (amount: number): string => {
    return Number(amount || 0).toLocaleString('vi-VN', {
        style: 'currency',
        currency: 'VND',
    });
};

/**
 * Format date for display
 */
const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
};

export default function AnnexSignModal({
    visible,
    annex,
    userEmail,
    isSendingPin,
    isSigning,
    pinSent,
    error,
    onClose,
    onSendPin,
    onSign,
}: AnnexSignModalProps) {
    const [pinCode, setPinCode] = useState('');

    const handleClose = useCallback(() => {
        setPinCode('');
        onClose();
    }, [onClose]);

    const handleSendPin = useCallback(async () => {
        await onSendPin(userEmail);
    }, [onSendPin, userEmail]);

    const handleSign = useCallback(async () => {
        if (!pinCode.trim()) return;
        const success = await onSign(pinCode);
        if (success) {
            setPinCode('');
        }
    }, [onSign, pinCode]);

    if (!annex) return null;

    const statusMeta = getAnnexStatusMeta(annex.status);

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
                        <View style={styles.iconCircle}>
                            <Ionicons name="document-text-outline" size={28} color="#3b82f6" />
                        </View>
                        <Text style={styles.title}>Ký phụ lục hợp đồng</Text>
                        <Pressable style={styles.closeButton} onPress={handleClose}>
                            <Ionicons name="close" size={24} color="#6b7280" />
                        </Pressable>
                    </View>

                    {/* Annex Info */}
                    <View style={styles.content}>
                        <View style={styles.infoCard}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Số phụ lục</Text>
                                <Text style={styles.infoValue}>#{annex.annexNumber || annex.annexId || annex.id}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Trạng thái</Text>
                                <View style={[styles.statusBadge, { backgroundColor: statusMeta.bgColor }]}>
                                    <Text style={[styles.statusText, { color: statusMeta.color }]}>
                                        {statusMeta.label}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Thời hạn gia hạn</Text>
                                <Text style={styles.infoValue}>
                                    {formatDate(annex.extensionStartDate)} → {formatDate(annex.extensionEndDate)}
                                </Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Số ngày gia hạn</Text>
                                <Text style={styles.infoValue}>{annex.extensionDays || 0} ngày</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Phí gia hạn</Text>
                                <Text style={[styles.infoValue, styles.priceText]}>
                                    {formatVND(annex.extensionFee || annex.totalPayable || 0)}
                                </Text>
                            </View>
                        </View>

                        {/* Email Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Xác thực qua Email</Text>
                            <View style={styles.emailRow}>
                                <Ionicons name="mail-outline" size={20} color="#6b7280" />
                                <Text style={styles.emailText}>{userEmail}</Text>
                            </View>

                            {!pinSent ? (
                                <Pressable
                                    style={[styles.sendPinButton, isSendingPin && styles.buttonDisabled]}
                                    onPress={handleSendPin}
                                    disabled={isSendingPin}
                                >
                                    {isSendingPin ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <>
                                            <Ionicons name="send-outline" size={18} color="#ffffff" />
                                            <Text style={styles.sendPinButtonText}>Gửi mã xác thực</Text>
                                        </>
                                    )}
                                </Pressable>
                            ) : (
                                <View style={styles.pinSentBadge}>
                                    <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                                    <Text style={styles.pinSentText}>Mã đã được gửi đến email của bạn</Text>
                                </View>
                            )}
                        </View>

                        {/* PIN Input */}
                        {pinSent && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Nhập mã xác thực</Text>
                                <TextInput
                                    style={styles.pinInput}
                                    value={pinCode}
                                    onChangeText={setPinCode}
                                    placeholder="Nhập mã 6 số"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    autoFocus
                                />
                            </View>
                        )}

                        {/* Error */}
                        {error && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <Pressable style={styles.cancelButton} onPress={handleClose}>
                            <Text style={styles.cancelButtonText}>Hủy</Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.signButton,
                                (!pinSent || !pinCode.trim() || isSigning) && styles.buttonDisabled,
                            ]}
                            onPress={handleSign}
                            disabled={!pinSent || !pinCode.trim() || isSigning}
                        >
                            {isSigning ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                                    <Text style={styles.signButtonText}>Ký phụ lục</Text>
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
        padding: 20,
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
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#dbeafe',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
    },
    content: {
        padding: 20,
    },
    infoCard: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 14,
        gap: 10,
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 13,
        color: '#6b7280',
    },
    infoValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    priceText: {
        color: '#dc2626',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 10,
    },
    emailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        backgroundColor: '#f9fafb',
        borderRadius: 10,
        marginBottom: 12,
    },
    emailText: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    sendPinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#3b82f6',
        paddingVertical: 12,
        borderRadius: 10,
    },
    sendPinButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },
    pinSentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#dcfce7',
        padding: 12,
        borderRadius: 10,
    },
    pinSentText: {
        fontSize: 13,
        color: '#16a34a',
    },
    pinInput: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        textAlign: 'center',
        letterSpacing: 4,
        backgroundColor: '#f9fafb',
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#fef2f2',
        borderRadius: 10,
        padding: 12,
    },
    errorText: {
        flex: 1,
        fontSize: 13,
        color: '#dc2626',
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        paddingTop: 0,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    signButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#16a34a',
        paddingVertical: 14,
        borderRadius: 12,
    },
    signButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
});
