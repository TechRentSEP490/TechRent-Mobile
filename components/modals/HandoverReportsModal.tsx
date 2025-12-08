/**
 * HandoverReportsModal
 * Displays list of handover reports (checkout/checkin) for an order
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import type { HandoverReport } from '@/types/handover-reports';
import { HANDOVER_STATUS_MAP, HANDOVER_TYPE_MAP } from '@/types/handover-reports';

type HandoverReportsModalProps = {
    visible: boolean;
    reports: HandoverReport[];
    loading: boolean;
    error: string | null;
    onClose: () => void;
    onViewReport: (report: HandoverReport) => void;
    onSignReport: (report: HandoverReport) => void;
    onRefresh: () => void;
};

export default function HandoverReportsModal({
    visible,
    reports,
    loading,
    error,
    onClose,
    onViewReport,
    onSignReport,
    onRefresh,
}: HandoverReportsModalProps) {
    const [activeTab, setActiveTab] = useState<'CHECKOUT' | 'CHECKIN'>('CHECKOUT');

    const checkoutReports = reports.filter((r) => r.handoverType === 'CHECKOUT');
    const checkinReports = reports.filter((r) => r.handoverType === 'CHECKIN');
    const currentReports = activeTab === 'CHECKOUT' ? checkoutReports : checkinReports;

    const formatDateTime = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const canSign = (report: HandoverReport) => {
        // Customer can sign only when status is STAFF_SIGNED (staff signed but customer hasn't)
        return report.status === 'STAFF_SIGNED' && report.staffSigned && !report.customerSigned;
    };

    const renderReport = ({ item }: { item: HandoverReport }) => {
        const statusMeta = HANDOVER_STATUS_MAP[item.status] || {
            label: item.status,
            color: '#6b7280',
        };
        const needsSign = canSign(item);

        return (
            <Pressable
                style={styles.reportCard}
                onPress={() => onViewReport(item)}
            >
                <View style={styles.reportHeader}>
                    <View style={styles.reportTitleRow}>
                        <Ionicons
                            name={item.handoverType === 'CHECKOUT' ? 'cube-outline' : 'return-down-back-outline'}
                            size={20}
                            color="#374151"
                        />
                        <Text style={styles.reportTitle}>
                            {HANDOVER_TYPE_MAP[item.handoverType]}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + '20' }]}>
                        <Text style={[styles.statusText, { color: statusMeta.color }]}>
                            {statusMeta.label}
                        </Text>
                    </View>
                </View>

                <View style={styles.reportContent}>
                    <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={16} color="#9ca3af" />
                        <Text style={styles.infoText}>{formatDateTime(item.handoverDateTime)}</Text>
                    </View>
                    {item.handoverLocation && (
                        <View style={styles.infoRow}>
                            <Ionicons name="location-outline" size={16} color="#9ca3af" />
                            <Text style={styles.infoText} numberOfLines={1}>
                                {item.handoverLocation}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.reportActions}>
                    <Pressable
                        style={styles.viewButton}
                        onPress={() => onViewReport(item)}
                    >
                        <Ionicons name="document-text-outline" size={18} color="#3b82f6" />
                        <Text style={styles.viewButtonText}>Xem PDF</Text>
                    </Pressable>

                    {needsSign && (
                        <Pressable
                            style={styles.signButton}
                            onPress={() => onSignReport(item)}
                        >
                            <Ionicons name="create-outline" size={18} color="#ffffff" />
                            <Text style={styles.signButtonText}>Ký biên bản</Text>
                        </Pressable>
                    )}
                </View>
            </Pressable>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons
                name={activeTab === 'CHECKOUT' ? 'cube-outline' : 'return-down-back-outline'}
                size={48}
                color="#d1d5db"
            />
            <Text style={styles.emptyTitle}>
                {activeTab === 'CHECKOUT' ? 'Chưa có biên bản bàn giao' : 'Chưa có biên bản thu hồi'}
            </Text>
            <Text style={styles.emptySubtitle}>
                Biên bản sẽ được tạo khi giao/nhận thiết bị
            </Text>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Biên bản bàn giao</Text>
                    <Pressable style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close" size={24} color="#374151" />
                    </Pressable>
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <Pressable
                        style={[styles.tab, activeTab === 'CHECKOUT' && styles.tabActive]}
                        onPress={() => setActiveTab('CHECKOUT')}
                    >
                        <Ionicons
                            name="cube-outline"
                            size={18}
                            color={activeTab === 'CHECKOUT' ? '#111827' : '#6b7280'}
                        />
                        <Text
                            style={[styles.tabText, activeTab === 'CHECKOUT' && styles.tabTextActive]}
                        >
                            Bàn giao ({checkoutReports.length})
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tab, activeTab === 'CHECKIN' && styles.tabActive]}
                        onPress={() => setActiveTab('CHECKIN')}
                    >
                        <Ionicons
                            name="return-down-back-outline"
                            size={18}
                            color={activeTab === 'CHECKIN' ? '#111827' : '#6b7280'}
                        />
                        <Text
                            style={[styles.tabText, activeTab === 'CHECKIN' && styles.tabTextActive]}
                        >
                            Thu hồi ({checkinReports.length})
                        </Text>
                    </Pressable>
                </View>

                {/* Content */}
                {loading ? (
                    <View style={styles.loadingState}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <Text style={styles.loadingText}>Đang tải...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.errorState}>
                        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
                        <Text style={styles.errorTitle}>Không thể tải biên bản</Text>
                        <Text style={styles.errorText}>{error}</Text>
                        <Pressable style={styles.retryButton} onPress={onRefresh}>
                            <Ionicons name="refresh-outline" size={18} color="#ffffff" />
                            <Text style={styles.retryButtonText}>Thử lại</Text>
                        </Pressable>
                    </View>
                ) : (
                    <FlatList
                        data={currentReports}
                        renderItem={renderReport}
                        keyExtractor={(item) => String(item.handoverReportId)}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={renderEmptyState}
                        refreshing={loading}
                        onRefresh={onRefresh}
                    />
                )}
            </View>
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
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#f3f4f6',
    },
    tabActive: {
        backgroundColor: '#111827',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    tabTextActive: {
        color: '#ffffff',
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    reportCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 12,
    },
    reportHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    reportTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    reportTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    reportContent: {
        gap: 8,
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#6b7280',
    },
    reportActions: {
        flexDirection: 'row',
        gap: 12,
    },
    viewButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#3b82f6',
        backgroundColor: '#eff6ff',
    },
    viewButtonText: {
        fontSize: 14,
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
        borderRadius: 10,
        backgroundColor: '#111827',
    },
    signButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
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
});
