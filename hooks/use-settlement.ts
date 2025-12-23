/**
 * Settlement Hooks
 * Custom hooks for settlement operations (deposit refund after rental return)
 */

import {
    fetchSettlementByOrderId,
    respondSettlement,
} from '@/services/settlements';
import { useAuthStore } from '@/stores/auth-store';
import type { Settlement } from '@/types/settlements';
import { useCallback, useEffect, useState } from 'react';

// ==========================================
// Settlement Query Hooks
// ==========================================

type UseSettlementResult = {
    data: Settlement | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
};

/**
 * Fetch settlement by order ID
 * Returns null if no settlement exists yet (not an error)
 */
export function useSettlementByOrder(orderId: number | undefined): UseSettlementResult {
    const { session } = useAuthStore();
    const [data, setData] = useState<Settlement | null>(null);
    const [loading, setLoading] = useState<boolean>(Boolean(orderId));
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!orderId || !session?.accessToken) {
            setData(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const settlement = await fetchSettlementByOrderId(session, orderId);
            setData(settlement);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to load settlement.';
            setError(message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [orderId, session]);

    useEffect(() => {
        void load();
    }, [load]);

    return { data, loading, error, refetch: load };
}

// ==========================================
// Settlement Mutation Hooks
// ==========================================

type UseRespondSettlementResult = {
    responding: boolean;
    error: string | null;
    respond: (settlementId: number, accepted: boolean, customerNote?: string) => Promise<Settlement | null>;
    accept: (settlementId: number) => Promise<Settlement | null>;
    reject: (settlementId: number, reason: string) => Promise<Settlement | null>;
};

/**
 * Respond to settlement (accept or reject)
 * 
 * Usage:
 * - accept(id): Customer accepts the settlement
 * - reject(id, reason): Customer rejects with a note
 * - respond(id, accepted, note): Generic respond method
 */
export function useRespondSettlement(): UseRespondSettlementResult {
    const { session } = useAuthStore();
    const [responding, setResponding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const respond = useCallback(async (
        settlementId: number,
        accepted: boolean,
        customerNote?: string
    ): Promise<Settlement | null> => {
        if (!session?.accessToken) {
            setError('Not authenticated');
            return null;
        }

        setResponding(true);
        setError(null);

        try {
            const result = await respondSettlement(session, settlementId, accepted, customerNote);
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to respond to settlement.';
            setError(message);
            return null;
        } finally {
            setResponding(false);
        }
    }, [session]);

    const accept = useCallback(async (settlementId: number): Promise<Settlement | null> => {
        return respond(settlementId, true);
    }, [respond]);

    const reject = useCallback(async (settlementId: number, reason: string): Promise<Settlement | null> => {
        return respond(settlementId, false, reason);
    }, [respond]);

    return { responding, error, respond, accept, reject };
}

// ==========================================
// Combined Settlement Hook
// ==========================================

type UseSettlementWithActionsResult = UseSettlementResult & {
    responding: boolean;
    respondError: string | null;
    accept: () => Promise<boolean>;
    reject: (reason: string) => Promise<boolean>;
};

/**
 * Combined hook that provides both data fetching and actions
 * Convenient for use in a single component
 */
export function useSettlementWithActions(orderId: number | undefined): UseSettlementWithActionsResult {
    const { data, loading, error, refetch } = useSettlementByOrder(orderId);
    const { responding, error: respondError, accept: doAccept, reject: doReject } = useRespondSettlement();

    const accept = useCallback(async (): Promise<boolean> => {
        if (!data?.settlementId) return false;
        const result = await doAccept(data.settlementId);
        if (result) {
            await refetch();
            return true;
        }
        return false;
    }, [data?.settlementId, doAccept, refetch]);

    const reject = useCallback(async (reason: string): Promise<boolean> => {
        if (!data?.settlementId) return false;
        const result = await doReject(data.settlementId, reason);
        if (result) {
            await refetch();
            return true;
        }
        return false;
    }, [data?.settlementId, doReject, refetch]);

    return {
        data,
        loading,
        error,
        refetch,
        responding,
        respondError,
        accept,
        reject,
    };
}

export default {
    useSettlementByOrder,
    useRespondSettlement,
    useSettlementWithActions,
};
