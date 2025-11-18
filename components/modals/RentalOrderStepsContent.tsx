import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { MutableRefObject } from 'react';
import {
  ActivityIndicator,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';

import type { OrderCard } from '@/app/(app)/(tabs)/orders';
import type { ContractResponse } from '@/services/contracts';
import type { PaymentMethod } from '@/services/payments';
import styles from '@/style/orders.styles';
import { formatContractStatus, formatCurrency, formatDateTime, formatRentalPeriod } from '@/utils/order-formatters';

const normalizeHtmlContent = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

export type PaymentOption = {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
};

export type RentalOrderStepsContentProps = {
  currentStep: number;
  activeOrder: OrderCard | null;
  activeContract: ContractResponse | null;
  isContractAlreadySigned: boolean;
  isContractLoading: boolean;
  contractErrorMessage: string | null;
  onRetryContract: () => void;
  isDownloadingActiveContract: boolean;
  onDownloadContract: () => void;
  hasAgreed: boolean;
  onToggleAgreement: () => void;
  isAgreementComplete: boolean;
  isSendingPin: boolean;
  onAgreementContinue: () => void;
  onResetFlow: () => void;
  verificationEmail: string | null | undefined;
  otpDigits: string[];
  otpRefs: MutableRefObject<(TextInput | null)[]>;
  onOtpChange: (value: string, index: number) => void;
  onOtpKeyPress: (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => void;
  verificationError: string | null;
  onResendCode: () => void;
  isOtpComplete: boolean;
  onVerifyCode: () => void;
  isSigningContract: boolean;
  onOpenEmailEditor: () => void;
  onGoBack: () => void;
  paymentOptions: PaymentOption[];
  selectedPayment: PaymentMethod;
  onSelectPayment: (method: PaymentMethod) => void;
  paymentError: string | null;
  onCreatePayment: () => void;
  isCreatingPayment: boolean;
};

export default function RentalOrderStepsContent({
  currentStep,
  activeOrder,
  activeContract,
  isContractAlreadySigned,
  isContractLoading,
  contractErrorMessage,
  onRetryContract,
  isDownloadingActiveContract,
  onDownloadContract,
  hasAgreed,
  onToggleAgreement,
  isAgreementComplete,
  isSendingPin,
  onAgreementContinue,
  onResetFlow,
  verificationEmail,
  otpDigits,
  otpRefs,
  onOtpChange,
  onOtpKeyPress,
  verificationError,
  onResendCode,
  isOtpComplete,
  onVerifyCode,
  isSigningContract,
  onOpenEmailEditor,
  onGoBack,
  paymentOptions,
  selectedPayment,
  onSelectPayment,
  paymentError,
  onCreatePayment,
  isCreatingPayment,
}: RentalOrderStepsContentProps) {
  if (currentStep === 1) {
    const canAgreeToContract =
      Boolean(activeContract) && !isContractLoading && !contractErrorMessage && !isContractAlreadySigned;
    const contractTitle = activeContract
      ? activeContract.title && activeContract.title.trim().length > 0
        ? activeContract.title.trim()
        : `Contract #${activeContract.contractId}`
      : 'Rental Contract';
    const contractNumber = activeContract
      ? activeContract.contractNumber && activeContract.contractNumber.trim().length > 0
        ? activeContract.contractNumber.trim()
        : `#${activeContract.contractId}`
      : '—';
    const contractStatusLabel = formatContractStatus(activeContract?.status);
    const contractPeriod = activeContract
      ? formatRentalPeriod(activeContract.startDate ?? '', activeContract.endDate ?? '')
      : '—';
    const contractTotal =
      typeof activeContract?.totalAmount === 'number' ? formatCurrency(activeContract.totalAmount) : '—';
    const contractDeposit =
      typeof activeContract?.depositAmount === 'number' ? formatCurrency(activeContract.depositAmount) : '—';
    const contractRentalDays =
      typeof activeContract?.rentalPeriodDays === 'number'
        ? `${activeContract.rentalPeriodDays} day${activeContract.rentalPeriodDays === 1 ? '' : 's'}`
        : '—';
    const contractStart = formatDateTime(activeContract?.startDate);
    const contractEnd = formatDateTime(activeContract?.endDate);
    const contractExpires = formatDateTime(activeContract?.expiresAt);
    const contractCreated = formatDateTime(activeContract?.createdAt);
    const contractUpdated = formatDateTime(activeContract?.updatedAt);
    const contractDescription = normalizeHtmlContent(activeContract?.description);
    const contractBody = normalizeHtmlContent(activeContract?.contractContent);
    const contractTerms = normalizeHtmlContent(activeContract?.termsAndConditions);

    return (
      <View style={styles.stepContent}>
        <View style={styles.modalOrderHeader}>
          <Text style={styles.modalOrderName}>{activeOrder?.title ?? 'Rental Order'}</Text>
          <Text style={styles.modalOrderMeta}>{activeOrder?.deviceSummary}</Text>
        </View>
        <Text style={styles.stepTitle}>Rental Agreement Contract</Text>
        <Text style={styles.stepSubtitle}>Please review the complete terms and conditions below</Text>
        <View style={styles.contractContainer}>
          {isContractLoading ? (
            <View style={styles.contractStateWrapper}>
              <ActivityIndicator color="#111111" />
              <Text style={styles.contractStateText}>Loading rental contract…</Text>
            </View>
          ) : contractErrorMessage ? (
            <View style={styles.contractStateWrapper}>
              <Text style={[styles.contractStateText, styles.contractErrorText]}>{contractErrorMessage}</Text>
              <Pressable style={styles.contractRetryButton} onPress={onRetryContract}>
                <Text style={styles.contractRetryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : activeContract ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.contractHeading}>{contractTitle}</Text>
              <View style={styles.contractMetaList}>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Contract Number</Text>
                  <Text style={styles.contractMetaValue}>{contractNumber}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Status</Text>
                  <Text style={styles.contractMetaValue}>{contractStatusLabel}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Rental Period</Text>
                  <Text style={styles.contractMetaValue}>{contractPeriod}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Rental Days</Text>
                  <Text style={styles.contractMetaValue}>{contractRentalDays}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Start Date</Text>
                  <Text style={styles.contractMetaValue}>{contractStart}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>End Date</Text>
                  <Text style={styles.contractMetaValue}>{contractEnd}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Total Amount</Text>
                  <Text style={styles.contractMetaValue}>{contractTotal}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Deposit</Text>
                  <Text style={styles.contractMetaValue}>{contractDeposit}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Expires</Text>
                  <Text style={styles.contractMetaValue}>{contractExpires}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Created</Text>
                  <Text style={styles.contractMetaValue}>{contractCreated}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Updated</Text>
                  <Text style={styles.contractMetaValue}>{contractUpdated}</Text>
                </View>
              </View>
              {isContractAlreadySigned ? (
                <View style={styles.contractSignedBanner}>
                  <Ionicons name="checkmark-circle" size={16} color="#15803d" />
                  <Text style={styles.contractSignedText}>
                    This contract has already been signed. Use the download button below to keep a copy for your records.
                  </Text>
                </View>
              ) : null}
              {contractDescription.length > 0 && <Text style={styles.contractBody}>{contractDescription}</Text>}
              {contractBody.length > 0 && (
                <View style={styles.contractSection}>
                  <Text style={styles.contractSectionHeading}>Contract Content</Text>
                  <Text style={styles.contractBody}>{contractBody}</Text>
                </View>
              )}
              {contractTerms.length > 0 && (
                <View style={styles.contractTermsSection}>
                  <Text style={styles.contractTermsHeading}>Terms &amp; Conditions</Text>
                  <Text style={styles.contractTermsText}>{contractTerms}</Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.contractStateWrapper}>
              <Text style={styles.contractStateText}>No rental contract is available for this order yet.</Text>
            </View>
          )}
        </View>
        <Pressable
          style={[styles.agreementRow, !canAgreeToContract && styles.agreementRowDisabled]}
          onPress={onToggleAgreement}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hasAgreed, disabled: !canAgreeToContract }}
          disabled={!canAgreeToContract}
        >
          <MaterialCommunityIcons
            name={hasAgreed ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={canAgreeToContract ? (hasAgreed ? '#111111' : '#8a8a8a') : '#d1d5db'}
          />
          <View style={styles.agreementTextWrapper}>
            <Text style={styles.agreementLabel}>I agree to the rental contract terms</Text>
            <Text style={styles.agreementHelper}>You must accept before proceeding to the verification step.</Text>
          </View>
        </Pressable>
        <View style={styles.primaryActions}>
          {isContractAlreadySigned ? (
            <Pressable
              style={[
                styles.primaryButton,
                styles.buttonFlex,
                styles.primaryButtonEnabled,
                isDownloadingActiveContract && styles.primaryButtonBusy,
              ]}
              onPress={() => {
                if (!isDownloadingActiveContract) {
                  onDownloadContract();
                }
              }}
              disabled={isDownloadingActiveContract}
            >
              {isDownloadingActiveContract ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Download Contract</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.primaryButton,
                styles.buttonFlex,
                isAgreementComplete ? styles.primaryButtonEnabled : styles.primaryButtonDisabled,
              ]}
              onPress={onAgreementContinue}
              disabled={!isAgreementComplete || isSendingPin}
            >
              {isSendingPin ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text
                  style={[
                    styles.primaryButtonText,
                    !isAgreementComplete && styles.primaryButtonTextDisabled,
                  ]}
                >
                  Next
                </Text>
              )}
            </Pressable>
          )}
          <Pressable style={[styles.secondaryButton, styles.buttonFlex]} onPress={onResetFlow}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (currentStep === 2) {
    return (
      <View style={styles.stepContent}>
        <View style={styles.verificationIconWrapper}>
          <Ionicons name="shield-checkmark-outline" size={32} color="#111" />
        </View>
        <Text style={styles.stepTitle}>Verify Your Signature</Text>
        <Text style={styles.stepSubtitle}>
          {verificationEmail
            ? `We've sent a 6-digit code to ${verificationEmail}`
            : 'Enter the 6-digit code we sent to your email address'}
        </Text>
        <View style={styles.otpInputsRow}>
          {otpDigits.map((digit, index) => (
            <TextInput
              key={`otp-${index}`}
              ref={(ref) => {
                otpRefs.current[index] = ref;
              }}
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(value) => onOtpChange(value, index)}
              onKeyPress={(event) => onOtpKeyPress(event, index)}
              returnKeyType="next"
            />
          ))}
        </View>
        {verificationError ? (
          <Text style={styles.otpErrorText} accessibilityRole="alert">
            {verificationError}
          </Text>
        ) : null}
        <View style={styles.verificationHelpers}>
          <Pressable onPress={onResendCode} disabled={isSendingPin}>
            <Text style={[styles.helperLink, isSendingPin && styles.helperLinkDisabled]}>
              Didn&apos;t receive the code?
            </Text>
          </Pressable>
          <Text style={styles.helperText}>Resend available in 00:45</Text>
        </View>
        <Pressable
          style={[
            styles.primaryButton,
            isOtpComplete ? styles.primaryButtonEnabled : styles.primaryButtonDisabled,
          ]}
          onPress={onVerifyCode}
          disabled={!isOtpComplete || isSigningContract}
        >
          {isSigningContract ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text
              style={[styles.primaryButtonText, !isOtpComplete && styles.primaryButtonTextDisabled]}
            >
              Verify Code
            </Text>
          )}
        </Pressable>
        <Pressable
          style={[
            styles.helperButton,
            (isSigningContract || isSendingPin) && styles.helperButtonDisabled,
          ]}
          onPress={onOpenEmailEditor}
          disabled={isSigningContract || isSendingPin}
        >
          <Text style={styles.helperButtonText}>Use a different email</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onGoBack}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review &amp; Pay</Text>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Order</Text>
          <Text style={styles.summaryValue}>{activeOrder?.deviceSummary ?? '—'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Rental Period</Text>
          <Text style={styles.summaryValue}>{activeOrder?.rentalPeriod ?? '—'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Rental Fees</Text>
          <Text style={styles.summaryValue}>{activeOrder?.totalPriceLabel ?? formatCurrency(0)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Deposit</Text>
          <Text style={styles.summaryValue}>{activeOrder?.depositLabel ?? formatCurrency(0)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowEmphasis]}>
          <Text style={styles.summaryLabel}>Total Due</Text>
          <Text style={styles.summaryTotal}>{activeOrder?.totalAmount ?? formatCurrency(0)}</Text>
        </View>
      </View>
      <View style={styles.paymentList}>
        {paymentOptions.map((option) => {
          const isSelected = option.id === selectedPayment;
          return (
            <Pressable
              key={option.id}
              style={[styles.paymentOption, isSelected && styles.paymentOptionSelected]}
              onPress={() => onSelectPayment(option.id)}
            >
              <View style={styles.paymentIcon}>{option.icon}</View>
              <View style={styles.paymentDetails}>
                <Text style={styles.paymentLabel}>{option.label}</Text>
                <Text style={styles.paymentDescription}>{option.description}</Text>
              </View>
              <Ionicons
                name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={isSelected ? '#1f7df4' : '#c1c1c1'}
              />
            </Pressable>
          );
        })}
      </View>
      {paymentError ? (
        <Text style={styles.paymentErrorText} accessibilityRole="alert">
          {paymentError}
        </Text>
      ) : null}
      <View style={styles.paymentSecurity}>
        <Ionicons name="shield-checkmark" size={16} color="#1f7df4" />
        <Text style={styles.paymentSecurityText}>Your payment information is secure</Text>
      </View>
      <Pressable
        style={[
          styles.primaryButton,
          styles.buttonFlex,
          styles.primaryButtonEnabled,
          isCreatingPayment && styles.primaryButtonBusy,
        ]}
        onPress={onCreatePayment}
        disabled={isCreatingPayment || !activeOrder}
      >
        {isCreatingPayment ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.primaryButtonText}>Proceed to Payment</Text>
        )}
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={onGoBack}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
    </View>
  );
}
