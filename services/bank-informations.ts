/**
 * Bank Information Service
 * API functions for managing bank account information
 */

import { buildApiUrl } from './api';

export type SessionCredentials = {
    accessToken: string;
    tokenType?: string | null;
};

export type BankInformation = {
    bankInformationId: number;
    bankName: string;
    bankHolder: string;
    cardNumber: string;
    customerId: number;
    createdAt: string | null;
    updatedAt: string | null;
};

type BankInformationResponse = {
    status: string;
    message?: string;
    details?: string;
    code: number;
    data: BankInformation | null;
};

type BankInformationListResponse = {
    status: string;
    message?: string;
    details?: string;
    code: number;
    data: BankInformation[] | null;
};

export type CreateBankInformationPayload = {
    bankName: string;
    bankHolder: string;
    cardNumber: string;
};

export type UpdateBankInformationPayload = {
    bankName: string;
    bankHolder: string;
    cardNumber: string;
};

const jsonHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
};

const buildAuthHeader = (session: SessionCredentials) =>
    `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken}`;

const parseErrorMessage = async (response: Response) => {
    try {
        const json = (await response.json()) as Partial<{
            message: string;
            details: string;
            error: string;
        }>;

        return json?.message ?? json?.details ?? json?.error ?? null;
    } catch (error) {
        console.warn('Failed to parse bank information error response', error);
        return null;
    }
};

const normalizeBankInformation = (data: Partial<BankInformation> | null | undefined): BankInformation | null => {
    if (!data) {
        return null;
    }

    const id = Number(data.bankInformationId);
    const customerId = Number(data.customerId);
    const bankName = typeof data.bankName === 'string' ? data.bankName.trim() : '';
    const bankHolder = typeof data.bankHolder === 'string' ? data.bankHolder.trim() : '';
    const cardNumber = typeof data.cardNumber === 'string' ? data.cardNumber.trim() : '';

    if (!Number.isFinite(id) || id <= 0 || bankName.length === 0 || cardNumber.length === 0) {
        return null;
    }

    return {
        bankInformationId: id,
        bankName,
        bankHolder,
        cardNumber,
        customerId: Number.isFinite(customerId) && customerId > 0 ? customerId : 0,
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    };
};

/**
 * Fetch all bank information for the current user
 */
export async function fetchBankInformations(session: SessionCredentials): Promise<BankInformation[]> {
    if (!session?.accessToken) {
        throw new Error('Bạn cần đăng nhập để xem thông tin ngân hàng.');
    }

    const response = await fetch(buildApiUrl('bank-informations'), {
        headers: {
            Accept: 'application/json',
            Authorization: buildAuthHeader(session),
        },
    });

    if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        throw new Error(apiMessage ?? `Không thể tải thông tin ngân hàng (mã lỗi ${response.status}).`);
    }

    const json = (await response.json()) as BankInformationListResponse | null;

    if (!json || json.status !== 'SUCCESS' || !Array.isArray(json.data)) {
        throw new Error(json?.message ?? 'Không thể tải thông tin ngân hàng. Vui lòng thử lại.');
    }

    return json.data
        .map((item) => normalizeBankInformation(item) ?? null)
        .filter((value): value is BankInformation => value !== null);
}

/**
 * Create a new bank information entry
 */
export async function createBankInformation(
    payload: CreateBankInformationPayload,
    session: SessionCredentials,
): Promise<BankInformation> {
    if (!session?.accessToken) {
        throw new Error('Bạn cần đăng nhập để thêm thông tin ngân hàng.');
    }

    const response = await fetch(buildApiUrl('bank-informations'), {
        method: 'POST',
        headers: {
            ...jsonHeaders,
            Authorization: buildAuthHeader(session),
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        throw new Error(apiMessage ?? `Không thể thêm thông tin ngân hàng (mã lỗi ${response.status}).`);
    }

    const json = (await response.json()) as BankInformationResponse | null;

    if (!json || json.status !== 'SUCCESS' || !json.data) {
        throw new Error(json?.message ?? 'Không thể thêm thông tin ngân hàng. Vui lòng thử lại.');
    }

    const normalized = normalizeBankInformation(json.data);

    if (!normalized) {
        throw new Error('Dữ liệu trả về từ máy chủ không hợp lệ.');
    }

    return normalized;
}

/**
 * Update an existing bank information entry
 */
export async function updateBankInformation(
    id: number,
    payload: UpdateBankInformationPayload,
    session: SessionCredentials,
): Promise<BankInformation> {
    if (!session?.accessToken) {
        throw new Error('Bạn cần đăng nhập để cập nhật thông tin ngân hàng.');
    }

    if (!Number.isFinite(id) || id <= 0) {
        throw new Error('ID thông tin ngân hàng không hợp lệ.');
    }

    const response = await fetch(buildApiUrl(`bank-informations/${id}`), {
        method: 'PUT',
        headers: {
            ...jsonHeaders,
            Authorization: buildAuthHeader(session),
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const apiMessage = await parseErrorMessage(response);
        throw new Error(apiMessage ?? `Không thể cập nhật thông tin ngân hàng (mã lỗi ${response.status}).`);
    }

    const json = (await response.json()) as BankInformationResponse | null;

    if (!json || json.status !== 'SUCCESS' || !json.data) {
        throw new Error(json?.message ?? 'Không thể cập nhật thông tin ngân hàng. Vui lòng thử lại.');
    }

    const normalized = normalizeBankInformation(json.data);

    if (!normalized) {
        throw new Error('Dữ liệu trả về từ máy chủ không hợp lệ.');
    }

    return normalized;
}

/**
 * Delete a bank information entry
 */
export async function deleteBankInformation(id: number, session: SessionCredentials): Promise<void> {
    if (!session?.accessToken) {
        throw new Error('Bạn cần đăng nhập để xóa thông tin ngân hàng.');
    }

    if (!Number.isFinite(id) || id <= 0) {
        throw new Error('ID thông tin ngân hàng không hợp lệ.');
    }

    const response = await fetch(buildApiUrl(`bank-informations/${id}`), {
        method: 'DELETE',
        headers: {
            Accept: 'application/json',
            Authorization: buildAuthHeader(session),
        },
    });

    if (!response.ok && response.status !== 204) {
        const apiMessage = await parseErrorMessage(response);
        throw new Error(apiMessage ?? `Không thể xóa thông tin ngân hàng (mã lỗi ${response.status}).`);
    }
}

export { normalizeBankInformation };
