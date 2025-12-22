/**
 * Handover Reports API Service
 * For checkout (delivery) and checkin (return) handover reports
 */

import type {
    HandoverReport,
    HandoverReportListResponse,
    SendHandoverPinPayload,
    SignHandoverPayload,
} from '@/types/handover-reports';
import { buildApiUrl } from './api';

export type SessionCredentials = {
    accessToken: string;
    tokenType?: string | null;
};

const jsonHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
};

const buildAuthHeader = (session: SessionCredentials) => ({
    Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken}`,
});

const parseErrorMessage = async (response: Response): Promise<string | null> => {
    try {
        const json = (await response.json()) as Partial<{
            message: string;
            details: string;
            error: string;
        }>;
        return json?.message ?? json?.details ?? json?.error ?? null;
    } catch {
        return null;
    }
};

/**
 * Fetch all handover reports for a specific order
 * Uses /api/customers/handover-reports endpoint which returns all reports for the customer
 */
export async function fetchHandoverReportsByOrderId(
    session: SessionCredentials,
    orderId: number
): Promise<HandoverReport[]> {
    if (!session?.accessToken) {
        throw new Error('An access token is required to fetch handover reports.');
    }

    if (!Number.isFinite(orderId) || orderId <= 0) {
        throw new Error('A valid order ID is required.');
    }

    // Use the customer handover-reports endpoint with orderId directly
    const response = await fetch(buildApiUrl('customers', 'handover-reports', 'orders', orderId), {
        headers: {
            Accept: 'application/json',
            ...buildAuthHeader(session),
        },
    });

    if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        throw new Error(apiMessage ?? `Unable to fetch handover reports (status ${response.status}).`);
    }

    const json = (await response.json()) as HandoverReportListResponse | null;

    if (!json || json.status !== 'SUCCESS') {
        throw new Error(json?.message ?? 'Failed to fetch handover reports.');
    }

    return json.data ?? [];
}

/**
 * Fetch all handover reports for the current customer
 */
export async function fetchAllHandoverReports(
    session: SessionCredentials
): Promise<HandoverReport[]> {
    if (!session?.accessToken) {
        throw new Error('An access token is required to fetch handover reports.');
    }

    const response = await fetch(buildApiUrl('customers', 'handover-reports'), {
        headers: {
            Accept: 'application/json',
            ...buildAuthHeader(session),
        },
    });

    if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        throw new Error(apiMessage ?? `Unable to fetch handover reports (status ${response.status}).`);
    }

    const json = (await response.json()) as HandoverReportListResponse | null;

    if (!json || json.status !== 'SUCCESS') {
        throw new Error(json?.message ?? 'Failed to fetch handover reports.');
    }

    return json.data ?? [];
}

/**
 * Send PIN email for signing handover report
 */
export async function sendHandoverReportPin(
    session: SessionCredentials,
    reportId: number,
    payload: SendHandoverPinPayload
): Promise<void> {
    if (!session?.accessToken) {
        throw new Error('An access token is required.');
    }

    if (!Number.isFinite(reportId) || reportId <= 0) {
        throw new Error('A valid handover report ID is required.');
    }

    const response = await fetch(buildApiUrl('customers', 'handover-reports', reportId, 'pin'), {
        method: 'POST',
        headers: {
            ...jsonHeaders,
            ...buildAuthHeader(session),
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        throw new Error(apiMessage ?? `Unable to send PIN (status ${response.status}).`);
    }
}

/**
 * Sign handover report with PIN
 */
export async function signHandoverReport(
    session: SessionCredentials,
    reportId: number,
    payload: SignHandoverPayload
): Promise<HandoverReport> {
    if (!session?.accessToken) {
        throw new Error('An access token is required.');
    }

    if (!Number.isFinite(reportId) || reportId <= 0) {
        throw new Error('A valid handover report ID is required.');
    }

    const response = await fetch(buildApiUrl('customers', 'handover-reports', reportId, 'signature'), {
        method: 'PATCH',
        headers: {
            ...jsonHeaders,
            ...buildAuthHeader(session),
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        throw new Error(apiMessage ?? `Unable to sign handover report (status ${response.status}).`);
    }

    const json = (await response.json()) as { status: string; message?: string; data: HandoverReport | null } | null;

    if (!json || json.status !== 'SUCCESS' || !json.data) {
        throw new Error(json?.message ?? 'Failed to sign handover report.');
    }

    return json.data;
}

export const handoverReportsApi = {
    fetchHandoverReportsByOrderId,
    fetchAllHandoverReports,
    sendHandoverReportPin,
    signHandoverReport,
};

export default handoverReportsApi;
