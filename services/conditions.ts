/**
 * Condition Definitions API Service
 * Fetch condition definitions for handover reports
 */

import { buildApiUrl } from './api';

export type SessionCredentials = {
    accessToken: string;
    tokenType?: string | null;
};

export type ConditionDefinitionResponse = {
    conditionDefinitionId: number;
    id?: number;
    name: string;
    description?: string;
    penaltyPercentage?: number;
};

type ApiResponse<T> = {
    status: string;
    message?: string;
    code?: number;
    data: T | null;
};

const buildAuthHeader = (session: SessionCredentials) => ({
    Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken}`,
});

/**
 * Fetch all condition definitions
 * GET /api/conditions/definitions
 */
export async function getConditionDefinitions(
    session: SessionCredentials
): Promise<ConditionDefinitionResponse[]> {
    if (!session?.accessToken) {
        throw new Error('An access token is required to fetch condition definitions.');
    }

    const response = await fetch(buildApiUrl('conditions', 'definitions'), {
        headers: {
            Accept: 'application/json',
            ...buildAuthHeader(session),
        },
    });

    if (!response.ok) {
        // Try to get error message from response
        try {
            const errorJson = await response.json();
            throw new Error(errorJson?.message || `Unable to fetch condition definitions (status ${response.status}).`);
        } catch {
            throw new Error(`Unable to fetch condition definitions (status ${response.status}).`);
        }
    }

    const json = await response.json() as ApiResponse<ConditionDefinitionResponse[]> | ConditionDefinitionResponse[] | null;

    // Handle different response formats
    if (Array.isArray(json)) {
        return json;
    }

    if (json && typeof json === 'object' && 'data' in json) {
        return json.data ?? [];
    }

    return [];
}

export const conditionApi = {
    getConditionDefinitions,
};

export default conditionApi;
