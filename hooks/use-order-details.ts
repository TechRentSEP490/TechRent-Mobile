/**
 * useOrderDetails Hook
 * Manages order details modal data loading and caching
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchInvoicesByOrderId, type Invoice } from '@/services/invoices';
import { fetchRentalOrderById, type RentalOrderResponse } from '@/services/rental-orders';
import { fetchSettlementByOrderId } from '@/services/settlements';
import { useAuth } from '@/stores/auth-store';
import type { Settlement } from '@/types/settlements';

export interface UseOrderDetailsResult {
    // Modal state
    isVisible: boolean;
    targetOrderId: number | null;

    // Data
    orderData: RentalOrderResponse | null;
    invoices: Invoice[];
    settlement: Settlement | null;

    // Loading states
    isLoading: boolean;
    invoicesLoading: boolean;
    error: string | null;

    // Actions
    openDetails: (orderId: number) => void;
    closeDetails: () => void;
    retry: () => void;
}

export function useOrderDetails(): UseOrderDetailsResult {
    const { session, ensureSession } = useAuth();

    // Modal visibility
    const [isVisible, setIsVisible] = useState(false);
    const [targetOrderId, setTargetOrderId] = useState<number | null>(null);

    // Data
    const [orderData, setOrderData] = useState<RentalOrderResponse | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [settlement, setSettlement] = useState<Settlement | null>(null);

    // Loading states
    const [isLoading, setIsLoading] = useState(false);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs for caching and request tracking
    const cacheRef = useRef<Record<number, RentalOrderResponse>>({});
    const targetIdRef = useRef<number | null>(null);
    const activeRequestRef = useRef<{ orderId: number; cancelled: boolean } | null>(null);

    // Sync ref with state
    useEffect(() => {
        targetIdRef.current = targetOrderId;
    }, [targetOrderId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (activeRequestRef.current) {
                activeRequestRef.current.cancelled = true;
                activeRequestRef.current = null;
            }
        };
    }, []);

    const loadOrderDetails = useCallback(
        async (orderId: number, forceRefresh = false) => {
            if (!forceRefresh) {
                const cached = cacheRef.current[orderId];
                if (cached) {
                    setOrderData(cached);
                    setError(null);
                    setIsLoading(false);
                    return;
                }
            } else {
                delete cacheRef.current[orderId];
            }

            if (activeRequestRef.current) {
                activeRequestRef.current.cancelled = true;
            }

            const requestMarker = { orderId, cancelled: false };
            activeRequestRef.current = requestMarker;

            setOrderData(null);
            setError(null);
            setIsLoading(true);

            try {
                const activeSession = session?.accessToken ? session : await ensureSession();

                if (requestMarker.cancelled) return;

                if (!activeSession?.accessToken) {
                    throw new Error('You must be signed in to view this rental order.');
                }

                console.log('[OrderDetails] Loading rental order details', { orderId });

                const details = await fetchRentalOrderById(activeSession, orderId);

                if (requestMarker.cancelled || targetIdRef.current !== orderId) return;

                cacheRef.current[orderId] = details;
                setOrderData(details);
                setError(null);

                // Fetch invoices (non-blocking)
                setInvoicesLoading(true);
                fetchInvoicesByOrderId(activeSession, orderId)
                    .then((invoiceData) => {
                        if (targetIdRef.current === orderId) {
                            setInvoices(invoiceData);
                        }
                    })
                    .catch((err) => {
                        console.warn('[OrderDetails] Failed to load invoices', { orderId, err });
                    })
                    .finally(() => {
                        if (targetIdRef.current === orderId) {
                            setInvoicesLoading(false);
                        }
                    });

                // Fetch settlement (non-blocking)
                fetchSettlementByOrderId(activeSession, orderId)
                    .then((settlementData) => {
                        if (targetIdRef.current === orderId) {
                            setSettlement(settlementData);
                        }
                    })
                    .catch((err) => {
                        console.warn('[OrderDetails] Failed to load settlement', { orderId, err });
                    });
            } catch (err) {
                if (requestMarker.cancelled || targetIdRef.current !== orderId) return;

                console.error('[OrderDetails] Failed to load rental order details', { orderId, err });

                const fallbackMessage = 'Failed to load the rental order details. Please try again.';
                const normalizedError = err instanceof Error ? err : new Error(fallbackMessage);

                setOrderData(null);
                setError(
                    normalizedError.message && normalizedError.message.trim().length > 0
                        ? normalizedError.message
                        : fallbackMessage,
                );
            } finally {
                if (activeRequestRef.current === requestMarker) {
                    activeRequestRef.current = null;

                    if (targetIdRef.current === orderId) {
                        setIsLoading(false);
                    }
                }
            }
        },
        [ensureSession, session],
    );

    const openDetails = useCallback(
        (orderId: number) => {
            if (!Number.isFinite(orderId) || orderId <= 0) {
                console.warn('[OrderDetails] Invalid orderId', orderId);
                return;
            }

            setTargetOrderId(orderId);
            setIsVisible(true);
            targetIdRef.current = orderId;
            // Always force refresh to get latest status
            void loadOrderDetails(orderId, true);
        },
        [loadOrderDetails],
    );

    const closeDetails = useCallback(() => {
        if (activeRequestRef.current) {
            activeRequestRef.current.cancelled = true;
            activeRequestRef.current = null;
        }

        setIsVisible(false);
        setOrderData(null);
        setError(null);
        setTargetOrderId(null);
        setIsLoading(false);
        setInvoices([]);
        setInvoicesLoading(false);
        setSettlement(null);
        targetIdRef.current = null;
    }, []);

    const retry = useCallback(() => {
        if (targetOrderId) {
            void loadOrderDetails(targetOrderId, true);
        }
    }, [loadOrderDetails, targetOrderId]);

    return {
        // Modal state
        isVisible,
        targetOrderId,

        // Data
        orderData,
        invoices,
        settlement,

        // Loading states
        isLoading,
        invoicesLoading,
        error,

        // Actions
        openDetails,
        closeDetails,
        retry,
    };
}
