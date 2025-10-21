import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

const PAYMENT_OPTIONS = [
  {
    id: 'payos',
    label: 'PayOS',
    description: 'Credit/Debit Card',
    icon: <Ionicons name="card-outline" size={24} color="#111" />,
  },
  {
    id: 'momo',
    label: 'MoMo',
    description: 'Mobile Wallet',
    icon: <MaterialCommunityIcons name="wallet-outline" size={24} color="#111" />,
  },
];

export default function OrdersScreen() {
  const router = useRouter();
  const { flow } = useLocalSearchParams<{ flow?: string | string[] }>();
  const [isModalVisible, setModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [selectedPayment, setSelectedPayment] = useState(PAYMENT_OPTIONS[0].id);
  const [hasAgreed, setHasAgreed] = useState(false);

  const progressWidth = useMemo(() => `${(currentStep / 3) * 100}%`, [currentStep]);
  const isAgreementComplete = hasAgreed;
  const isOtpComplete = useMemo(() => otpDigits.every((digit) => digit.length === 1), [otpDigits]);

  const openFlow = useCallback(() => {
    setModalVisible(true);
    setCurrentStep(1);
    setOtpDigits(Array(6).fill(''));
    setSelectedPayment(PAYMENT_OPTIONS[0].id);
    setHasAgreed(false);
  }, []);

  const resetFlow = () => {
    setModalVisible(false);
    setCurrentStep(1);
    setOtpDigits(Array(6).fill(''));
    setSelectedPayment(PAYMENT_OPTIONS[0].id);
    setHasAgreed(false);
  };

  useEffect(() => {
    const continueFlowParam = Array.isArray(flow) ? flow[0] : flow;

    if (continueFlowParam === 'continue') {
      openFlow();
      router.replace('/(app)/(tabs)/orders');
    }
  }, [flow, openFlow, router]);

  const goToNextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleOtpChange = (value: string, index: number) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    const digits = [...otpDigits];
    digits[index] = sanitized.slice(-1);
    setOtpDigits(digits);

    if (sanitized && index < otpRefs.current.length - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (event.nativeEvent.key === 'Backspace' && otpDigits[index] === '' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Rental Agreement Contract</Text>
            <Text style={styles.stepSubtitle}>
              Please review the complete terms and conditions below
            </Text>
            <View style={styles.contractContainer}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.contractHeading}>RENTAL AGREEMENT CONTRACT</Text>
                <Text style={styles.contractBody}>
                  Lorem ipsum dolor sit amet, consectetur adipisicing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                  exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                  {'\n\n'}
                  Duis aute irure
                  dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
                  pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
                  deserunt mollit anim id est laborum.
                </Text>
              </ScrollView>
            </View>
            <Pressable
              style={styles.agreementRow}
              onPress={() => setHasAgreed((previous) => !previous)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: hasAgreed }}
            >
              <MaterialCommunityIcons
                name={hasAgreed ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={24}
                color={hasAgreed ? '#111111' : '#8a8a8a'}
              />
              <View style={styles.agreementTextWrapper}>
                <Text style={styles.agreementLabel}>I agree to the rental contract terms</Text>
                <Text style={styles.agreementHelper}>
                  You must accept before proceeding to the verification step.
                </Text>
              </View>
            </Pressable>
            <View style={styles.primaryActions}>
              <Pressable
                style={[
                  styles.primaryButton,
                  isAgreementComplete ? styles.primaryButtonEnabled : styles.primaryButtonDisabled,
                ]}
                onPress={goToNextStep}
                disabled={!isAgreementComplete}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    !isAgreementComplete && styles.primaryButtonTextDisabled,
                  ]}
                >
                  Next
                </Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={resetFlow}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <View style={styles.verificationIconWrapper}>
              <Ionicons name="shield-checkmark-outline" size={32} color="#111" />
            </View>
            <Text style={styles.stepTitle}>Verify Your Signature</Text>
            <Text style={styles.stepSubtitle}>We&apos;ve sent a 6-digit code to user@gmail.com</Text>
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
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(event) => handleOtpKeyPress(event, index)}
                  returnKeyType="next"
                />
              ))}
            </View>
            <View style={styles.verificationHelpers}>
              <Pressable>
                <Text style={styles.helperLink}>Didn&apos;t receive the code?</Text>
              </Pressable>
              <Text style={styles.helperText}>Resend available in 00:45</Text>
            </View>
            <Pressable
              style={[
                styles.primaryButton,
                isOtpComplete ? styles.primaryButtonEnabled : styles.primaryButtonDisabled,
              ]}
              onPress={goToNextStep}
              disabled={!isOtpComplete}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  !isOtpComplete && styles.primaryButtonTextDisabled,
                ]}
              >
                Verify Code
              </Text>
            </Pressable>
            <Pressable style={styles.helperButton}>
              <Text style={styles.helperButtonText}>Use a different email</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={goToPreviousStep}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
          </View>
        );
      case 3:
      default:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Total Amount</Text>
            <Text style={styles.amountText}>$470.00</Text>
            <View style={styles.paymentList}>
              {PAYMENT_OPTIONS.map((option) => {
                const isSelected = option.id === selectedPayment;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.paymentOption, isSelected && styles.paymentOptionSelected]}
                    onPress={() => setSelectedPayment(option.id)}
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
            <View style={styles.paymentSecurity}>
              <Ionicons name="shield-checkmark" size={16} color="#1f7df4" />
              <Text style={styles.paymentSecurityText}>Your payment information is secure</Text>
            </View>
            <Pressable style={[styles.primaryButton, styles.primaryButtonEnabled]} onPress={resetFlow}>
              <Text style={styles.primaryButtonText}>Complete Rental Process</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={goToPreviousStep}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>Track your rentals and complete any pending steps.</Text>

        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.orderName}>MacBook Pro 16&quot;</Text>
              <Text style={styles.orderMeta}>Order #TR-48392</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Confirmed</Text>
            </View>
          </View>
          <Text style={styles.orderSchedule}>Delivery scheduled for Aug 24, 2024</Text>
          <Pressable style={styles.continueButton} onPress={openFlow}>
            <View>
              <Text style={styles.continueLabel}>Continue Process</Text>
              <Text style={styles.continueHelper}>Finish rental agreement, signature, and payment</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#1f7df4" />
          </Pressable>
        </View>
      </ScrollView>

      <Modal animationType="slide" visible={isModalVisible} transparent onRequestClose={resetFlow}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Rental Agreement</Text>
              <Pressable style={styles.closeButton} onPress={resetFlow}>
                <Ionicons name="close" size={20} color="#111" />
              </Pressable>
            </View>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Step {currentStep} of 3</Text>
              <Text style={styles.progressStage}>Final Review</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
            {renderStepContent()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
  },
  subtitle: {
    fontSize: 16,
    color: '#555555',
  },
  sectionCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  orderMeta: {
    fontSize: 14,
    color: '#6f6f6f',
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: '#e6f4ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f7df4',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  orderSchedule: {
    fontSize: 14,
    color: '#444444',
  },
  continueButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#dfe7f5',
  },
  continueLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  continueHelper: {
    fontSize: 13,
    color: '#6f6f6f',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    gap: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f2f5',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a4a4a',
  },
  progressStage: {
    fontSize: 12,
    color: '#8a8a8a',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#edf1f9',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1f7df4',
  },
  stepContent: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6f6f6f',
  },
  contractContainer: {
    backgroundColor: '#fafafa',
    borderRadius: 16,
    padding: 16,
    maxHeight: 260,
    borderWidth: 1,
    borderColor: '#e4e7ec',
  },
  contractHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 12,
  },
  contractBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#545454',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  agreementTextWrapper: {
    flex: 1,
    gap: 2,
  },
  agreementLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  agreementHelper: {
    fontSize: 12,
    color: '#6f6f6f',
  },
  primaryActions: {
    gap: 12,
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonEnabled: {
    backgroundColor: '#111111',
  },
  primaryButtonDisabled: {
    backgroundColor: '#d9d9d9',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonTextDisabled: {
    color: '#7a7a7a',
  },
  secondaryButton: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7dce4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3a3a3a',
  },
  verificationIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f5ff',
    alignSelf: 'center',
  },
  otpInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d7dce4',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: '#ffffff',
  },
  verificationHelpers: {
    gap: 4,
    alignItems: 'center',
  },
  helperLink: {
    fontSize: 13,
    color: '#1f7df4',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#8a8a8a',
  },
  helperButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f7df4',
  },
  amountText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111111',
  },
  paymentList: {
    gap: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e1e6ef',
    backgroundColor: '#ffffff',
  },
  paymentOptionSelected: {
    borderColor: '#1f7df4',
    backgroundColor: '#f4f8ff',
  },
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f4f7',
  },
  paymentDetails: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  paymentDescription: {
    fontSize: 13,
    color: '#6f6f6f',
    marginTop: 2,
  },
  paymentSecurity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentSecurityText: {
    fontSize: 12,
    color: '#6f6f6f',
  },
});
