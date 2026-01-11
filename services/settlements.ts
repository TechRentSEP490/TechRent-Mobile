/**
 * Settlements API Service
 * For deposit refund after rental return
 */

import type { RespondSettlementPayload, Settlement, SettlementResponse } from '@/types/settlements';
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
 * Fetch settlement for a specific order
 */
export async function fetchSettlementByOrderId(
    session: SessionCredentials,
    orderId: number
): Promise<Settlement | null> {
    if (!session?.accessToken) {
        throw new Error('An access token is required to fetch settlement.');
    }

    if (!Number.isFinite(orderId) || orderId <= 0) {
        throw new Error('A valid order ID is required.');
    }

    const response = await fetch(buildApiUrl('settlements', 'order', orderId), {
        headers: {
            Accept: 'application/json',
            ...buildAuthHeader(session),
        },
    });

    // 404 means no settlement yet - not an error
    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        throw new Error(apiMessage ?? `Unable to fetch settlement (status ${response.status}).`);
    }

    const json = (await response.json()) as SettlementResponse | null;

    if (!json || json.status !== 'SUCCESS') {
        // No settlement is not an error
        if (json?.message?.toLowerCase().includes('not found')) {
            return null;
        }
        throw new Error(json?.message ?? 'Failed to fetch settlement.');
    }

    return json.data ?? null;
}

/**
 * Respond to settlement (accept or reject)
 */
export async function respondSettlement(
    session: SessionCredentials,
    settlementId: number,
    accepted: boolean,
    customerNote?: string
): Promise<Settlement> {
    if (!session?.accessToken) {
        throw new Error('An access token is required.');
    }

    if (!Number.isFinite(settlementId) || settlementId <= 0) {
        throw new Error('A valid settlement ID is required.');
    }

    const payload: RespondSettlementPayload = {
        accepted,
        customerNote,
    };

    const response = await fetch(buildApiUrl('settlements', settlementId, 'respond'), {
        method: 'POST',
        headers: {
            ...jsonHeaders,
            ...buildAuthHeader(session),
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        throw new Error(apiMessage ?? `Unable to respond to settlement (status ${response.status}).`);
    }

    const json = (await response.json()) as SettlementResponse | null;

    if (!json || json.status !== 'SUCCESS' || !json.data) {
        throw new Error(json?.message ?? 'Failed to respond to settlement.');
    }

    return json.data;
}

export const settlementsApi = {
    fetchSettlementByOrderId,
    respondSettlement,
};

export default settlementsApi;
