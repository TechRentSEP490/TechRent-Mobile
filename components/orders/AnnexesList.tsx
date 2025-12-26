/**
 * AnnexesList
 * Component to display list of contract annexes with sign/pay actions
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ContractAnnex } from '@/types/annexes';
import { annexNeedsCustomerSignature, getAnnexStatusMeta, isAnnexFullySigned } from '@/types/annexes';

type AnnexesListProps = {
    annexes: ContractAnnex[];
    isLoading: boolean;
    error: string | null;
    onSignAnnex: (annex: ContractAnnex) => void;
    onPayAnnex?: (annex: ContractAnnex) => void;
    onViewAnnex?: (annex: ContractAnnex) => void;
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

export default function AnnexesList({
    annexes,
    isLoading,
    error,
    onSignAnnex,
    onPayAnnex,
    onViewAnnex,
}: AnnexesListProps) {
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#6b7280" />
                <Text style={styles.loadingText}>Đang tải phụ lục...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    if (!annexes || annexes.length === 0) {
        return null; // Don't show anything if no annexes
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Ionicons name="document-attach-outline" size={18} color="#374151" />
                <Text style={styles.headerTitle}>Phụ lục hợp đồng ({annexes.length})</Text>
            </View>

            {annexes.map((annex) => {
                const statusMeta = getAnnexStatusMeta(annex.status);
                const needsSignature = annexNeedsCustomerSignature(annex);
                const isSigned = isAnnexFullySigned(annex);

                return (
                    <View key={annex.id || annex.annexId} style={styles.annexCard}>
                        {/* Top Row: ID and Status */}
                        <View style={styles.topRow}>
                            <Text style={styles.annexId}>
                                Phụ lục #{annex.annexNumber || annex.annexId || annex.id}
                            </Text>
                            <View style={[styles.statusBadge, { backgroundColor: statusMeta.bgColor }]}>
                                <Text style={[styles.statusText, { color: statusMeta.color }]}>
                                    {statusMeta.label}
                                </Text>
                            </View>
                        </View>

                        {/* Period */}
                        <View style={styles.periodRow}>
                            <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                            <Text style={styles.periodText}>
                                {formatDate(annex.extensionStartDate)} → {formatDate(annex.extensionEndDate)}
                            </Text>
                            <Text style={styles.daysText}>({annex.extensionDays || 0} ngày)</Text>
                        </View>

                        {/* Fee */}
                        <View style={styles.feeRow}>
                            <Text style={styles.feeLabel}>Phí gia hạn:</Text>
                            <Text style={styles.feeValue}>
                                {formatVND(annex.extensionFee || annex.totalPayable || 0)}
                            </Text>
                        </View>

                        {/* Actions */}
                        <View style={styles.actionsRow}>
                            {onViewAnnex && (
                                <Pressable
                                    style={styles.viewButton}
                                    onPress={() => onViewAnnex(annex)}
                                >
                                    <Ionicons name="eye-outline" size={16} color="#3b82f6" />
                                    <Text style={styles.viewButtonText}>Xem</Text>
                                </Pressable>
                            )}

                            {needsSignature && (
                                <Pressable
                                    style={styles.signButton}
                                    onPress={() => onSignAnnex(annex)}
                                >
                                    <Ionicons name="create-outline" size={16} color="#ffffff" />
                                    <Text style={styles.signButtonText}>Ký phụ lục</Text>
                                </Pressable>
                            )}

                            {isSigned &&
                                onPayAnnex &&
                                (annex.extensionFee || annex.totalPayable) > 0 &&
                                annex.invoiceStatus !== 'SUCCEEDED' && (
                                    <Pressable
                                        style={styles.payButton}
                                        onPress={() => onPayAnnex(annex)}
                                    >
                                        <Ionicons name="card-outline" size={16} color="#ffffff" />
                                        <Text style={styles.payButtonText}>Thanh toán</Text>
                                    </Pressable>
                                )}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
    },
    loadingText: {
        fontSize: 14,
        color: '#6b7280',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        backgroundColor: '#fef2f2',
        borderRadius: 10,
    },
    errorText: {
        flex: 1,
        fontSize: 13,
        color: '#dc2626',
    },
    annexCard: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    annexId: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    periodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    periodText: {
        fontSize: 13,
        color: '#374151',
    },
    daysText: {
        fontSize: 12,
        color: '#6b7280',
    },
    feeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    feeLabel: {
        fontSize: 13,
        color: '#6b7280',
    },
    feeValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#dc2626',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    viewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#3b82f6',
        backgroundColor: '#ffffff',
    },
    viewButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#3b82f6',
    },
    signButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#16a34a',
    },
    signButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ffffff',
    },
    payButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#3b82f6',
    },
    payButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ffffff',
    },
});
