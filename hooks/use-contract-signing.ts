/**
 * useContractSigning Hook
 * Manages the contract signing flow including email verification and OTP handling
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DimensionValue, NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { Alert, TextInput } from 'react-native';

import { fetchContracts, sendContractPin, signContract, type ContractResponse } from '@/services/contracts';
import { useAuth } from '@/stores/auth-store';
import type { OrderCard } from '@/types/orders';
import { isContractSignedByCustomer, isValidEmail, type ApiErrorWithStatus } from '@/utils/order-utils';

export interface UseContractSigningResult {
    // Modal state
    isModalVisible: boolean;
    currentStep: number;
    progressWidth: DimensionValue;

    // Contract state
    activeOrder: OrderCard | null;
    activeContract: ContractResponse | null;
    isContractLoading: boolean;
    isContractAlreadySigned: boolean;
    contractErrorMessage: string | null;

    // Agreement state
    hasAgreed: boolean;
    isAgreementComplete: boolean;

    // Email state
    verificationEmail: string;
    pendingEmailInput: string;
    isEmailEditorVisible: boolean;
    emailEditorError: string | null;

    // OTP state
    otpDigits: string[];
    otpRefs: React.RefObject<(TextInput | null)[]>;
    isOtpComplete: boolean;

    // Loading states
    isSendingPin: boolean;
    isSigningContract: boolean;
    verificationError: string | null;

    // Actions
    openFlow: (order: OrderCard, contractsByOrderId: Record<string, ContractResponse>) => void;
    resetFlow: () => void;
    retryContract: () => void;
    goToNextStep: () => void;
    goToPreviousStep: () => void;
    handleToggleAgreement: () => void;
    handleAgreementContinue: () => Promise<void>;
    handleResendCode: () => Promise<void>;
    handleVerifyCode: () => Promise<void>;
    handleOtpChange: (value: string, index: number) => void;
    handleOtpKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => void;
    handleOpenEmailEditor: () => void;
    handleCloseEmailEditor: () => void;
    handleSaveEmail: () => void;
    setPendingEmailInput: (value: string) => void;
    setEmailEditorError: (error: string | null) => void;
}

export function useContractSigning(defaultEmail: string): UseContractSigningResult {
    const { session, ensureSession } = useAuth();

    // Modal state
    const [isModalVisible, setModalVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);

    // Order/Contract state
    const [activeOrder, setActiveOrder] = useState<OrderCard | null>(null);
    const [activeContract, setActiveContract] = useState<ContractResponse | null>(null);
    const [isContractLoading, setContractLoading] = useState(false);
    const [contractErrorMessage, setContractErrorMessage] = useState<string | null>(null);
    const [contractRequestId, setContractRequestId] = useState(0);

    // Agreement state
    const [hasAgreed, setHasAgreed] = useState(false);

    // Email state
    const [verificationEmail, setVerificationEmail] = useState(defaultEmail);
    const [pendingEmailInput, setPendingEmailInput] = useState(defaultEmail);
    const [isEmailEditorVisible, setEmailEditorVisible] = useState(false);
    const [emailEditorError, setEmailEditorError] = useState<string | null>(null);

    // OTP state
    const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
    const otpRefs = useRef<(TextInput | null)[]>([]);

    // Loading states
    const [isSendingPin, setIsSendingPin] = useState(false);
    const [isSigningContract, setIsSigningContract] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);

    // Refs
    const lastContractLoadRef = useRef<{ orderId: number | null; requestId: number }>({
        orderId: null,
        requestId: 0,
    });

    // Computed values
    const progressWidth = useMemo<DimensionValue>(() => `${(currentStep / 3) * 100}%`, [currentStep]);
    const isContractAlreadySigned = useMemo(
        () => isContractSignedByCustomer(activeContract),
        [activeContract],
    );
    const isAgreementComplete = useMemo(
        () =>
            hasAgreed &&
            Boolean(activeContract) &&
            !isContractLoading &&
            !contractErrorMessage &&
            !isContractAlreadySigned,
        [activeContract, contractErrorMessage, hasAgreed, isContractAlreadySigned, isContractLoading],
    );
    const isOtpComplete = useMemo(
        () => otpDigits.every((digit) => digit.length === 1),
        [otpDigits],
    );

    // Load contract when modal opens
    useEffect(() => {
        if (!isModalVisible || !activeOrder) return;

        const targetOrderId = activeOrder.orderId;
        if (!Number.isFinite(targetOrderId)) {
            setContractErrorMessage('Invalid rental order selected.');
            return;
        }

        const lastLoad = lastContractLoadRef.current;
        const hasRequestChanged = contractRequestId !== lastLoad.requestId || targetOrderId !== lastLoad.orderId;
        const alreadyLoadedForOrder = Boolean(
            activeContract && typeof activeContract.orderId === 'number' && activeContract.orderId === targetOrderId,
        );

        if (!hasRequestChanged && alreadyLoadedForOrder) return;

        let isMounted = true;

        setContractLoading(true);
        if (hasRequestChanged || !alreadyLoadedForOrder) {
            setContractErrorMessage(null);
            if (!alreadyLoadedForOrder || targetOrderId !== lastLoad.orderId) {
                setActiveContract(null);
            }
        }

        lastContractLoadRef.current = { orderId: targetOrderId, requestId: contractRequestId };

        const loadContract = async () => {
            try {
                const activeSession = session?.accessToken ? session : await ensureSession();
                if (!isMounted) return;
                if (!activeSession?.accessToken) {
                    throw new Error('You must be signed in to view rental contracts.');
                }

                const contracts = await fetchContracts(activeSession);
                if (!isMounted) return;

                const matchingContract = contracts.find(
                    (contract) => typeof contract?.orderId === 'number' && contract.orderId === targetOrderId,
                );

                if (matchingContract) {
                    setActiveContract(matchingContract);
                } else {
                    setContractErrorMessage('No rental contract is available for this order yet.');
                }
            } catch (error) {
                if (!isMounted) return;
                const fallbackMessage = 'Failed to load rental contract. Please try again.';
                const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);
                const status = (normalizedError as ApiErrorWithStatus).status;

                if (status === 401) {
                    setContractErrorMessage('Your session has expired. Please sign in again.');
                } else {
                    setContractErrorMessage(
                        normalizedError.message?.trim().length > 0 ? normalizedError.message : fallbackMessage,
                    );
                }
            } finally {
                if (isMounted) setContractLoading(false);
            }
        };

        loadContract();
        return () => { isMounted = false; };
    }, [activeContract, activeOrder, contractRequestId, ensureSession, isModalVisible, session]);

    // Skip to payment if already signed
    useEffect(() => {
        if (!isModalVisible) return;
        if (!isContractSignedByCustomer(activeContract)) return;

        setHasAgreed(true);
        setCurrentStep((prev) => (prev < 3 ? 3 : prev));
    }, [activeContract, isModalVisible]);

    // Request PIN
    const requestContractPin = useCallback(
        async ({ skipAdvance = false }: { skipAdvance?: boolean } = {}) => {
            if (!activeContract?.contractId) {
                throw new Error('A rental contract must be selected.');
            }

            const trimmedEmail = verificationEmail.trim();
            if (!isValidEmail(trimmedEmail)) {
                throw new Error('Please provide a valid email address.');
            }

            const activeSession = session?.accessToken ? session : await ensureSession();
            if (!activeSession?.accessToken) {
                throw new Error('You must be signed in.');
            }

            const result = await sendContractPin(
                { accessToken: activeSession.accessToken, tokenType: activeSession.tokenType },
                { contractId: activeContract.contractId, email: trimmedEmail },
            );

            if (!skipAdvance) {
                setCurrentStep((prev) => Math.min(prev + 1, 3));
            }

            return result;
        },
        [activeContract, ensureSession, session, verificationEmail],
    );

    // Actions
    const openFlow = useCallback(
        (order: OrderCard, contractsByOrderId: Record<string, ContractResponse>) => {
            const latestContract = contractsByOrderId[String(order.orderId)] ?? order.contract ?? null;
            const shouldSkipToPayment = isContractSignedByCustomer(latestContract);

            lastContractLoadRef.current = { orderId: null, requestId: 0 };
            setActiveOrder(order);
            setActiveContract(latestContract);
            setContractErrorMessage(null);
            setContractLoading(false);
            setModalVisible(true);
            setCurrentStep(shouldSkipToPayment ? 3 : 1);
            setOtpDigits(Array(6).fill(''));
            setHasAgreed(shouldSkipToPayment);
            setVerificationEmail(defaultEmail);
            setPendingEmailInput(defaultEmail);
            setVerificationError(null);
            setIsSendingPin(false);
            setIsSigningContract(false);
            setEmailEditorVisible(false);
            setEmailEditorError(null);
            setContractRequestId((prev) => prev + 1);
        },
        [defaultEmail],
    );

    const resetFlow = useCallback(() => {
        lastContractLoadRef.current = { orderId: null, requestId: 0 };
        setModalVisible(false);
        setCurrentStep(1);
        setOtpDigits(Array(6).fill(''));
        setHasAgreed(false);
        setActiveOrder(null);
        setActiveContract(null);
        setContractErrorMessage(null);
        setContractLoading(false);
        setVerificationEmail(defaultEmail);
        setPendingEmailInput(defaultEmail);
        setVerificationError(null);
        setIsSendingPin(false);
        setIsSigningContract(false);
        setEmailEditorVisible(false);
        setEmailEditorError(null);
    }, [defaultEmail]);

    const retryContract = useCallback(() => {
        setContractRequestId((prev) => prev + 1);
    }, []);

    const goToNextStep = useCallback(() => {
        setCurrentStep((prev) => Math.min(prev + 1, 3));
    }, []);

    const goToPreviousStep = useCallback(() => {
        setCurrentStep((prev) => Math.max(prev - 1, 1));
        setVerificationError(null);
        setIsSigningContract(false);
    }, []);

    const handleToggleAgreement = useCallback(() => {
        setHasAgreed((prev) => !prev);
    }, []);

    const handleAgreementContinue = useCallback(async () => {
        if (isSendingPin) return;

        const trimmedEmail = verificationEmail.trim();
        if (trimmedEmail.length === 0) {
            setPendingEmailInput(trimmedEmail);
            setEmailEditorError('Email is required.');
            setEmailEditorVisible(true);
            return;
        }

        if (!isValidEmail(trimmedEmail)) {
            setPendingEmailInput(trimmedEmail);
            setEmailEditorError('Please enter a valid email address.');
            setEmailEditorVisible(true);
            return;
        }

        setVerificationEmail(trimmedEmail);

        try {
            setIsSendingPin(true);
            setVerificationError(null);
            setOtpDigits(Array(6).fill(''));
            await requestContractPin();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unable to send verification code.';
            Alert.alert('Unable to send code', msg);
        } finally {
            setIsSendingPin(false);
        }
    }, [isSendingPin, requestContractPin, verificationEmail]);

    const handleResendCode = useCallback(async () => {
        if (isSendingPin) return;

        const trimmedEmail = verificationEmail.trim();
        if (!isValidEmail(trimmedEmail)) {
            setPendingEmailInput(trimmedEmail);
            setEmailEditorError('Please enter a valid email address.');
            setEmailEditorVisible(true);
            return;
        }

        try {
            setIsSendingPin(true);
            setVerificationError(null);
            setOtpDigits(Array(6).fill(''));
            const response = await requestContractPin({ skipAdvance: true });
            Alert.alert('Code sent', response?.details ?? `Verification code sent to ${trimmedEmail}`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unable to resend code.';
            Alert.alert('Unable to resend code', msg);
        } finally {
            setIsSendingPin(false);
        }
    }, [isSendingPin, requestContractPin, verificationEmail]);

    const handleVerifyCode = useCallback(async () => {
        if (isSigningContract) return;

        const pinCode = otpDigits.join('');
        if (pinCode.length !== 6) {
            setVerificationError('Please enter the complete 6-digit code.');
            return;
        }

        if (!activeContract?.contractId) {
            setVerificationError('A rental contract is required.');
            return;
        }

        try {
            setIsSigningContract(true);
            setVerificationError(null);
            const activeSession = session?.accessToken ? session : await ensureSession();

            if (!activeSession?.accessToken) {
                throw new Error('You must be signed in.');
            }

            await signContract(
                { accessToken: activeSession.accessToken, tokenType: activeSession.tokenType },
                {
                    contractId: activeContract.contractId,
                    digitalSignature: 'string',
                    pinCode,
                    signatureMethod: 'EMAIL_OTP',
                    deviceInfo: 'string',
                    ipAddress: 'string',
                },
            );

            goToNextStep();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unable to verify code.';
            setVerificationError(msg);
        } finally {
            setIsSigningContract(false);
        }
    }, [activeContract, ensureSession, goToNextStep, isSigningContract, otpDigits, session]);

    const handleOtpChange = useCallback(
        (value: string, index: number) => {
            const sanitized = value.replace(/[^0-9]/g, '');
            const digits = [...otpDigits];
            digits[index] = sanitized.slice(-1);
            setOtpDigits(digits);
            if (verificationError) setVerificationError(null);

            if (sanitized && index < otpRefs.current.length - 1) {
                otpRefs.current[index + 1]?.focus();
            }
        },
        [otpDigits, verificationError],
    );

    const handleOtpKeyPress = useCallback(
        (event: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
            if (event.nativeEvent.key === 'Backspace' && otpDigits[index] === '' && index > 0) {
                otpRefs.current[index - 1]?.focus();
            }
        },
        [otpDigits],
    );

    const handleOpenEmailEditor = useCallback(() => {
        setPendingEmailInput(verificationEmail);
        setEmailEditorError(null);
        setEmailEditorVisible(true);
    }, [verificationEmail]);

    const handleCloseEmailEditor = useCallback(() => {
        setEmailEditorVisible(false);
        setEmailEditorError(null);
    }, []);

    const handleSaveEmail = useCallback(() => {
        const trimmed = pendingEmailInput.trim();
        if (trimmed.length === 0) {
            setEmailEditorError('Email is required.');
            return;
        }
        if (!isValidEmail(trimmed)) {
            setEmailEditorError('Please enter a valid email address.');
            return;
        }

        setVerificationEmail(trimmed);
        setPendingEmailInput(trimmed);
        setEmailEditorVisible(false);
        setEmailEditorError(null);
    }, [pendingEmailInput]);

    return {
        // Modal state
        isModalVisible,
        currentStep,
        progressWidth,

        // Contract state
        activeOrder,
        activeContract,
        isContractLoading,
        isContractAlreadySigned,
        contractErrorMessage,

        // Agreement state
        hasAgreed,
        isAgreementComplete,

        // Email state
        verificationEmail,
        pendingEmailInput,
        isEmailEditorVisible,
        emailEditorError,

        // OTP state
        otpDigits,
        otpRefs,
        isOtpComplete,

        // Loading states
        isSendingPin,
        isSigningContract,
        verificationError,

        // Actions
        openFlow,
        resetFlow,
        retryContract,
        goToNextStep,
        goToPreviousStep,
        handleToggleAgreement,
        handleAgreementContinue,
        handleResendCode,
        handleVerifyCode,
        handleOtpChange,
        handleOtpKeyPress,
        handleOpenEmailEditor,
        handleCloseEmailEditor,
        handleSaveEmail,
        setPendingEmailInput,
        setEmailEditorError,
    };
}
