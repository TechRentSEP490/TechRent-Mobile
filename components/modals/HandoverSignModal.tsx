/**
 * HandoverSignModal
 * PIN verification flow for signing handover reports
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import type { HandoverReport } from '@/types/handover-reports';
import { HANDOVER_TYPE_MAP } from '@/types/handover-reports';

type HandoverSignModalProps = {
    visible: boolean;
    report: HandoverReport | null;
    userEmail: string;
    onClose: () => void;
    onSendPin: (email: string) => Promise<void>;
    onSign: (pinCode: string, signature: string) => Promise<void>;
};

type Step = 'send-pin' | 'enter-pin' | 'signing' | 'success';

export default function HandoverSignModal({
    visible,
    report,
    userEmail,
    onClose,
    onSendPin,
    onSign,
}: HandoverSignModalProps) {
    const [step, setStep] = useState<Step>('send-pin');
    const [pinCode, setPinCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const pinInputRef = useRef<TextInput>(null);

    const resetState = () => {
        setStep('send-pin');
        setPinCode('');
        setError(null);
        setIsLoading(false);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleSendPin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await onSendPin(userEmail);
            setStep('enter-pin');
            setTimeout(() => {
                pinInputRef.current?.focus();
            }, 100);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể gửi mã PIN';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSign = async () => {
        if (pinCode.length < 4) {
            setError('Vui lòng nhập mã PIN');
            return;
        }

        setIsLoading(true);
        setStep('signing');
        setError(null);
        try {
            // Using email as signature for now (can be enhanced with actual signature pad)
            await onSign(pinCode, userEmail);
            setStep('success');
            // Auto close after success
            setTimeout(() => {
                handleClose();
            }, 1500);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể ký biên bản';
            setError(message);
            setStep('enter-pin');
        } finally {
            setIsLoading(false);
        }
    };

    const formatEmail = (email: string) => {
        const [name, domain] = email.split('@');
        if (!name || !domain) return email;
        const maskedName = name.length > 3
            ? name.slice(0, 3) + '***'
            : name + '***';
        return `${maskedName}@${domain}`;
    };

    if (!report) return null;

    const reportTypeLabel = HANDOVER_TYPE_MAP[report.handoverType];

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
                        <View style={[
                            styles.iconCircle,
                            step === 'success'
                                ? { backgroundColor: '#dcfce7' }
                                : { backgroundColor: '#eff6ff' }
                        ]}>
                            <Ionicons
                                name={step === 'success' ? 'checkmark-circle' : 'create-outline'}
                                size={32}
                                color={step === 'success' ? '#22c55e' : '#3b82f6'}
                            />
                        </View>
                        <Text style={styles.title}>
                            {step === 'success' ? 'Ký thành công!' : `Ký ${reportTypeLabel}`}
                        </Text>
                        {step !== 'success' && (
                            <Pressable style={styles.closeButton} onPress={handleClose}>
                                <Ionicons name="close" size={24} color="#6b7280" />
                            </Pressable>
                        )}
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        {step === 'success' ? (
                            <View style={styles.successContent}>
                                <Text style={styles.successText}>
                                    Bạn đã ký {reportTypeLabel.toLowerCase()} thành công
                                </Text>
                            </View>
                        ) : step === 'send-pin' ? (
                            <>
                                <Text style={styles.description}>
                                    Để xác nhận ký biên bản, chúng tôi sẽ gửi mã PIN xác thực đến email của bạn.
                                </Text>
                                <View style={styles.emailBox}>
                                    <Ionicons name="mail-outline" size={20} color="#6b7280" />
                                    <Text style={styles.emailText}>{formatEmail(userEmail)}</Text>
                                </View>
                            </>
                        ) : (
                            <>
                                <Text style={styles.description}>
                                    Nhập mã PIN đã được gửi đến email của bạn
                                </Text>
                                <View style={styles.pinInputContainer}>
                                    <TextInput
                                        ref={pinInputRef}
                                        style={styles.pinInput}
                                        value={pinCode}
                                        onChangeText={(text) => {
                                            setPinCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                                            setError(null);
                                        }}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        placeholder="Nhập mã PIN"
                                        placeholderTextColor="#9ca3af"
                                        editable={step === 'enter-pin'}
                                    />
                                </View>
                                <Pressable style={styles.resendLink} onPress={handleSendPin} disabled={isLoading}>
                                    <Ionicons name="refresh-outline" size={16} color="#3b82f6" />
                                    <Text style={styles.resendText}>Gửi lại mã PIN</Text>
                                </Pressable>
                            </>
                        )}

                        {error && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}
                    </View>

                    {/* Actions */}
                    {step !== 'success' && (
                        <View style={styles.actions}>
                            <Pressable
                                style={styles.secondaryButton}
                                onPress={handleClose}
                                disabled={isLoading}
                            >
                                <Text style={styles.secondaryButtonText}>Hủy</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                                onPress={step === 'send-pin' ? handleSendPin : handleSign}
                                disabled={isLoading || (step === 'enter-pin' && pinCode.length < 4)}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#ffffff" size="small" />
                                ) : step === 'send-pin' ? (
                                    <>
                                        <Ionicons name="mail-outline" size={18} color="#ffffff" />
                                        <Text style={styles.primaryButtonText}>Gửi mã PIN</Text>
                                    </>
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-outline" size={18} color="#ffffff" />
                                        <Text style={styles.primaryButtonText}>Xác nhận ký</Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    )}
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
        paddingTop: 28,
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
    description: {
        fontSize: 15,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 22,
    },
    emailBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 14,
    },
    emailText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#374151',
    },
    pinInputContainer: {
        alignItems: 'center',
    },
    pinInput: {
        width: '100%',
        maxWidth: 200,
        fontSize: 24,
        fontWeight: '600',
        textAlign: 'center',
        letterSpacing: 8,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        backgroundColor: '#f9fafb',
        color: '#111827',
    },
    resendLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 8,
    },
    resendText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#3b82f6',
    },
    successContent: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    successText: {
        fontSize: 16,
        color: '#374151',
        textAlign: 'center',
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#fef2f2',
        borderRadius: 10,
        padding: 12,
    },
    errorText: {
        flex: 1,
        fontSize: 14,
        color: '#dc2626',
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
