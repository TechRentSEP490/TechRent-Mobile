/**
 * Handover Report Hooks
 * Custom hooks for customer handover report operations
 */

import {
    fetchHandoverReportsByOrderId,
    sendHandoverReportPin,
    signHandoverReport,
} from '@/services/handover-reports';
import { useAuthStore } from '@/stores/auth-store';
import type { HandoverReport } from '@/types/handover-reports';
import { useCallback, useEffect, useState } from 'react';

// ==========================================
// Customer Hooks
// ==========================================

type UseHandoverReportsResult = {
    data: HandoverReport[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
};

/**
 * Fetch customer handover reports by order ID
 */
export function useCustomerHandoverReports(orderId: number | undefined): UseHandoverReportsResult {
    const { session } = useAuthStore();
    const [data, setData] = useState<HandoverReport[]>([]);
    const [loading, setLoading] = useState<boolean>(Boolean(orderId));
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!orderId || !session?.accessToken) {
            setData([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const reports = await fetchHandoverReportsByOrderId(session, orderId);
            setData(reports);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to load handover reports.';
            setError(message);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [orderId, session]);

    useEffect(() => {
        void load();
    }, [load]);

    return { data, loading, error, refetch: load };
}

type UseSendPinResult = {
    sending: boolean;
    error: string | null;
    sendPin: (reportId: number, email: string) => Promise<boolean>;
};

/**
 * Send PIN for customer to sign handover report
 */
export function useCustomerSendPin(): UseSendPinResult {
    const { session } = useAuthStore();
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendPin = useCallback(async (reportId: number, email: string): Promise<boolean> => {
        if (!session?.accessToken) {
            setError('Not authenticated');
            return false;
        }

        setSending(true);
        setError(null);

        try {
            await sendHandoverReportPin(session, reportId, { email });
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to send PIN.';
            setError(message);
            return false;
        } finally {
            setSending(false);
        }
    }, [session]);

    return { sending, error, sendPin };
}

type UseSignReportResult = {
    signing: boolean;
    error: string | null;
    sign: (reportId: number, pinCode: string, signature: string) => Promise<HandoverReport | null>;
};

/**
 * Customer sign handover report
 */
export function useCustomerSignReport(): UseSignReportResult {
    const { session } = useAuthStore();
    const [signing, setSigning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sign = useCallback(async (
        reportId: number,
        pinCode: string,
        signature: string
    ): Promise<HandoverReport | null> => {
        if (!session?.accessToken) {
            setError('Not authenticated');
            return null;
        }

        setSigning(true);
        setError(null);

        try {
            const result = await signHandoverReport(session, reportId, {
                pinCode,
                customerSignature: signature
            });
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to sign report.';
            setError(message);
            return null;
        } finally {
            setSigning(false);
        }
    }, [session]);

    return { signing, error, sign };
}

// ==========================================
// Utility Functions
// ==========================================

/**
 * Filter checkin reports from a list
 */
export function filterCheckinReports(reports: HandoverReport[]): HandoverReport[] {
    return reports.filter(r => r.handoverType === 'CHECKIN');
}

/**
 * Filter checkout reports from a list
 */
export function filterCheckoutReports(reports: HandoverReport[]): HandoverReport[] {
    return reports.filter(r => r.handoverType === 'CHECKOUT');
}
