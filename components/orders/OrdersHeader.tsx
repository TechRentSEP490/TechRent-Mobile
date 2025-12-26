/**
 * OrdersHeader Component
 * Renders the header section with title, expandable search bar, and filter chips
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    LayoutAnimation,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    UIManager,
    View,
} from 'react-native';

import styles from '@/style/orders.styles';
import type { OrderStatusFilter } from '@/types/orders';
import { FILTER_LABELS, ORDER_FILTERS } from '@/utils/order-utils';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface OrdersHeaderProps {
    selectedFilter: OrderStatusFilter;
    onFilterChange: (filter: OrderStatusFilter) => void;
    errorMessage?: string | null;
    ordersCount: number;
    onRetry: () => void;
    // Search props
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onSearch: () => void;
    isSearching: boolean;
    onClearSearch: () => void;
    isSearchActive: boolean;
    // Search expansion state (controlled from parent)
    isSearchExpanded: boolean;
    onToggleSearchExpanded: (expanded: boolean) => void;
}

function OrdersHeaderComponent({
    selectedFilter,
    onFilterChange,
    errorMessage,
    ordersCount,
    onRetry,
    searchQuery,
    onSearchChange,
    onSearch,
    isSearching,
    onClearSearch,
    isSearchActive,
    isSearchExpanded,
    onToggleSearchExpanded,
}: OrdersHeaderProps) {
    const searchInputRef = useRef<TextInput>(null);

    // Focus input when search expands
    useEffect(() => {
        if (isSearchExpanded) {
            // Small delay to ensure the input is mounted
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isSearchExpanded]);

    const handleSearchToggle = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (isSearchExpanded) {
            Keyboard.dismiss();
            onToggleSearchExpanded(false);
        } else {
            onToggleSearchExpanded(true);
        }
    }, [isSearchExpanded, onToggleSearchExpanded]);

    const handleSearchSubmit = useCallback(() => {
        if (searchQuery.trim().length > 0) {
            Keyboard.dismiss();
            onSearch();
        }
    }, [searchQuery, onSearch]);

    const handleClearAndClose = useCallback(() => {
        onClearSearch();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onToggleSearchExpanded(false);
    }, [onClearSearch, onToggleSearchExpanded]);

    return (
        <View style={styles.headerSection}>
            <View style={styles.topBar}>
                {isSearchExpanded ? (
                    // Search bar expanded
                    <View style={styles.searchBarExpanded}>
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
                            <TextInput
                                ref={searchInputRef}
                                style={styles.searchInput}
                                placeholder="Nhập mã đơn hàng..."
                                placeholderTextColor="#9ca3af"
                                value={searchQuery}
                                onChangeText={onSearchChange}
                                onSubmitEditing={handleSearchSubmit}
                                keyboardType="number-pad"
                                returnKeyType="search"
                                editable={!isSearching}
                            />
                            {isSearching ? (
                                <ActivityIndicator size="small" color="#111" style={styles.searchIcon} />
                            ) : searchQuery.length > 0 ? (
                                <Pressable onPress={() => onSearchChange('')} style={styles.searchIcon}>
                                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                                </Pressable>
                            ) : null}
                        </View>
                    </View>
                ) : (
                    <Text style={styles.title}>Đơn hàng của tôi</Text>
                )}
                <View style={styles.headerActions}>
                    {isSearchExpanded ? (
                        <>
                            <Pressable
                                style={[styles.iconButton, searchQuery.trim().length > 0 && styles.iconButtonActive]}
                                onPress={handleSearchSubmit}
                                disabled={isSearching || searchQuery.trim().length === 0}
                            >
                                <Ionicons
                                    name="search"
                                    size={18}
                                    color={searchQuery.trim().length > 0 ? '#fff' : '#9ca3af'}
                                />
                            </Pressable>
                            <Pressable style={styles.iconButton} onPress={handleClearAndClose}>
                                <Ionicons name="close" size={18} color="#111" />
                            </Pressable>
                        </>
                    ) : (
                        <>
                            <Pressable
                                style={[styles.iconButton, isSearchActive && styles.iconButtonActive]}
                                onPress={handleSearchToggle}
                            >
                                <Ionicons name="search" size={18} color={isSearchActive ? '#fff' : '#111'} />
                            </Pressable>
                            <Pressable style={styles.iconButton}>
                                <Ionicons name="options-outline" size={18} color="#111" />
                            </Pressable>
                        </>
                    )}
                </View>
            </View>

            {isSearchActive && !isSearchExpanded && (
                <View style={styles.searchResultBanner}>
                    <Ionicons name="search" size={14} color="#047857" />
                    <Text style={styles.searchResultText}>
                        Kết quả tìm kiếm cho đơn hàng #{searchQuery}
                    </Text>
                    <Pressable onPress={onClearSearch}>
                        <Text style={styles.searchResultClear}>Xóa</Text>
                    </Pressable>
                </View>
            )}

            {!isSearchActive && !isSearchExpanded && (
                <Text style={styles.subtitle}>
                    Theo dõi lịch sử đơn hàng, giao hàng và các hợp đồng thuê đang hoạt động tại đây.
                </Text>
            )}

            <View style={styles.filterRow}>
                {/* All button - always visible outside scroll */}
                <Pressable
                    style={[styles.filterChip, selectedFilter === 'All' && styles.filterChipSelected]}
                    onPress={() => onFilterChange('All')}
                >
                    <Text
                        style={[styles.filterLabel, selectedFilter === 'All' && styles.filterLabelSelected]}
                    >
                        Tất cả
                    </Text>
                </Pressable>

                {/* Status filters - horizontal scrollable */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterScrollContent}
                >
                    {ORDER_FILTERS.filter((f) => f !== 'All').map((filter) => {
                        const isSelected = selectedFilter === filter;
                        const label = FILTER_LABELS[filter] || filter;
                        return (
                            <Pressable
                                key={filter}
                                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                                onPress={() => onFilterChange(filter)}
                            >
                                <Text style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}>
                                    {label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>

            {errorMessage && ordersCount > 0 ? (
                <View style={styles.inlineErrorBanner}>
                    <Ionicons name="warning-outline" size={16} color="#b45309" />
                    <Text style={styles.inlineErrorText}>{errorMessage}</Text>
                    <Pressable onPress={onRetry}>
                        <Text style={styles.inlineErrorAction}>Thử lại</Text>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}

export const OrdersHeader = React.memo(OrdersHeaderComponent);
