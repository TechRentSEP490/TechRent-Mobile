/**
 * useOrdersData Hook
 * Manages the orders list data fetching, filtering, and pagination
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList } from 'react-native';

import { fetchContracts, type ContractResponse } from '@/services/contracts';
import { fetchDeviceModelById } from '@/services/device-models';
import { fetchRentalOrders, searchRentalOrders, type RentalOrderResponse } from '@/services/rental-orders';
import { useAuth } from '@/stores/auth-store';
import type { DeviceLookupEntry, OrderCard, OrderStatusFilter } from '@/types/orders';
import {
    ITEMS_PER_PAGE,
    mapOrderResponseToCard,
    type ApiErrorWithStatus,
} from '@/utils/order-utils';

export interface UseOrdersDataResult {
    // Data
    orders: OrderCard[];
    filteredOrders: OrderCard[];
    displayedOrders: OrderCard[];
    contractsByOrderId: Record<string, ContractResponse>;
    deviceDetailsLookup: Record<string, DeviceLookupEntry>;

    // State
    selectedFilter: OrderStatusFilter;
    highlightedOrderId: string | null;
    isLoading: boolean;
    isRefreshing: boolean;
    errorMessage: string | null;
    hasMoreToShow: boolean;

    // Search state
    searchQuery: string;
    isSearching: boolean;
    isSearchActive: boolean;
    isSearchExpanded: boolean;

    // Refs
    listRef: React.RefObject<FlatList<OrderCard> | null>;

    // Actions
    setSelectedFilter: (filter: OrderStatusFilter) => void;
    setHighlightedOrderId: (id: string | null) => void;
    loadOrders: (mode?: 'initial' | 'refresh') => Promise<void>;
    handleRefresh: () => void;
    handleRetry: () => void;
    handleLoadMore: () => void;

    // Search actions
    setSearchQuery: (query: string) => void;
    searchOrders: () => Promise<void>;
    clearSearch: () => void;
    setSearchExpanded: (expanded: boolean) => void;
}

export function useOrdersData(): UseOrdersDataResult {
    const { session, ensureSession } = useAuth();
    const listRef = useRef<FlatList<OrderCard>>(null);

    // Core data
    const [orders, setOrders] = useState<OrderCard[]>([]);
    const [contractsByOrderId, setContractsByOrderId] = useState<Record<string, ContractResponse>>({});
    const [deviceDetailsLookup, setDeviceDetailsLookup] = useState<Record<string, DeviceLookupEntry>>({});

    // Filter & display
    const [selectedFilter, setSelectedFilter] = useState<OrderStatusFilter>('All');
    const [displayLimit, setDisplayLimit] = useState(ITEMS_PER_PAGE);
    const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

    // Loading states
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Search states
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchResults, setSearchResults] = useState<OrderCard[] | null>(null);
    const [isSearchExpanded, setSearchExpanded] = useState(false);

    // Computed values
    const filteredOrders = useMemo(() => {
        // If search is active, use search results
        if (isSearchActive && searchResults !== null) {
            if (selectedFilter === 'All') {
                return searchResults;
            }
            const isSpecificStatus = selectedFilter === selectedFilter.toUpperCase() || selectedFilter.includes('_');
            if (isSpecificStatus) {
                return searchResults.filter((order) => order.rawStatus === selectedFilter);
            }
            return searchResults.filter((order) => order.statusFilter === selectedFilter);
        }

        if (selectedFilter === 'All') {
            return orders;
        }

        const isSpecificStatus = selectedFilter === selectedFilter.toUpperCase() || selectedFilter.includes('_');

        if (isSpecificStatus) {
            return orders.filter((order) => order.rawStatus === selectedFilter);
        }

        return orders.filter((order) => order.statusFilter === selectedFilter);
    }, [orders, selectedFilter, isSearchActive, searchResults]);

    const displayedOrders = useMemo(() => {
        return filteredOrders.slice(0, displayLimit);
    }, [filteredOrders, displayLimit]);

    const hasMoreToShow = filteredOrders.length > displayLimit;

    // Reset display limit when filter changes
    useEffect(() => {
        setDisplayLimit(ITEMS_PER_PAGE);
    }, [selectedFilter]);

    // Clear highlight after timeout
    useEffect(() => {
        if (!highlightedOrderId) {
            return;
        }

        const timeout = setTimeout(() => {
            setHighlightedOrderId(null);
        }, 4000);

        return () => {
            clearTimeout(timeout);
        };
    }, [highlightedOrderId]);

    const loadOrders = useCallback(
        async (mode: 'initial' | 'refresh' = 'initial') => {
            if (mode === 'refresh') {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }

            try {
                const activeSession = session?.accessToken ? session : await ensureSession();

                if (!activeSession?.accessToken) {
                    setOrders([]);
                    setErrorMessage('You must be signed in to view your rental orders.');
                    return;
                }

                const response = await fetchRentalOrders(activeSession);
                const deviceDetailsMap = new Map<string, DeviceLookupEntry>();
                const uniqueDeviceModelIds = new Set<string>();

                response.forEach((order) => {
                    order.orderDetails?.forEach((detail) => {
                        if (detail?.deviceModelId) {
                            uniqueDeviceModelIds.add(String(detail.deviceModelId));
                        }
                    });
                });

                if (uniqueDeviceModelIds.size > 0) {
                    await Promise.all(
                        Array.from(uniqueDeviceModelIds).map(async (id) => {
                            try {
                                const device = await fetchDeviceModelById(id);
                                if (device) {
                                    const label = device.name?.trim().length ? device.name : device.model;
                                    const normalizedName =
                                        label && label.trim().length > 0 ? label.trim() : `Device Model ${id}`;
                                    deviceDetailsMap.set(id, {
                                        name: normalizedName,
                                        imageURL: device.imageURL?.trim() ?? null,
                                    });
                                }
                            } catch (deviceError) {
                                console.warn(`Failed to load device model ${id} for rental orders`, deviceError);
                            }
                        }),
                    );
                }

                let contractLookup: Record<string, ContractResponse> = {};

                try {
                    const contracts = await fetchContracts(activeSession);
                    contractLookup = contracts.reduce<Record<string, ContractResponse>>((accumulator, contract) => {
                        if (typeof contract?.orderId === 'number') {
                            accumulator[String(contract.orderId)] = contract;
                        }
                        return accumulator;
                    }, {});
                } catch (contractError) {
                    console.warn('Failed to load contracts for rental orders', contractError);
                    contractLookup = {};
                }

                const sorted = [...response].sort((a, b) => {
                    const aTime = new Date(a.createdAt ?? a.startDate).getTime();
                    const bTime = new Date(b.createdAt ?? b.startDate).getTime();

                    if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
                        return 0;
                    }
                    if (Number.isNaN(aTime)) {
                        return 1;
                    }
                    if (Number.isNaN(bTime)) {
                        return -1;
                    }

                    return bTime - aTime;
                });

                const deviceDetailsRecord: Record<string, DeviceLookupEntry> = {};
                deviceDetailsMap.forEach((details, key) => {
                    deviceDetailsRecord[key] = details;
                });

                setOrders(
                    sorted.map((order) =>
                        mapOrderResponseToCard(order, deviceDetailsMap, contractLookup[String(order.orderId)]),
                    ),
                );
                setContractsByOrderId(contractLookup);
                setDeviceDetailsLookup(deviceDetailsRecord);
                setErrorMessage(null);
            } catch (error) {
                const fallbackMessage = 'Failed to load rental orders. Please try again.';
                const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);
                const status = (normalizedError as ApiErrorWithStatus).status;

                if (status === 401) {
                    setOrders([]);
                    setErrorMessage('Your session has expired. Please sign in again to view your rental orders.');
                } else {
                    const message =
                        normalizedError.message && normalizedError.message.trim().length > 0
                            ? normalizedError.message
                            : fallbackMessage;
                    setErrorMessage(message);
                }
            } finally {
                if (mode === 'refresh') {
                    setIsRefreshing(false);
                } else {
                    setIsLoading(false);
                }
            }
        },
        [ensureSession, session],
    );

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const handleRefresh = useCallback(() => {
        loadOrders('refresh');
    }, [loadOrders]);

    const handleRetry = useCallback(() => {
        loadOrders('initial');
    }, [loadOrders]);

    const handleLoadMore = useCallback(() => {
        setDisplayLimit((prev) => prev + ITEMS_PER_PAGE);
    }, []);

    // Search orders by orderId
    const searchOrders = useCallback(async () => {
        const orderId = parseInt(searchQuery.trim(), 10);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            setErrorMessage('Vui lòng nhập mã đơn hàng hợp lệ');
            return;
        }

        setIsSearching(true);
        setErrorMessage(null);

        try {
            const activeSession = session?.accessToken ? session : await ensureSession();

            if (!activeSession?.accessToken) {
                setErrorMessage('Bạn cần đăng nhập để tìm kiếm đơn hàng.');
                return;
            }

            // Map selectedFilter to API status format
            let orderStatus: string | undefined;
            if (selectedFilter !== 'All') {
                // If it's a specific status like PENDING_KYC, use it directly
                const isSpecificStatus = selectedFilter === selectedFilter.toUpperCase() || selectedFilter.includes('_');
                if (isSpecificStatus) {
                    orderStatus = selectedFilter;
                }
                // For category filters like 'Pending', we don't filter by status in API (client-side filter)
            }

            const result = await searchRentalOrders(activeSession, {
                orderId,
                orderStatus,
                page: 0,
                size: 20,
            });

            // Convert response to OrderCard format
            const deviceDetailsMap = new Map<string, DeviceLookupEntry>();
            Object.entries(deviceDetailsLookup).forEach(([key, value]) => {
                deviceDetailsMap.set(key, value);
            });

            const searchResultCards = result.content.map((order: RentalOrderResponse) =>
                mapOrderResponseToCard(order, deviceDetailsMap, contractsByOrderId[String(order.orderId)]),
            );

            setSearchResults(searchResultCards);
            setIsSearchActive(true);

            if (searchResultCards.length === 0) {
                setErrorMessage(`Không tìm thấy đơn hàng #${orderId}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi khi tìm kiếm đơn hàng';
            setErrorMessage(message);
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, selectedFilter, session, ensureSession, deviceDetailsLookup, contractsByOrderId]);

    // Clear search and return to normal view
    const clearSearch = useCallback(() => {
        setSearchQuery('');
        setSearchResults(null);
        setIsSearchActive(false);
        setErrorMessage(null);
    }, []);

    return {
        // Data
        orders,
        filteredOrders,
        displayedOrders,
        contractsByOrderId,
        deviceDetailsLookup,

        // State
        selectedFilter,
        highlightedOrderId,
        isLoading,
        isRefreshing,
        errorMessage,
        hasMoreToShow,

        // Search state
        searchQuery,
        isSearching,
        isSearchActive,
        isSearchExpanded,

        // Refs
        listRef,

        // Actions
        setSelectedFilter,
        setHighlightedOrderId,
        loadOrders,
        handleRefresh,
        handleRetry,
        handleLoadMore,

        // Search actions
        setSearchQuery,
        searchOrders,
        clearSearch,
        setSearchExpanded,
    };
}
