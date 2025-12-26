/**
 * usePaymentFlow Hook
 * Manages payment creation and WebView handling
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { createPayment, type PaymentMethod, type PaymentSession } from '@/services/payments';
import { useAuth } from '@/stores/auth-store';
import type { OrderCard } from '@/types/orders';
import { buildPaymentUrl, PAYMENT_FAILURE_URL, PAYMENT_OPTIONS, PAYMENT_SUCCESS_URL } from '@/utils/order-utils';

export interface UsePaymentFlowResult {
    // Payment state
    selectedPayment: PaymentMethod;
    isCreatingPayment: boolean;
    paymentError: string | null;

    // WebView state
    isPaymentModalVisible: boolean;
    paymentCheckoutUrl: string | null;
    activePaymentSession: PaymentSession | null;
    paymentModalError: string | null;
    paymentWebViewKey: number;
    isPaymentWebViewLoading: boolean;
    paymentModalTitle: string;

    // Actions
    setSelectedPayment: (method: PaymentMethod) => void;
    handleSelectPayment: (method: PaymentMethod) => void;
    handleCreatePayment: (
        activeOrder: OrderCard,
        options?: { extensionId?: number; amount?: number; description?: string }
    ) => Promise<void>;
    handleClosePaymentModal: () => void;
    handleOpenPaymentInBrowser: () => Promise<void>;
    handlePaymentWebViewLoadStart: () => void;
    handlePaymentWebViewLoadEnd: () => void;
    handlePaymentWebViewError: (event: any) => void;
    handlePaymentWebViewHttpError: (event: any) => void;
    resetPaymentState: () => void;
}

export function usePaymentFlow(): UsePaymentFlowResult {
    const { session, ensureSession } = useAuth();

    // Payment state
    const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(PAYMENT_OPTIONS[0].id);
    const [isCreatingPayment, setIsCreatingPayment] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);

    // WebView state
    const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
    const [paymentCheckoutUrl, setPaymentCheckoutUrl] = useState<string | null>(null);
    const [activePaymentSession, setActivePaymentSession] = useState<PaymentSession | null>(null);
    const [paymentModalError, setPaymentModalError] = useState<string | null>(null);
    const [paymentWebViewKey, setPaymentWebViewKey] = useState(0);
    const [isPaymentWebViewLoading, setIsPaymentWebViewLoading] = useState(false);

    // Computed
    const paymentModalTitle = activePaymentSession?.orderCode
        ? `Checkout ${activePaymentSession.orderCode}`
        : 'Payment Checkout';

    // Effects for WebView state management
    useEffect(() => {
        if (paymentCheckoutUrl) {
            setPaymentModalError(null);
            setPaymentWebViewKey((prev) => prev + 1);
            setIsPaymentWebViewLoading(true);
        } else {
            setIsPaymentWebViewLoading(false);
        }
    }, [paymentCheckoutUrl]);

    useEffect(() => {
        if (!isPaymentModalVisible) {
            setIsPaymentWebViewLoading(false);
        }
    }, [isPaymentModalVisible]);

    useEffect(() => {
        if (paymentModalError) {
            setIsPaymentWebViewLoading(false);
        }
    }, [paymentModalError]);

    // Actions
    const handleSelectPayment = useCallback(
        (method: PaymentMethod) => {
            setSelectedPayment(method);
            if (paymentError) {
                setPaymentError(null);
            }
        },
        [paymentError],
    );

    const handleCreatePayment = useCallback(
        async (
            activeOrder: OrderCard,
            options?: { extensionId?: number; amount?: number; description?: string }
        ) => {
            if (!activeOrder) {
                Alert.alert('Payment unavailable', 'Select an order before continuing.');
                return;
            }

            if (isCreatingPayment) return;

            try {
                setIsCreatingPayment(true);
                setPaymentError(null);
                setPaymentModalError(null);

                const activeSession = session?.accessToken ? session : await ensureSession();
                if (!activeSession?.accessToken) {
                    throw new Error('You must be signed in to continue with payment.');
                }

                // Use provided amount (for extension) or order total due
                const paymentAmount = options?.amount ?? activeOrder.totalDue;

                const amount = Number.isFinite(paymentAmount) ? paymentAmount : 0;
                if (!Number.isFinite(amount) || amount <= 0) {
                    throw new Error('Unable to determine the payment amount.');
                }

                const description = options?.description ?? `Rent payment for order #${activeOrder.orderId}`;

                const payload = {
                    orderId: activeOrder.orderId,
                    extensionId: options?.extensionId,
                    invoiceType: 'RENT_PAYMENT' as const,
                    paymentMethod: selectedPayment,
                    amount,
                    description: description?.trim()?.length ? description.trim() : `Rent payment for order #${activeOrder.orderId}`,
                    frontendSuccessUrl: buildPaymentUrl(PAYMENT_SUCCESS_URL, activeOrder.orderId),
                    frontendFailureUrl: buildPaymentUrl(PAYMENT_FAILURE_URL, activeOrder.orderId),
                };

                console.log('[Payment] Creating payment session', {
                    orderId: activeOrder.orderId,
                    extensionId: payload.extensionId,
                    paymentMethod: payload.paymentMethod,
                    amount: payload.amount,
                });

                const paymentSession = await createPayment(payload, activeSession);

                console.log('[Payment] Session created', {
                    orderId: activeOrder.orderId,
                    checkoutUrl: paymentSession.checkoutUrl,
                    orderCode: paymentSession.orderCode,
                });

                const checkoutUrl = paymentSession.checkoutUrl ?? paymentSession.qrCodeUrl;
                if (!checkoutUrl) {
                    throw new Error('The payment provider did not return a checkout link.');
                }

                setActivePaymentSession(paymentSession);
                setPaymentCheckoutUrl(checkoutUrl);
                setPaymentModalVisible(true);
            } catch (error) {
                const fallbackMessage = 'Unable to create the payment link.';
                const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);

                console.error('[Payment] Failed to create session', { error });

                const message = normalizedError.message?.trim().length > 0
                    ? normalizedError.message
                    : fallbackMessage;

                setPaymentError(message);
                Alert.alert('Payment unavailable', message);
            } finally {
                setIsCreatingPayment(false);
            }
        },
        [ensureSession, isCreatingPayment, selectedPayment, session],
    );

    const handleClosePaymentModal = useCallback(() => {
        setPaymentModalVisible(false);
        setPaymentModalError(null);
    }, []);

    const handleOpenPaymentInBrowser = useCallback(async () => {
        if (!paymentCheckoutUrl) return;

        try {
            await Linking.openURL(paymentCheckoutUrl);
        } catch (error) {
            console.error('[Payment] Failed to open in browser', { url: paymentCheckoutUrl, error });
            Alert.alert('Unable to open link', 'Could not open the checkout page in the browser.');
        }
    }, [paymentCheckoutUrl]);

    const handlePaymentWebViewLoadStart = useCallback(() => {
        setIsPaymentWebViewLoading(true);
    }, []);

    const handlePaymentWebViewLoadEnd = useCallback(() => {
        setIsPaymentWebViewLoading(false);
    }, []);

    const handlePaymentWebViewError = useCallback((event: any) => {
        const { description, url, code } = event.nativeEvent ?? {};
        const baseMessage = description?.trim().length > 0
            ? description.trim()
            : 'An error occurred while loading the payment page.';
        const details: string[] = [];

        if (url) details.push(`URL: ${url}`);
        if (typeof code === 'number') details.push(`Code: ${code}`);

        const combined = details.length > 0 ? `${baseMessage} (${details.join(' · ')})` : baseMessage;
        setPaymentModalError(combined);
        setIsPaymentWebViewLoading(false);
    }, []);

    const handlePaymentWebViewHttpError = useCallback((event: any) => {
        const { statusCode, description, url } = event.nativeEvent ?? {};
        const parts: string[] = [];

        if (typeof statusCode === 'number') parts.push(`Status ${statusCode}`);
        if (description?.trim().length > 0) parts.push(description.trim());
        if (url) parts.push(`URL: ${url}`);

        const messageBase = typeof statusCode === 'number'
            ? 'The payment provider returned an unexpected response.'
            : 'A network error occurred.';
        const combined = parts.length > 0 ? `${messageBase} (${parts.join(' · ')})` : messageBase;

        setPaymentModalError(combined);
        setIsPaymentWebViewLoading(false);
    }, []);

    const resetPaymentState = useCallback(() => {
        setSelectedPayment(PAYMENT_OPTIONS[0].id);
        setIsCreatingPayment(false);
        setPaymentError(null);
        setPaymentModalVisible(false);
        setPaymentCheckoutUrl(null);
        setActivePaymentSession(null);
        setPaymentModalError(null);
    }, []);

    return {
        // Payment state
        selectedPayment,
        isCreatingPayment,
        paymentError,

        // WebView state
        isPaymentModalVisible,
        paymentCheckoutUrl,
        activePaymentSession,
        paymentModalError,
        paymentWebViewKey,
        isPaymentWebViewLoading,
        paymentModalTitle,

        // Actions
        setSelectedPayment,
        handleSelectPayment,
        handleCreatePayment,
        handleClosePaymentModal,
        handleOpenPaymentInBrowser,
        handlePaymentWebViewLoadStart,
        handlePaymentWebViewLoadEnd,
        handlePaymentWebViewError,
        handlePaymentWebViewHttpError,
        resetPaymentState,
    };
}
