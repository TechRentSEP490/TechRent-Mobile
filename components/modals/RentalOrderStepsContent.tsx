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

import type { ContractResponse } from '@/services/contracts';
import type { PaymentMethod } from '@/services/payments';
import styles from '@/style/orders.styles';
import type { OrderCard } from '@/types/orders';
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
        ? `${activeContract.rentalPeriodDays} ngày`
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
        <Text style={styles.stepTitle}>Hợp đồng thuê thiết bị</Text>
        <Text style={styles.stepSubtitle}>Vui lòng xem xét các điều khoản và điều kiện dưới đây</Text>
        <View style={styles.contractContainer}>
          {isContractLoading ? (
            <View style={styles.contractStateWrapper}>
              <ActivityIndicator color="#111111" />
              <Text style={styles.contractStateText}>Đang tải hợp đồng...</Text>
            </View>
          ) : contractErrorMessage ? (
            <View style={styles.contractStateWrapper}>
              <Text style={[styles.contractStateText, styles.contractErrorText]}>{contractErrorMessage}</Text>
              <Pressable style={styles.contractRetryButton} onPress={onRetryContract}>
                <Text style={styles.contractRetryButtonText}>Thử lại</Text>
              </Pressable>
            </View>
          ) : activeContract ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.contractHeading}>{contractTitle}</Text>
              <View style={styles.contractMetaList}>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Số hợp đồng</Text>
                  <Text style={styles.contractMetaValue}>{contractNumber}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Trạng thái</Text>
                  <Text style={styles.contractMetaValue}>{contractStatusLabel}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Thời gian thuê</Text>
                  <Text style={styles.contractMetaValue}>{contractPeriod}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Số ngày thuê</Text>
                  <Text style={styles.contractMetaValue}>{contractRentalDays}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Ngày bắt đầu</Text>
                  <Text style={styles.contractMetaValue}>{contractStart}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Ngày kết thúc</Text>
                  <Text style={styles.contractMetaValue}>{contractEnd}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Tổng tiền</Text>
                  <Text style={styles.contractMetaValue}>{contractTotal}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Tiền cọc</Text>
                  <Text style={styles.contractMetaValue}>{contractDeposit}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Hết hạn đạt cọc</Text>
                  <Text style={styles.contractMetaValue}>{contractExpires}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Ngày tạo</Text>
                  <Text style={styles.contractMetaValue}>{contractCreated}</Text>
                </View>
                <View style={styles.contractMetaRow}>
                  <Text style={styles.contractMetaLabel}>Cập nhật</Text>
                  <Text style={styles.contractMetaValue}>{contractUpdated}</Text>
                </View>
              </View>
              {isContractAlreadySigned ? (
                <View style={styles.contractSignedBanner}>
                  <Ionicons name="checkmark-circle" size={16} color="#15803d" />
                  <Text style={styles.contractSignedText}>
                    Hợp đồng này đã được ký. Nhấn nút Tải xuống để lưu bản sao.
                  </Text>
                </View>
              ) : null}
              {contractDescription.length > 0 && <Text style={styles.contractBody}>{contractDescription}</Text>}
              {contractBody.length > 0 && (
                <View style={styles.contractSection}>
                  <Text style={styles.contractSectionHeading}>Nội dung hợp đồng</Text>
                  <Text style={styles.contractBody}>{contractBody}</Text>
                </View>
              )}
              {contractTerms.length > 0 && (
                <View style={styles.contractTermsSection}>
                  <Text style={styles.contractTermsHeading}>Điều khoản & Điều kiện</Text>
                  <Text style={styles.contractTermsText}>{contractTerms}</Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.contractStateWrapper}>
              <Text style={styles.contractStateText}>Chưa có hợp đồng cho đơn hàng này.</Text>
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
            <Text style={styles.agreementLabel}>Tôi đồng ý với các điều khoản hợp đồng thuê</Text>
            <Text style={styles.agreementHelper}>Bạn phải chấp nhận trước khi tiếp tục bước xác minh.</Text>
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
                <Text style={styles.primaryButtonText}>Tải hợp đồng</Text>
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
                  Tiếp tục
                </Text>
              )}
            </Pressable>
          )}
          <Pressable style={[styles.secondaryButton, styles.buttonFlex]} onPress={onResetFlow}>
            <Text style={styles.secondaryButtonText}>Hủy bỏ</Text>
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
        <Text style={styles.stepTitle}>Xác minh chữ ký</Text>
        <Text style={styles.stepSubtitle}>
          {verificationEmail
            ? `Chúng tôi đã gửi mã 6 chữ số đến ${verificationEmail}`
            : 'Nhập mã 6 chữ số đã gửi đến email của bạn'}
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
              Không nhận được mã?
            </Text>
          </Pressable>
          <Text style={styles.helperText}>Gửi lại sau 00:45</Text>
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
              Xác nhận mã
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
          <Text style={styles.helperButtonText}>Dùng email khác</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onGoBack}>
          <Text style={styles.secondaryButtonText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Kiểm tra & Thanh toán</Text>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Đơn hàng</Text>
          <Text style={styles.summaryValue}>{activeOrder?.deviceSummary ?? '—'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Thời gian thuê</Text>
          <Text style={styles.summaryValue}>{activeOrder?.rentalPeriod ?? '—'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Phí thuê</Text>
          <Text style={styles.summaryValue}>{activeOrder?.totalPriceLabel ?? formatCurrency(0)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tiền cọc</Text>
          <Text style={styles.summaryValue}>{activeOrder?.depositLabel ?? formatCurrency(0)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowEmphasis]}>
          <Text style={styles.summaryLabel}>Tổng thanh toán</Text>
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
        <Text style={styles.paymentSecurityText}>Thông tin thanh toán của bạn được bảo mật</Text>
      </View>
      <View style={styles.primaryActions}>
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
            <Text style={styles.primaryButtonText}>Tiến hành thanh toán</Text>
          )}
        </Pressable>
        <Pressable style={[styles.secondaryButton, styles.buttonFlex]} onPress={onGoBack}>
          <Text style={styles.secondaryButtonText}>Quay lại</Text>
        </Pressable>
      </View>
    </View>
  );
}
