/**
 * useAnnexes Hook
 * Custom hook for managing contract annexes state and operations
 */

import { fetchAnnexesByContract, sendAnnexPin, signAnnex } from '@/services/annexes';
import { useAuth } from '@/stores/auth-store';
import type { ContractAnnex } from '@/types/annexes';
import { useCallback, useState } from 'react';

type UseAnnexesResult = {
    // Data
    annexes: ContractAnnex[];
    isLoading: boolean;
    error: string | null;

    // Sign modal state
    isSignModalVisible: boolean;
    selectedAnnex: ContractAnnex | null;
    isSendingPin: boolean;
    isSigning: boolean;
    pinSent: boolean;
    signError: string | null;

    // Actions
    loadAnnexes: (contractId: number) => Promise<void>;
    openSignModal: (annex: ContractAnnex) => void;
    closeSignModal: () => void;
    handleSendPin: (email: string) => Promise<boolean>;
    handleSign: (pinCode: string) => Promise<boolean>;
    resetState: () => void;
};

export function useAnnexes(): UseAnnexesResult {
    const { session } = useAuth();

    // List state
    const [annexes, setAnnexes] = useState<ContractAnnex[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sign modal state
    const [isSignModalVisible, setIsSignModalVisible] = useState(false);
    const [selectedAnnex, setSelectedAnnex] = useState<ContractAnnex | null>(null);
    const [isSendingPin, setIsSendingPin] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    const [pinSent, setPinSent] = useState(false);
    const [signError, setSignError] = useState<string | null>(null);

    // Track which contract we loaded annexes for
    const [loadedContractId, setLoadedContractId] = useState<number | null>(null);

    /**
     * Load annexes for a contract
     */
    const loadAnnexes = useCallback(async (contractId: number) => {
        if (!session?.accessToken) {
            setError('Phiên đăng nhập không hợp lệ');
            return;
        }

        if (!contractId || contractId <= 0) {
            setAnnexes([]);
            return;
        }

        // Don't reload if already loaded for this contract
        if (loadedContractId === contractId && annexes.length > 0) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await fetchAnnexesByContract(session, contractId);
            setAnnexes(result);
            setLoadedContractId(contractId);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể tải danh sách phụ lục';
            setError(message);
            console.error('[useAnnexes] loadAnnexes error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [session, loadedContractId, annexes.length]);

    /**
     * Open sign modal for an annex
     */
    const openSignModal = useCallback((annex: ContractAnnex) => {
        setSelectedAnnex(annex);
        setIsSignModalVisible(true);
        setPinSent(false);
        setSignError(null);
    }, []);

    /**
     * Close sign modal
     */
    const closeSignModal = useCallback(() => {
        setIsSignModalVisible(false);
        setSelectedAnnex(null);
        setPinSent(false);
        setSignError(null);
        setIsSendingPin(false);
        setIsSigning(false);
    }, []);

    /**
     * Send PIN to user's email
     */
    const handleSendPin = useCallback(async (email: string): Promise<boolean> => {
        if (!session?.accessToken) {
            setSignError('Phiên đăng nhập không hợp lệ');
            return false;
        }

        if (!selectedAnnex) {
            setSignError('Không tìm thấy phụ lục');
            return false;
        }

        setIsSendingPin(true);
        setSignError(null);

        try {
            await sendAnnexPin(
                session,
                selectedAnnex.contractId,
                selectedAnnex.annexId ?? selectedAnnex.id,
                email
            );
            setPinSent(true);
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể gửi mã xác thực';
            setSignError(message);
            return false;
        } finally {
            setIsSendingPin(false);
        }
    }, [session, selectedAnnex]);

    /**
     * Sign the annex with PIN code
     */
    const handleSign = useCallback(async (pinCode: string): Promise<boolean> => {
        if (!session?.accessToken) {
            setSignError('Phiên đăng nhập không hợp lệ');
            return false;
        }

        if (!selectedAnnex) {
            setSignError('Không tìm thấy phụ lục');
            return false;
        }

        setIsSigning(true);
        setSignError(null);

        try {
            await signAnnex(
                session,
                selectedAnnex.contractId,
                selectedAnnex.annexId ?? selectedAnnex.id,
                pinCode
            );

            // Reload annexes to get updated status
            if (loadedContractId) {
                setLoadedContractId(null); // Force reload
                await loadAnnexes(selectedAnnex.contractId);
            }

            closeSignModal();
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể ký phụ lục';
            setSignError(message);
            return false;
        } finally {
            setIsSigning(false);
        }
    }, [session, selectedAnnex, loadedContractId, loadAnnexes, closeSignModal]);

    /**
     * Reset all state
     */
    const resetState = useCallback(() => {
        setAnnexes([]);
        setIsLoading(false);
        setError(null);
        setIsSignModalVisible(false);
        setSelectedAnnex(null);
        setIsSendingPin(false);
        setIsSigning(false);
        setPinSent(false);
        setSignError(null);
        setLoadedContractId(null);
    }, []);

    return {
        // Data
        annexes,
        isLoading,
        error,

        // Sign modal state
        isSignModalVisible,
        selectedAnnex,
        isSendingPin,
        isSigning,
        pinSent,
        signError,

        // Actions
        loadAnnexes,
        openSignModal,
        closeSignModal,
        handleSendPin,
        handleSign,
        resetState,
    };
}
