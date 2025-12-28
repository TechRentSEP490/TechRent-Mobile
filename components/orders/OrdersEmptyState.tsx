/**
 * OrdersEmptyState Component
 * Renders the empty/loading/error state for the orders list
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import styles from '@/style/orders.styles';

interface OrdersEmptyStateProps {
    isLoading: boolean;
    errorMessage?: string | null;
    onRetry: () => void;
}

function OrdersEmptyStateComponent({
    isLoading,
    errorMessage,
    onRetry,
}: OrdersEmptyStateProps) {
    return (
        <View style={styles.emptyState}>
            {isLoading ? (
                <>
                    <ActivityIndicator size="large" color="#111111" />
                    <Text style={styles.emptyTitle}>Đang tải đơn hàng…</Text>
                    <Text style={styles.emptySubtitle}>
                        Vui lòng đợi trong khi chúng tôi tải đơn hàng của bạn.
                    </Text>
                </>
            ) : (
                <>
                    <Ionicons name="cube-outline" size={48} color="#9ca3af" />
                    <Text style={styles.emptyTitle}>
                        {errorMessage ? 'Không thể tải đơn hàng' : 'Không tìm thấy đơn hàng'}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                        {errorMessage
                            ? errorMessage
                            : 'Các đơn hàng phù hợp với trạng thái đã chọn sẽ hiển thị ở đây.'}
                    </Text>
                    {errorMessage ? (
                        <Pressable style={styles.retryButton} onPress={onRetry}>
                            <Text style={styles.retryButtonText}>Thử lại</Text>
                        </Pressable>
                    ) : null}
                </>
            )}
        </View>
    );
}

export const OrdersEmptyState = React.memo(OrdersEmptyStateComponent);
