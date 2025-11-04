import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  Modal,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { sendContractPinEmail, signContract } from '@/services/contracts';

type OrderStatusFilter = 'All' | 'Pending' | 'Delivered' | 'In Use' | 'Completed';
type OrderStatus = Exclude<OrderStatusFilter, 'All'>;
type OrderActionType =
  | 'continueProcess'
  | 'extendRental'
  | 'confirmReceipt'
  | 'cancelOrder'
  | 'rentAgain';

type OrderCard = {
  id: string;
  productName: string;
  orderNumber: string;
  rentalPeriod: string;
  totalAmount: string;
  statusFilter: OrderStatus;
  statusLabel: string;
  statusColor: string;
  statusBackground: string;
  action?: {
    label: string;
    type: OrderActionType;
  };
  contractId?: number | null;
};

const ORDER_FILTERS: OrderStatusFilter[] = ['All', 'Pending', 'Delivered', 'In Use', 'Completed'];

const ORDERS: OrderCard[] = [
  {
    id: 'ORD-20001',
    productName: 'Samsung Galaxy S23',
    orderNumber: 'Order #ORD-20001',
    rentalPeriod: 'Jan 14 - Jan 21, 2025',
    totalAmount: '$560.00',
    statusFilter: 'Pending',
    statusLabel: 'Awaiting Docs',
    statusColor: '#b45309',
    statusBackground: '#fef3c7',
    action: { label: 'Continue Process', type: 'continueProcess' },
    contractId: 28,
  },
  {
    id: 'ORD-12345',
    productName: 'SmartPhone X',
    orderNumber: 'Order #12345',
    rentalPeriod: 'Jan 15 - Jan 22, 2025',
    totalAmount: '$799.00',
    statusFilter: 'In Use',
    statusLabel: 'In Use',
    statusColor: '#1d4ed8',
    statusBackground: '#dbeafe',
    action: { label: 'Extend Rental', type: 'extendRental' },
  },
  {
    id: 'ORD-12344',
    productName: 'MacBook Pro 16"',
    orderNumber: 'Order #12344',
    rentalPeriod: 'Jan 10 - Jan 17, 2025',
    totalAmount: '$420.00',
    statusFilter: 'Delivered',
    statusLabel: 'Delivery',
    statusColor: '#15803d',
    statusBackground: '#dcfce7',
    action: { label: 'Confirm Receipt', type: 'confirmReceipt' },
  },
  {
    id: 'ORD-12343',
    productName: 'DJI Mavic Air 2 Drone',
    orderNumber: 'Order #12343',
    rentalPeriod: 'Jan 20 - Jan 25, 2025',
    totalAmount: '$180.00',
    statusFilter: 'Pending',
    statusLabel: 'In Review',
    statusColor: '#6d28d9',
    statusBackground: '#ede9fe',
    action: { label: 'Cancel Order', type: 'cancelOrder' },
  },
  {
    id: 'ORD-12211',
    productName: 'Lenovo ThinkPad X1',
    orderNumber: 'Order #12211',
    rentalPeriod: 'Dec 01 - Dec 20, 2024',
    totalAmount: '$650.00',
    statusFilter: 'Completed',
    statusLabel: 'Completed',
    statusColor: '#111111',
    statusBackground: '#f3f4f6',
    action: { label: 'Rent Again', type: 'rentAgain' },
  },
];

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
  const { flow, orderId } = useLocalSearchParams<{
    flow?: string | string[];
    orderId?: string | string[];
  }>();
  const { session, user } = useAuth();
  const listRef = useRef<FlatList<OrderCard>>(null);
  const [selectedFilter, setSelectedFilter] = useState<OrderStatusFilter>('All');
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [pendingScrollOrderId, setPendingScrollOrderId] = useState<string | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [activeOrder, setActiveOrder] = useState<OrderCard | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [selectedPayment, setSelectedPayment] = useState(PAYMENT_OPTIONS[0].id);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [emailEditorVisible, setEmailEditorVisible] = useState(false);
  const [emailInputValue, setEmailInputValue] = useState('');
  const [isSendingPin, setIsSendingPin] = useState(false);
  const [isSigningContract, setIsSigningContract] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [signatureStatus, setSignatureStatus] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  const progressWidth = useMemo(() => `${(currentStep / 3) * 100}%`, [currentStep]);
  const isAgreementComplete = hasAgreed;
  const isOtpComplete = useMemo(
    () => otpDigits.every((digit) => digit.length === 1),
    [otpDigits],
  );
  const isAgreementActionDisabled = !isAgreementComplete || isSendingPin;
  const isVerifyActionDisabled = !isOtpComplete || isSigningContract;

  const filteredOrders = useMemo(() => {
    if (selectedFilter === 'All') {
      return ORDERS;
    }

    return ORDERS.filter((order) => order.statusFilter === selectedFilter);
  }, [selectedFilter]);

  const openFlow = useCallback(
    (order: OrderCard) => {
      setActiveOrder(order);
      setModalVisible(true);
      setCurrentStep(1);
      setOtpDigits(Array(6).fill(''));
      setSelectedPayment(PAYMENT_OPTIONS[0].id);
      setHasAgreed(false);
      const nextEmail = user?.email ?? '';
      setVerificationEmail(nextEmail);
      setEmailInputValue(nextEmail);
      setVerificationStatus(null);
      setVerificationError(null);
      setSignatureStatus(null);
      setSignatureError(null);
      setIsSendingPin(false);
      setIsSigningContract(false);
      setEmailEditorVisible(false);
    },
    [user?.email],
  );

  const resetFlow = useCallback(() => {
    setModalVisible(false);
    setCurrentStep(1);
    setOtpDigits(Array(6).fill(''));
    setSelectedPayment(PAYMENT_OPTIONS[0].id);
    setHasAgreed(false);
    setActiveOrder(null);
    setVerificationStatus(null);
    setVerificationError(null);
    setSignatureStatus(null);
    setSignatureError(null);
    setIsSendingPin(false);
    setIsSigningContract(false);
    setEmailEditorVisible(false);
  }, []);

  useEffect(() => {
    if (!highlightedOrderId) {
      return;
    }

    const timeout = setTimeout(() => {
      setHighlightedOrderId(null);
    }, 4000);

    return () => {
      clearTimeout(timeout);
    };
  }, [highlightedOrderId]);

  useEffect(() => {
    const flowParam = Array.isArray(flow) ? flow[0] : flow;
    if (flowParam !== 'continue') {
      return;
    }

    const orderIdParam = Array.isArray(orderId) ? orderId[0] : orderId;
    const targetOrder =
      ORDERS.find((order) => order.id === orderIdParam) ||
      ORDERS.find((order) => order.action?.type === 'continueProcess');

    if (targetOrder) {
      setSelectedFilter(targetOrder.statusFilter);
      setHighlightedOrderId(targetOrder.id);
      setPendingScrollOrderId(targetOrder.id);
    }

    router.replace('/(app)/(tabs)/orders');
  }, [flow, orderId, router]);

  useEffect(() => {
    if (!pendingScrollOrderId) {
      return;
    }

    const index = filteredOrders.findIndex((order) => order.id === pendingScrollOrderId);

    if (index >= 0) {
      try {
        listRef.current?.scrollToIndex({ index, animated: true });
      } catch {
        // Ignore scroll errors if the list has not rendered yet
      }
    }

    setPendingScrollOrderId(null);
  }, [filteredOrders, pendingScrollOrderId]);

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

  const requestContractPin = useCallback(
    async ({ email, advanceStep = false }: { email?: string; advanceStep?: boolean } = {}) => {
      if (!activeOrder?.contractId) {
        Alert.alert(
          'Contract unavailable',
          'We could not find the contract associated with this order. Please contact support.',
        );
        return false;
      }

      if (!session?.accessToken) {
        Alert.alert('Sign in required', 'Please sign in again to continue the contract process.');
        return false;
      }

      const targetEmail = (email ?? verificationEmail).trim();

      if (targetEmail.length === 0) {
        Alert.alert('Email required', 'Please provide an email address to receive the PIN code.');
        return false;
      }

      setIsSendingPin(true);
      setVerificationError(null);
      setVerificationStatus(null);

      try {
        const response = await sendContractPinEmail(
          activeOrder.contractId,
          { email: targetEmail },
          session,
        );

        setVerificationEmail(targetEmail);
        setEmailInputValue(targetEmail);
        setVerificationStatus(response.details || response.message || 'Verification code sent.');
        setSignatureStatus(null);
        setSignatureError(null);
        setOtpDigits(Array(6).fill(''));

        if (advanceStep) {
          setCurrentStep(2);
        }

        return true;
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error.message : 'Failed to request a verification code.';
        setVerificationError(normalizedError);
        return false;
      } finally {
        setIsSendingPin(false);
      }
    },
    [activeOrder?.contractId, session, verificationEmail],
  );

  const handleAgreementSubmit = useCallback(() => {
    void requestContractPin({ advanceStep: true });
  }, [requestContractPin]);

  const handleResendCode = useCallback(() => {
    void requestContractPin({ advanceStep: false });
  }, [requestContractPin]);

  const handleVerifyOtp = useCallback(async () => {
    if (!activeOrder?.contractId) {
      Alert.alert(
        'Contract unavailable',
        'We could not find the contract associated with this order. Please contact support.',
      );
      return;
    }

    if (!session?.accessToken) {
      Alert.alert('Sign in required', 'Please sign in again to continue the contract process.');
      return;
    }

    const pinCode = otpDigits.join('');

    if (pinCode.length !== otpDigits.length) {
      setSignatureError('Please enter the 6-digit verification code.');
      return;
    }

    setIsSigningContract(true);
    setSignatureError(null);

    try {
      const response = await signContract(
        activeOrder.contractId,
        {
          contractId: activeOrder.contractId,
          pinCode,
          digitalSignature: 'string',
          signatureMethod: 'EMAIL_OTP',
          deviceInfo: 'string',
          ipAddress: 'string',
        },
        session,
      );

      setSignatureStatus(response.details || response.message || 'Contract signed successfully.');
      setCurrentStep(3);
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error.message : 'Failed to verify the provided PIN code.';
      setSignatureError(normalizedError);
    } finally {
      setIsSigningContract(false);
    }
  }, [activeOrder?.contractId, otpDigits, session]);

  const handleOpenEmailEditor = useCallback(() => {
    setEmailInputValue(verificationEmail);
    setEmailEditorVisible(true);
  }, [verificationEmail]);

  const handleCloseEmailEditor = useCallback(() => {
    setEmailEditorVisible(false);
  }, []);

  const handleSubmitEmailUpdate = useCallback(async () => {
    const success = await requestContractPin({ email: emailInputValue, advanceStep: false });

    if (success) {
      setEmailEditorVisible(false);
    }
  }, [emailInputValue, requestContractPin]);

  const handleCardAction = useCallback(
    (order: OrderCard) => {
      if (!order.action) {
        return;
      }

      switch (order.action.type) {
        case 'continueProcess':
          openFlow(order);
          break;
        case 'extendRental':
          Alert.alert('Extend Rental', 'Our team will reach out to help extend this rental.');
          break;
        case 'confirmReceipt':
          Alert.alert('Receipt Confirmed', 'Thanks for confirming delivery of your device.');
          break;
        case 'cancelOrder':
          Alert.alert('Cancel Order', 'Your cancellation request has been submitted.');
          break;
        case 'rentAgain':
          Alert.alert('Rent Again', 'We\'ll move this device to your cart so you can rent it again.');
          break;
        default:
          break;
      }
    },
    [openFlow],
  );

  const handleViewDetails = useCallback((order: OrderCard) => {
    Alert.alert('View Details', `Detailed tracking for ${order.productName} is coming soon.`);
  }, []);

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <View style={styles.modalOrderHeader}>
              <Text style={styles.modalOrderName}>{activeOrder?.productName ?? 'Rental Order'}</Text>
              <Text style={styles.modalOrderMeta}>{activeOrder?.orderNumber}</Text>
            </View>
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
                  {'\n\n'}Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore
                  eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
                  culpa qui officia deserunt mollit anim id est laborum.
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
                  styles.buttonFlex,
                  isAgreementActionDisabled
                    ? styles.primaryButtonDisabled
                    : styles.primaryButtonEnabled,
                ]}
                onPress={handleAgreementSubmit}
                disabled={isAgreementActionDisabled}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    isAgreementActionDisabled && styles.primaryButtonTextDisabled,
                  ]}
                >
                  {isSendingPin ? 'Sending…' : 'Next'}
                </Text>
              </Pressable>
              <Pressable style={[styles.secondaryButton, styles.buttonFlex]} onPress={resetFlow}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
            {verificationError ? (
              <Text style={[styles.statusMessage, styles.statusMessageError]}>{verificationError}</Text>
            ) : null}
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <View style={styles.verificationIconWrapper}>
              <Ionicons name="shield-checkmark-outline" size={32} color="#111" />
            </View>
            <Text style={styles.stepTitle}>Verify Your Signature</Text>
            <Text style={styles.stepSubtitle}>
              {verificationEmail
                ? `We've sent a 6-digit code to ${verificationEmail}`
                : "We've sent a 6-digit code to your email address"}
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
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(event) => handleOtpKeyPress(event, index)}
                  returnKeyType="next"
                />
              ))}
            </View>
            <View style={styles.verificationHelpers}>
              <Pressable onPress={handleResendCode} disabled={isSendingPin}>
                <Text
                  style={[
                    styles.helperLink,
                    isSendingPin && styles.helperLinkDisabled,
                  ]}
                >
                  {isSendingPin ? 'Resending…' : "Didn't receive the code?"}
                </Text>
              </Pressable>
              <Text style={styles.helperText}>Resend available in 00:45</Text>
            </View>
            {verificationStatus ? (
              <Text style={[styles.statusMessage, styles.statusMessageSuccess]}>
                {verificationStatus}
              </Text>
            ) : null}
            {verificationError ? (
              <Text style={[styles.statusMessage, styles.statusMessageError]}>
                {verificationError}
              </Text>
            ) : null}
            {signatureError ? (
              <Text style={[styles.statusMessage, styles.statusMessageError]}>
                {signatureError}
              </Text>
            ) : null}
            <Pressable
              style={[
                styles.primaryButton,
                isVerifyActionDisabled ? styles.primaryButtonDisabled : styles.primaryButtonEnabled,
              ]}
              onPress={handleVerifyOtp}
              disabled={isVerifyActionDisabled}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  isVerifyActionDisabled && styles.primaryButtonTextDisabled,
                ]}
              >
                {isSigningContract ? 'Verifying…' : 'Verify Code'}
              </Text>
            </Pressable>
            <Pressable style={styles.helperButton} onPress={handleOpenEmailEditor}>
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
            <Text style={styles.stepTitle}>Review &amp; Pay</Text>
            {signatureStatus ? (
              <Text style={[styles.statusMessage, styles.statusMessageSuccess]}>
                {signatureStatus}
              </Text>
            ) : null}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Order</Text>
                <Text style={styles.summaryValue}>{activeOrder?.productName}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Rental Period</Text>
                <Text style={styles.summaryValue}>{activeOrder?.rentalPeriod}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={styles.summaryTotal}>{activeOrder?.totalAmount ?? '$0.00'}</Text>
              </View>
            </View>
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
            <Pressable
              style={[styles.primaryButton, styles.primaryButtonEnabled]}
              onPress={() =>
                Alert.alert(
                  'Rental Process Complete',
                  `${activeOrder?.productName ?? 'Your order'} is confirmed!`,
                  [
                    {
                      text: 'Done',
                      style: 'default',
                      onPress: resetFlow,
                    },
                  ],
                )
              }
            >
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
      <FlatList
        ref={listRef}
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isHighlighted = highlightedOrderId === item.id;
          return (
            <View
              style={[
                styles.orderCard,
                isHighlighted && styles.orderCardHighlighted,
              ]}
            >
              <View style={styles.cardLeading}>
                <View style={styles.thumbnail}>
                  <Text style={styles.thumbnailText}>IMG</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.productName}>{item.productName}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: item.statusBackground,
                      },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: item.statusColor }]}>
                      {item.statusLabel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaGroup}>
                    <Text style={styles.metaLabel}>Rental Period</Text>
                    <Text style={styles.metaValue}>{item.rentalPeriod}</Text>
                  </View>
                  <View style={styles.metaGroup}>
                    <Text style={styles.metaLabel}>Total Amount</Text>
                    <Text style={styles.metaValue}>{item.totalAmount}</Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Pressable onPress={() => handleViewDetails(item)}>
                    <Text style={styles.viewDetails}>View Details</Text>
                  </Pressable>
                  {item.action ? (
                    <Pressable
                      style={styles.cardActionButton}
                      onPress={() => handleCardAction(item)}
                    >
                      <Text style={styles.cardActionLabel}>{item.action.label}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          );
        }}
        ListHeaderComponent={() => (
          <View style={styles.headerSection}>
            <View style={styles.topBar}>
              <Text style={styles.title}>My Orders</Text>
              <View style={styles.headerActions}>
                <Pressable style={styles.iconButton}>
                  <Ionicons name="search" size={18} color="#111" />
                </Pressable>
                <Pressable style={styles.iconButton}>
                  <Ionicons name="options-outline" size={18} color="#111" />
                </Pressable>
              </View>
            </View>
            <Text style={styles.subtitle}>
              Track your order history, deliveries, and active rentals in one place.
            </Text>
            <View style={styles.filterRow}>
              {ORDER_FILTERS.map((filter) => {
                const isSelected = selectedFilter === filter;
                return (
                  <Pressable
                    key={filter}
                    style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                    onPress={() => setSelectedFilter(filter)}
                  >
                    <Text
                      style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}
                    >
                      {filter}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptySubtitle}>
              Orders matching the selected status will appear here.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

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
      <Modal
        animationType="fade"
        transparent
        visible={emailEditorVisible}
        onRequestClose={handleCloseEmailEditor}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.emailModalCard}>
            <Text style={styles.emailModalTitle}>Update email address</Text>
            <Text style={styles.emailModalSubtitle}>
              Enter the email where you would like to receive the verification code.
            </Text>
            <TextInput
              style={styles.emailInput}
              value={emailInputValue}
              onChangeText={setEmailInputValue}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="name@example.com"
              placeholderTextColor="#9ca3af"
            />
            {verificationError ? (
              <Text style={[styles.statusMessage, styles.statusMessageError, { textAlign: 'left' }]}>
                {verificationError}
              </Text>
            ) : null}
            <View style={styles.emailModalActions}>
              <Pressable style={styles.emailModalButton} onPress={handleCloseEmailEditor}>
                <Text style={styles.emailModalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.emailModalButton,
                  styles.emailModalButtonPrimary,
                  isSendingPin && styles.primaryButtonDisabled,
                ]}
                onPress={handleSubmitEmailUpdate}
                disabled={isSendingPin}
              >
                <Text
                  style={[
                    styles.emailModalButtonText,
                    styles.emailModalButtonTextPrimary,
                  ]}
                >
                  {isSendingPin ? 'Sending…' : 'Send code'}
                </Text>
              </Pressable>
            </View>
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
  },
  headerSection: {
    marginBottom: 16,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f4f4f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  filterChipSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterLabelSelected: {
    color: '#ffffff',
  },
  orderCard: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    padding: 16,
  },
  orderCardHighlighted: {
    borderWidth: 2,
    borderColor: '#1f7df4',
    backgroundColor: '#eef4ff',
  },
  cardLeading: {
    marginRight: 16,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailText: {
    fontWeight: '700',
    color: '#4b5563',
    fontSize: 12,
  },
  cardBody: {
    flex: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  orderNumber: {
    fontSize: 13,
    color: '#6b7280',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  metaGroup: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewDetails: {
    fontSize: 14,
    color: '#1f7df4',
    fontWeight: '600',
  },
  cardActionButton: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cardActionLabel: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
  },
  separator: {
    height: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
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
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    gap: 16,
  },
  emailModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  emailModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  emailModalSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111111',
  },
  emailModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  emailModalButton: {
    flex: 1,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  emailModalButtonPrimary: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  emailModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  emailModalButtonTextPrimary: {
    color: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  progressStage: {
    fontSize: 13,
    color: '#111111',
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#111111',
  },
  stepContent: {
    gap: 16,
  },
  modalOrderHeader: {
    gap: 4,
  },
  modalOrderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  modalOrderMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  contractContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    maxHeight: 200,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  contractHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 12,
  },
  contractBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4b5563',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  agreementTextWrapper: {
    flex: 1,
    gap: 4,
  },
  agreementLabel: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '600',
  },
  agreementHelper: {
    fontSize: 12,
    color: '#6b7280',
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#111111',
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  primaryButtonEnabled: {
    opacity: 1,
  },
  primaryButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  primaryButtonTextDisabled: {
    color: '#9ca3af',
  },
  secondaryButton: {
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignSelf: 'stretch',
  },
  buttonFlex: {
    flex: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  verificationIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  otpInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  verificationHelpers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helperLink: {
    fontSize: 13,
    color: '#1f7df4',
    fontWeight: '600',
  },
  helperLinkDisabled: {
    color: '#9ca3af',
  },
  helperText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  helperButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  helperButtonText: {
    fontSize: 14,
    color: '#1f7df4',
    fontWeight: '600',
  },
  statusMessage: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
  },
  statusMessageSuccess: {
    color: '#15803d',
  },
  statusMessageError: {
    color: '#b91c1c',
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '600',
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  paymentList: {
    gap: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
  },
  paymentOptionSelected: {
    borderColor: '#1f7df4',
    backgroundColor: '#eef4ff',
  },
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paymentDetails: {
    flex: 1,
    gap: 4,
  },
  paymentLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  paymentDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  paymentSecurity: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  paymentSecurityText: {
    fontSize: 12,
    color: '#6b7280',
  },
});

