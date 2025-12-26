/**
 * Contract Annex Service
 * API functions for contract annexes (phụ lục hợp đồng)
 */

import type { ContractAnnex } from '@/types/annexes';
import { buildApiUrl, fetchWithRetry } from './api';

type SessionCredentials = {
    accessToken: string;
    tokenType?: string | null;
};

type ApiErrorWithStatus = Error & { status?: number };

type FetchAnnexesResult = {
    status: string;
    message: string;
    details: string;
    code: number;
    data: ContractAnnex[] | null;
};

type SendAnnexPinResult = {
    status: string;
    message: string;
    details: string;
    code: number;
    data: unknown;
};

type SignAnnexResult = {
    status: string;
    message: string;
    details: string;
    code: number;
    data: unknown;
};

const parseErrorMessage = async (response: Response) => {
    try {
        const json = (await response.json()) as Partial<{
            message: string;
            details: string;
            error: string;
        }>;

        return json?.message ?? json?.details ?? json?.error ?? null;
    } catch (error) {
        console.warn('Failed to parse annex error response', error);
        return null;
    }
};

/**
 * Fetch all annexes for a contract
 * GET /api/contracts/{contractId}/annexes
 */
export async function fetchAnnexesByContract(
    session: SessionCredentials,
    contractId: number,
): Promise<ContractAnnex[]> {
    if (!session?.accessToken) {
        throw new Error('An access token is required to load contract annexes.');
    }

    if (!Number.isInteger(contractId) || contractId <= 0) {
        throw new Error('A valid contract identifier is required.');
    }

    const endpointUrl = buildApiUrl('contracts', contractId, 'annexes');
    let response: Response;

    try {
        response = await fetchWithRetry(
            endpointUrl,
            {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken
                        }`,
                },
            },
            {
                onRetry: (nextUrl, networkError) => {
                    console.warn('Failed to reach annexes endpoint, retrying with HTTPS', networkError, {
                        retryUrl: nextUrl,
                    });
                },
            },
        );
    } catch (networkError) {
        console.warn('Failed to reach annexes endpoint', networkError);
        throw networkError;
    }

    if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        const error = new Error(
            apiMessage ?? `Unable to load contract annexes (status ${response.status}).`,
        ) as ApiErrorWithStatus;
        error.status = response.status;
        throw error;
    }

    const json = (await response.json()) as FetchAnnexesResult | null;

    if (!json || json.status !== 'SUCCESS' || !Array.isArray(json.data)) {
        const error = new Error(
            json?.message ?? 'Failed to load contract annexes. Please try again.',
        ) as ApiErrorWithStatus;
        if (typeof json?.code === 'number') {
            error.status = json.code;
        }
        throw error;
    }

    return json.data;
}

/**
 * Send PIN to email for annex signing
 * POST /api/contracts/{contractId}/annexes/{annexId}/send-pin/email
 */
export async function sendAnnexPin(
    session: SessionCredentials,
    contractId: number,
    annexId: number,
    email: string,
): Promise<SendAnnexPinResult> {
    if (!session?.accessToken) {
        throw new Error('An access token is required to request a verification code.');
    }

    if (!Number.isInteger(contractId) || contractId <= 0) {
        throw new Error('A valid contract identifier is required.');
    }

    if (!Number.isInteger(annexId) || annexId <= 0) {
        throw new Error('A valid annex identifier is required.');
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0) {
        throw new Error('An email address is required to send the verification code.');
    }

    const endpointUrl = buildApiUrl('contracts', contractId, 'annexes', annexId, 'send-pin', 'email');
    let response: Response;

    try {
        response = await fetchWithRetry(
            endpointUrl,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken
                        }`,
                },
                body: JSON.stringify({ email: trimmedEmail }),
            },
            {
                onRetry: (nextUrl, networkError) => {
                    console.warn('Failed to reach annex PIN endpoint, retrying with HTTPS', networkError, {
                        retryUrl: nextUrl,
                    });
                },
            },
        );
    } catch (networkError) {
        console.warn('Failed to reach annex PIN endpoint', networkError);
        throw networkError;
    }

    if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        const error = new Error(
            apiMessage ?? `Unable to request verification code (status ${response.status}).`,
        ) as ApiErrorWithStatus;
        error.status = response.status;
        throw error;
    }

    const json = (await response.json()) as SendAnnexPinResult | null;

    if (!json || json.status !== 'SUCCESS') {
        const error = new Error(
            json?.message ?? 'Failed to send the verification code. Please try again.',
        ) as ApiErrorWithStatus;
        if (typeof json?.code === 'number') {
            error.status = json.code;
        }
        throw error;
    }

    return json;
}

type SignAnnexPayload = {
    digitalSignature: string;
    signatureMethod: string;
    pinCode: string;
    deviceInfo?: string;
    ipAddress?: string;
};

/**
 * Sign annex as customer
 * POST /api/contracts/{contractId}/annexes/{annexId}/sign/customer
 */
export async function signAnnex(
    session: SessionCredentials,
    contractId: number,
    annexId: number,
    pinCode: string,
): Promise<SignAnnexResult> {
    if (!session?.accessToken) {
        throw new Error('An access token is required to sign the annex.');
    }

    if (!Number.isInteger(contractId) || contractId <= 0) {
        throw new Error('A valid contract identifier is required.');
    }

    if (!Number.isInteger(annexId) || annexId <= 0) {
        throw new Error('A valid annex identifier is required.');
    }

    if (!pinCode || pinCode.trim().length === 0) {
        throw new Error('A verification code is required to sign the annex.');
    }

    const payload: SignAnnexPayload = {
        digitalSignature: pinCode,
        signatureMethod: 'EMAIL_OTP',
        pinCode: pinCode.trim(),
    };

    const endpointUrl = buildApiUrl('contracts', contractId, 'annexes', annexId, 'sign', 'customer');

    console.log('[Annexes] signAnnex request', {
        endpointUrl,
        contractId,
        annexId,
    });

    let response: Response;

    try {
        response = await fetchWithRetry(
            endpointUrl,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken
                        }`,
                },
                body: JSON.stringify(payload),
            },
            {
                onRetry: (nextUrl, networkError) => {
                    console.warn('Failed to reach annex signing endpoint, retrying with HTTPS', networkError, {
                        retryUrl: nextUrl,
                    });
                },
            },
        );
    } catch (networkError) {
        console.warn('Failed to reach annex signing endpoint', networkError);
        throw networkError;
    }

    if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        const error = new Error(
            apiMessage ?? `Unable to sign the annex (status ${response.status}).`,
        ) as ApiErrorWithStatus;
        error.status = response.status;
        throw error;
    }

    const json = (await response.json()) as SignAnnexResult | null;

    if (!json || json.status !== 'SUCCESS') {
        const error = new Error(
            json?.message ?? 'Failed to sign the annex. Please try again.',
        ) as ApiErrorWithStatus;
        if (typeof json?.code === 'number') {
            error.status = json.code;
        }
        throw error;
    }

    return json;
}
