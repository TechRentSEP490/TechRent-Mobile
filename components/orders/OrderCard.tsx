/**
 * OrderCard Component
 * Renders a single order card in the FlatList
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import type { PaymentMethod } from '@/services/payments';
import styles from '@/style/orders.styles';
import type { OrderCard as OrderCardType } from '@/types/orders';
import { isContractSignedByCustomer, PAYMENT_OPTIONS } from '@/utils/order-utils';

interface OrderCardProps {
    item: OrderCardType;
    isHighlighted?: boolean;
    onViewDetails: () => void;
    onAction: () => void;
    onQuickPay: (method: PaymentMethod) => void;
    onExpiryAction?: () => void; // Callback khi bấm xử lý hết hạn
}

function OrderCardComponent({
    item,
    isHighlighted = false,
    onViewDetails,
    onAction,
    onQuickPay,
    onExpiryAction,
}: OrderCardProps) {
    const thumbnailImages = item.deviceImageUrls?.filter((uri) => uri && uri.length > 0) ?? [];
    const maxVisibleThumbnails = 3;
    const visibleImages = thumbnailImages.slice(0, maxVisibleThumbnails);
    const stackWidth =
        64 +
        Math.max(visibleImages.length - 1, 0) * 16 +
        (thumbnailImages.length > maxVisibleThumbnails ? 16 : 0);

    // Quick pay only available if contract is signed AND order is still in Pending status
    // Exclude DELIVERY_CONFIRMED (Sẵn sàng giao) - không cần thanh toán thêm
    const canQuickPay = isContractSignedByCustomer(item.contract)
        && item.statusFilter === 'Pending'
        && item.rawStatus !== 'DELIVERY_CONFIRMED';

    // Tính số ngày còn lại đến planEndDate
    const daysUntilExpiry = useMemo(() => {
        if (!item.planEndDate) return null;
        try {
            const endDate = new Date(item.planEndDate);
            const now = new Date();
            const diffTime = endDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        } catch {
            return null;
        }
    }, [item.planEndDate]);

    // Hiển thị button xử lý hết hạn khi: IN_USE và còn <= 1 ngày
    const showExpiryButton = item.rawStatus === 'IN_USE'
        && daysUntilExpiry !== null
        && daysUntilExpiry <= 1;

    return (
        <View style={[styles.orderCard, isHighlighted && styles.orderCardHighlighted]}>
            <View style={styles.cardLeading}>
                {visibleImages.length > 0 ? (
                    <View style={[styles.thumbnailStack, { width: stackWidth }]}>
                        {visibleImages.map((uri, index) => (
                            <Image
                                key={`${item.id}-thumb-${index}`}
                                source={{ uri }}
                                resizeMode="cover"
                                style={[
                                    styles.thumbnailImage,
                                    { left: index * 16, zIndex: visibleImages.length - index },
                                ]}
                            />
                        ))}
                        {thumbnailImages.length > maxVisibleThumbnails ? (
                            <View style={[styles.thumbnailMore, { left: visibleImages.length * 16 }]}>
                                <Text style={styles.thumbnailMoreLabel}>
                                    +{thumbnailImages.length - maxVisibleThumbnails}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                ) : (
                    <View style={styles.thumbnail}>
                        <Text style={styles.thumbnailText}>IMG</Text>
                    </View>
                )}
            </View>

            <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                    <Text style={styles.productName}>{item.title}</Text>
                    <View
                        style={[
                            styles.statusBadge,
                            { backgroundColor: item.statusBackground },
                        ]}
                    >
                        <Text style={[styles.statusText, { color: item.statusColor }]}>
                            {item.statusLabel}
                        </Text>
                    </View>
                </View>

                <Text style={styles.orderNumber}>{item.deviceSummary}</Text>

                <View style={styles.metaRow}>
                    <View style={styles.metaGroup}>
                        <Text style={styles.metaLabel}>Thời gian thuê</Text>
                        <Text style={styles.metaValue}>{item.rentalPeriod}</Text>
                    </View>
                    <View style={styles.metaGroup}>
                        <Text style={styles.metaLabel}>Tổng thanh toán</Text>
                        <Text style={styles.metaValue}>{item.totalAmount}</Text>
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <Pressable onPress={onViewDetails}>
                        <Text style={styles.viewDetails}>Xem chi tiết</Text>
                    </Pressable>
                    {item.action ? (
                        <Pressable style={styles.cardActionButton} onPress={onAction}>
                            <Text style={styles.cardActionLabel}>{item.action.label}</Text>
                        </Pressable>
                    ) : null}
                </View>

                {/* Expiry Warning Button */}
                {showExpiryButton && onExpiryAction ? (
                    <Pressable
                        style={[
                            styles.expiryButton,
                            daysUntilExpiry <= 0 ? styles.expiryButtonExpired : styles.expiryButtonWarning
                        ]}
                        onPress={onExpiryAction}
                    >
                        <Ionicons
                            name="time-outline"
                            size={18}
                            color={daysUntilExpiry <= 0 ? '#dc2626' : '#f59e0b'}
                        />
                        <Text style={[
                            styles.expiryText,
                            daysUntilExpiry <= 0 ? styles.expiryTextExpired : styles.expiryTextWarning
                        ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {daysUntilExpiry <= 0 ? 'Đã hết hạn - Xử lý ngay' : 'Sắp hết hạn - Quyết định xử lý'}
                        </Text>
                        <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={daysUntilExpiry <= 0 ? '#dc2626' : '#f59e0b'}
                        />
                    </Pressable>
                ) : null}

                {canQuickPay ? (
                    <View style={styles.quickPaySection}>
                        <Text style={styles.quickPayLabel}>Thanh toán nhanh</Text>
                        <View style={styles.quickPayButtons}>
                            {PAYMENT_OPTIONS.map((option) => (
                                <Pressable
                                    key={`${item.id}-${option.id}`}
                                    style={styles.quickPayButton}
                                    onPress={() => onQuickPay(option.id)}
                                >
                                    <View style={styles.quickPayButtonIcon}>
                                        {React.isValidElement(option.icon)
                                            ? React.cloneElement(option.icon as React.ReactElement<{ size?: number }>, { size: 18 })
                                            : option.icon}
                                    </View>
                                    <Text style={styles.quickPayButtonLabel}>{option.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

export const OrderCard = React.memo(OrderCardComponent);

