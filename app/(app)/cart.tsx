import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useDeviceModel } from '@/hooks/use-device-model';
import { createRentalOrder } from '@/services/rental-orders';
import { fetchShippingAddresses, type ShippingAddress } from '@/services/shipping-addresses';
import {
  addDays,
  addMonths,
  clampToStartOfDay,
  endOfMonth,
  formatDisplayDate,
  generateCalendarDays,
  isSameDay,
  parseDateParam,
  startOfMonth,
  WEEKDAY_LABELS,
} from '@/utils/dates';
import {
  determineCurrency,
  formatCurrencyValue,
  getDailyRate,
  getDepositRatio,
  getDeviceValue,
} from '@/utils/product-pricing';
import styles from './cart.styles';
const formatAddressTimestamp = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
};

type DatePickerFieldProps = {
  value: Date;
  minimumDate: Date;
  onChange: (date: Date) => void;
};

function DatePickerField({ value, minimumDate, onChange }: DatePickerFieldProps) {
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(value));
  const normalizedMinimum = useMemo(() => clampToStartOfDay(minimumDate), [minimumDate]);

  useEffect(() => {
    if (!isPickerVisible) {
      setActiveMonth(startOfMonth(value));
    }
  }, [isPickerVisible, value]);

  const calendarDays = useMemo(() => generateCalendarDays(activeMonth), [activeMonth]);

  const handleOpen = () => {
    setIsPickerVisible(true);
  };

  const handleClose = () => {
    setIsPickerVisible(false);
  };

  const handleSelect = (nextDate: Date) => {
    const normalized = clampToStartOfDay(nextDate);
    if (normalized.getTime() < normalizedMinimum.getTime()) {
      return;
    }

    setIsPickerVisible(false);
    onChange(normalized);
  };

  const goToPreviousMonth = () => {
    setActiveMonth((current) => addMonths(current, -1));
  };

  const goToNextMonth = () => {
    setActiveMonth((current) => addMonths(current, 1));
  };

  const canNavigatePrev = useMemo(() => {
    const previousMonthEnd = endOfMonth(addMonths(activeMonth, -1));
    return previousMonthEnd.getTime() >= normalizedMinimum.getTime();
  }, [activeMonth, normalizedMinimum]);

  return (
    <>
      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel="Select date"
        activeOpacity={0.85}
      >
        <Ionicons name="calendar-outline" size={18} color="#6f6f6f" style={styles.datePickerIcon} />
        <Text style={styles.datePickerValue}>{formatDisplayDate(value)}</Text>
      </TouchableOpacity>

      {isPickerVisible && (
        <Modal transparent animationType="fade" visible onRequestClose={handleClose}>
          <View style={styles.datePickerModalBackdrop}>
            <View style={styles.datePickerModalContent}>
              <View style={styles.datePickerModalHeader}>
                <TouchableOpacity
                  style={[styles.datePickerModalButton, !canNavigatePrev && styles.datePickerModalButtonDisabled]}
                  onPress={canNavigatePrev ? goToPreviousMonth : undefined}
                  disabled={!canNavigatePrev}
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={!canNavigatePrev ? '#c5c5c5' : '#111111'}
                  />
                </TouchableOpacity>
                <Text style={styles.datePickerModalTitle}>
                  {activeMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity
                  style={styles.datePickerModalButton}
                  onPress={goToNextMonth}
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                >
                  <Ionicons name="chevron-forward" size={20} color="#111111" />
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerWeekdaysRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.datePickerWeekday}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.datePickerDaysGrid}>
                {calendarDays.map((day) => {
                  const isFromCurrentMonth = day.getMonth() === activeMonth.getMonth();
                  const isDisabled = day.getTime() < normalizedMinimum.getTime();
                  const isSelected = isSameDay(day, value);

                  return (
                    <TouchableOpacity
                      key={day.getTime()}
                      style={[
                        styles.datePickerDayButton,
                        !isFromCurrentMonth && styles.datePickerDayOutside,
                        isSelected && styles.datePickerDaySelected,
                        isDisabled && styles.datePickerDayDisabled,
                      ]}
                      onPress={() => handleSelect(day)}
                      disabled={isDisabled}
                      accessibilityRole="button"
                      accessibilityLabel={formatDisplayDate(day)}
                    >
                      <Text
                        style={[
                          styles.datePickerDayText,
                          !isFromCurrentMonth && styles.datePickerDayTextOutside,
                          isSelected && styles.datePickerDayTextSelected,
                          isDisabled && styles.datePickerDayTextDisabled,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.datePickerCloseButton}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close date picker"
              >
                <Text style={styles.datePickerCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const { session, user, ensureSession } = useAuth();
  const { productId, quantity: quantityParam, startDate: startParam, endDate: endParam } =
    useLocalSearchParams<{
      productId?: string;
      quantity?: string;
      startDate?: string;
      endDate?: string;
    }>();
  const { data: product, loading, error } = useDeviceModel(productId);
  const { items: cartItems, updateQuantity, removeItem, clear } = useCart();

  const quantity = useMemo(() => {
    const parsed = Number.parseInt(typeof quantityParam === 'string' ? quantityParam : '1', 10);
    return Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed;
  }, [quantityParam]);

  const fallbackItem = useMemo(() => {
    if (!product) {
      return null;
    }

    return {
      product,
      quantity,
    };
  }, [product, quantity]);

  const items = useMemo(() => {
    if (cartItems.length > 0) {
      return cartItems;
    }

    return fallbackItem ? [fallbackItem] : [];
  }, [cartItems, fallbackItem]);
  const hasItems = items.length > 0;
  const isContextBacked = cartItems.length > 0;

  const today = clampToStartOfDay(new Date());
  const initialStartDate = parseDateParam(startParam, today);
  const initialEndFallback = addDays(initialStartDate, 1);
  const initialEndDate = parseDateParam(endParam, initialEndFallback);

  const [startDate, setStartDate] = useState<Date>(initialStartDate);
  const [endDate, setEndDate] = useState<Date>(
    initialEndDate.getTime() <= initialStartDate.getTime() ? initialEndFallback : initialEndDate
  );
  const [shippingAddress, setShippingAddress] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<ShippingAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [isRefreshingAddresses, setIsRefreshingAddresses] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [isAddressPickerVisible, setIsAddressPickerVisible] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minimumStartDate = today;
  const minimumEndDate = useMemo(() => addDays(startDate, 1), [startDate]);
  const isRangeInvalid = endDate.getTime() <= startDate.getTime();
  const rentalDurationInDays = useMemo(() => {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const rawDuration = Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);

    return Math.max(1, rawDuration);
  }, [endDate, startDate]);

  const fetchSavedAddresses = useCallback(async () => {
    const activeSession = session?.accessToken ? session : await ensureSession();

    if (!activeSession?.accessToken) {
      return [];
    }

    const addresses = await fetchShippingAddresses({
      accessToken: activeSession.accessToken,
      tokenType: activeSession.tokenType,
    });

    return addresses;
  }, [ensureSession, session]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoadingAddresses(true);
      setAddressError(null);

      fetchSavedAddresses()
        .then((results) => {
          if (!isActive) {
            return;
          }

          setSavedAddresses(results);
        })
        .catch((error) => {
          if (!isActive) {
            return;
          }

          const message =
            error instanceof Error
              ? error.message
              : 'Failed to load your shipping addresses. Please try again later.';
          setAddressError(message);
          setSavedAddresses([]);
        })
        .finally(() => {
          if (isActive) {
            setIsLoadingAddresses(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [fetchSavedAddresses]),
  );

  const handleRefreshSavedAddresses = useCallback(async () => {
    setIsRefreshingAddresses(true);

    try {
      const results = await fetchSavedAddresses();
      setSavedAddresses(results);
      setAddressError(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to refresh your shipping addresses. Please try again later.';
      setAddressError(message);
      Toast.show({ type: 'error', text1: 'Unable to refresh addresses', text2: message });
    } finally {
      setIsRefreshingAddresses(false);
    }
  }, [fetchSavedAddresses]);

  const handleOpenAddressPicker = useCallback(() => {
    setIsAddressPickerVisible(true);
  }, []);

  const handleCloseAddressPicker = useCallback(() => {
    setIsAddressPickerVisible(false);
  }, []);

  const handleSelectSavedAddress = useCallback((address: ShippingAddress) => {
    setShippingAddress(address.address.trim());
    setIsAddressPickerVisible(false);
    Toast.show({
      type: 'success',
      text1: 'Shipping address selected',
      text2: 'We will deliver your rental order to this location.',
    });
  }, []);

  const summaryCurrency = useMemo(() => {
    if (!hasItems) {
      return null;
    }

    const uniqueCurrencies = new Set<ReturnType<typeof determineCurrency>>(
      items.map((item) => determineCurrency(item.product))
    );

    if (uniqueCurrencies.size !== 1) {
      return null;
    }

    return uniqueCurrencies.values().next().value ?? null;
  }, [hasItems, items]);

  const totalAmount = useMemo(() => {
    if (summaryCurrency === null) {
      return null;
    }

    return items.reduce((sum, item) => sum + getDailyRate(item.product) * item.quantity, 0);
  }, [items, summaryCurrency]);
  const totalOrderAmount = useMemo(() => {
    if (summaryCurrency === null) {
      return null;
    }

    return items.reduce(
      (sum, item) => sum + getDailyRate(item.product) * item.quantity * rentalDurationInDays,
      0
    );
  }, [items, rentalDurationInDays, summaryCurrency]);
  const formattedTotal = useMemo(() => {
    if (!hasItems || totalAmount === null || !summaryCurrency) {
      return '—';
    }

    return formatCurrencyValue(totalAmount, summaryCurrency);
  }, [hasItems, summaryCurrency, totalAmount]);

  const { depositTotalLabel, deviceValueTotalLabel, depositTotalValue } = useMemo(() => {
    if (!hasItems || summaryCurrency === null) {
      return {
        depositTotalLabel: '—',
        deviceValueTotalLabel: '—',
        depositTotalValue: null,
      };
    }

    let depositSum = 0;
    let hasDepositAmount = false;
    let deviceValueSum = 0;
    let hasDeviceValue = false;

    items.forEach((item) => {
      const depositRatio = getDepositRatio(item.product);
      const deviceValue = getDeviceValue(item.product);

      if (depositRatio !== null && deviceValue !== null) {
        depositSum += depositRatio * deviceValue * item.quantity;
        hasDepositAmount = true;
      }

      if (deviceValue !== null) {
        deviceValueSum += deviceValue * item.quantity;
        hasDeviceValue = true;
      }
    });

    return {
      depositTotalLabel:
        hasDepositAmount && summaryCurrency
          ? formatCurrencyValue(depositSum, summaryCurrency)
          : '—',
      deviceValueTotalLabel:
        hasDeviceValue && summaryCurrency
          ? formatCurrencyValue(deviceValueSum, summaryCurrency)
          : '—',
      depositTotalValue: hasDepositAmount ? depositSum : null,
    };
  }, [hasItems, items, summaryCurrency]);

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );
  const deviceLabel = useMemo(() => {
    if (!hasItems) {
      return '0 devices';
    }

    return `${totalQuantity} ${totalQuantity === 1 ? 'device' : 'devices'}`;
  }, [hasItems, totalQuantity]);
  const totalCostLabel = useMemo(() => {
    if (!hasItems) {
      return '—';
    }

    if (summaryCurrency === null || totalOrderAmount === null) {
      return '—';
    }

    const depositValue = depositTotalValue ?? 0;

    return formatCurrencyValue(totalOrderAmount + depositValue, summaryCurrency);
  }, [depositTotalValue, hasItems, summaryCurrency, totalOrderAmount]);
  const summaryMetrics = useMemo(
    () => {
      const metrics = [
        { label: 'Total Items', value: deviceLabel },
        { label: 'Daily Total', value: formattedTotal },
        { label: 'Deposit Total', value: depositTotalLabel },
        { label: 'Device Value Total', value: deviceValueTotalLabel },
      ];

      metrics.push({ label: 'Total Cost', value: totalCostLabel, highlight: true });

      return metrics;
    },
    [depositTotalLabel, deviceLabel, deviceValueTotalLabel, formattedTotal, totalCostLabel]
  );

  if (!hasItems && !product) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.loadingState}>
          {loading ? (
            <ActivityIndicator size="large" color="#111111" />
          ) : (
            <Text style={styles.loadingStateText}>Device not found.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const rentalRangeLabel =
    endDate.getTime() === startDate.getTime()
      ? formatDisplayDate(startDate)
      : `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;

  const handleStartDateChange = (nextDate: Date) => {
    const normalized = clampToStartOfDay(nextDate);
    setStartDate(normalized);
    setEndDate((current) => (current.getTime() <= normalized.getTime() ? addDays(normalized, 1) : current));
  };

  const handleEndDateChange = (nextDate: Date) => {
    const normalized = clampToStartOfDay(nextDate);
    if (normalized.getTime() <= startDate.getTime()) {
      setEndDate(addDays(startDate, 1));
      return;
    }

    setEndDate(normalized);
  };

  const hasInvalidItemId = items.some(
    (item) => !Number.isFinite(Number.parseInt(item.product.id, 10))
  );

  const isCheckoutDisabled =
    !hasItems || !shippingAddress.trim() || isRangeInvalid || isSubmitting || hasInvalidItemId;

  const handleCheckout = async () => {
    if (isCheckoutDisabled) {
      return;
    }

    if (!session?.accessToken) {
      Alert.alert('Authentication required', 'Please sign in again to complete your rental.');
      return;
    }

    const orderDetails = items.map((item) => {
      const deviceModelId = Number.parseInt(item.product.id, 10);
      return {
        quantity: item.quantity,
        deviceModelId,
      };
    });

    if (orderDetails.some((detail) => !Number.isFinite(detail.deviceModelId))) {
      setSubmitError('Unable to determine one or more selected devices. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const createdOrder = await createRentalOrder(
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          shippingAddress: shippingAddress.trim(),
          orderDetails,
        },
        {
          accessToken: session.accessToken,
          tokenType: session.tokenType,
        }
      );

      clear();

      const normalizedKycStatus = (user?.kycStatus ?? '').toUpperCase();

      if (normalizedKycStatus === 'NOT_STARTED') {
        const goToOrders = () =>
          router.replace({
            pathname: '/(app)/(tabs)/orders',
            params: { flow: 'continue', orderId: String(createdOrder.orderId) },
          });

        Alert.alert(
          'Complete your KYC',
          'Your rental order is pending identity verification. Would you like to finish your KYC now?',
          [
            {
              text: 'Later',
              style: 'cancel',
              onPress: goToOrders,
            },
            {
              text: 'Start KYC',
              onPress: () => router.replace('/(app)/kyc-documents'),
            },
          ],
          {
            cancelable: true,
            onDismiss: goToOrders,
          }
        );

        return;
      }

      Alert.alert(
        'Rental order created',
        "Your rental order was submitted successfully. We'll keep you posted with updates.",
        [
          {
            text: 'OK',
            onPress: () =>
              router.replace({
                pathname: '/(app)/(tabs)/home',
              }),
          },
        ]
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create the rental order. Please try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {loading && (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color="#111111" />
          </View>
        )}

        <View style={styles.summaryRow}>
          {summaryMetrics.map((metric) => (
            <View key={metric.label} style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>{metric.label}</Text>
              <Text style={[styles.summaryValue, metric.highlight && styles.summaryValueHighlight]}>
                {metric.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <View>
              <Text style={styles.orderTitle}>Rental Summary</Text>
              <Text style={styles.orderSubtitle}>{rentalRangeLabel}</Text>
            </View>
            <TouchableOpacity
              style={[styles.clearButton, (!hasItems || !isContextBacked) && styles.clearButtonDisabled]}
              onPress={clear}
              disabled={!hasItems || !isContextBacked}
              accessibilityRole="button"
              accessibilityLabel="Clear cart"
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={!hasItems || !isContextBacked ? '#d0d0d0' : '#9c9c9c'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.orderBody}>
            {hasItems ? (
              items.map((item) => {
                const itemCurrency = determineCurrency(item.product);
                const itemDailyRate = getDailyRate(item.product);
                const itemLineTotal = formatCurrencyValue(itemDailyRate * item.quantity, itemCurrency);
                const itemLabel = item.product.model || item.product.name;
                const itemDailyRateLabel = `${formatCurrencyValue(itemDailyRate, itemCurrency)} / day`;
                const depositRatio = getDepositRatio(item.product);
                const deviceValue = getDeviceValue(item.product);
                const depositPercentageLabel =
                  depositRatio !== null ? `${Math.round(depositRatio * 100)}%` : null;
                const depositAmountPerUnit =
                  depositRatio !== null && deviceValue !== null ? depositRatio * deviceValue : null;
                const depositSummary = depositPercentageLabel
                  ? depositAmountPerUnit !== null
                    ? `${depositPercentageLabel} (~${formatCurrencyValue(depositAmountPerUnit, itemCurrency)})`
                    : depositPercentageLabel
                  : null;
                const itemDepositTotalLabel =
                  depositAmountPerUnit !== null && item.quantity > 1
                    ? formatCurrencyValue(depositAmountPerUnit * item.quantity, itemCurrency)
                    : null;
                const deviceValueLabel =
                  deviceValue !== null ? formatCurrencyValue(deviceValue, itemCurrency) : null;
                const itemDeviceValueTotalLabel =
                  deviceValue !== null && item.quantity > 1
                    ? formatCurrencyValue(deviceValue * item.quantity, itemCurrency)
                    : null;
                const availableStock = Number.isFinite(item.product.stock)
                  ? Math.max(0, Math.floor(item.product.stock))
                  : Number.POSITIVE_INFINITY;
                const isAdjustable = isContextBacked;
                const canDecrease = isAdjustable && item.quantity > 1;
                const canIncrease =
                  isAdjustable &&
                  (availableStock === Number.POSITIVE_INFINITY ? true : item.quantity < availableStock);

                return (
                  <View key={item.product.id} style={styles.orderItem}>
                    <View style={styles.orderItemHeader}>
                      <View style={styles.orderItemTitle}>
                        <View style={styles.productBadge}>
                          <Ionicons name="phone-portrait-outline" size={24} color="#6f6f6f" />
                        </View>
                        <View style={styles.productDetails}>
                          <Text style={styles.productName}>{itemLabel}</Text>
                          <View style={styles.quantityRow}>
                            <TouchableOpacity
                              style={[styles.quantityButton, !canDecrease && styles.quantityButtonDisabled]}
                              onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                              disabled={!canDecrease}
                              accessibilityRole="button"
                              accessibilityLabel={`Decrease quantity for ${itemLabel}`}
                            >
                              <Ionicons name="remove" size={16} color="#111111" />
                            </TouchableOpacity>
                            <Text style={styles.quantityValue}>{item.quantity}</Text>
                            <TouchableOpacity
                              style={[styles.quantityButton, !canIncrease && styles.quantityButtonDisabled]}
                              onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
                              disabled={!canIncrease}
                              accessibilityRole="button"
                              accessibilityLabel={`Increase quantity for ${itemLabel}`}
                            >
                              <Ionicons name="add" size={16} color="#111111" />
                            </TouchableOpacity>
                          </View>
                          {Number.isFinite(availableStock) ? (
                            <Text style={styles.productMeta}>{`Stock available: ${availableStock}`}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.orderItemHeaderRight}>
                        <View style={styles.lineTotalGroup}>
                          <Text style={styles.lineTotalLabel}>Line total</Text>
                          <Text style={styles.productPrice}>{itemLineTotal}</Text>
                        </View>
                        {isContextBacked ? (
                          <TouchableOpacity
                            style={styles.removeItemButton}
                            onPress={() => removeItem(item.product.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${itemLabel}`}
                          >
                            <Ionicons name="close" size={16} color="#6f6f6f" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.orderItemDetails}>
                      <View style={styles.orderItemMetric}>
                        <Text style={styles.orderItemMetricLabel}>Daily rate</Text>
                        <Text style={styles.orderItemMetricValue}>{itemDailyRateLabel}</Text>
                      </View>
                      {depositSummary ? (
                        <View style={styles.orderItemMetric}>
                          <Text style={styles.orderItemMetricLabel}>Deposit</Text>
                          <Text style={styles.orderItemMetricValue}>{depositSummary}</Text>
                          {itemDepositTotalLabel ? (
                            <Text style={styles.orderItemMetricSubValue}>{`Total: ${itemDepositTotalLabel}`}</Text>
                          ) : null}
                        </View>
                      ) : null}
                      {deviceValueLabel ? (
                        <View style={styles.orderItemMetric}>
                          <Text style={styles.orderItemMetricLabel}>Device value</Text>
                          <Text style={styles.orderItemMetricValue}>{deviceValueLabel}</Text>
                          {itemDeviceValueTotalLabel ? (
                            <Text style={styles.orderItemMetricSubValue}>{`Total: ${itemDeviceValueTotalLabel}`}</Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyOrderBody}>
                <Text style={styles.emptyOrderText}>Add devices to your cart to create a rental.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Shipping Address</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Enter the address where we should deliver the device"
            placeholderTextColor="#9c9c9c"
            value={shippingAddress}
            onChangeText={setShippingAddress}
            multiline
          />
          <View style={styles.addressActions}>
            <TouchableOpacity
              style={styles.addressActionButton}
              onPress={handleOpenAddressPicker}
              accessibilityRole="button"
              accessibilityLabel="Choose a saved shipping address"
            >
              <Ionicons
                name="location-outline"
                size={16}
                color="#111111"
                style={styles.addressActionIcon}
              />
              <Text style={styles.addressActionText}>
                {isLoadingAddresses ? 'Loading saved addresses…' : 'Choose saved address'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addressActionButton}
              onPress={() => router.push('/(app)/shipping-addresses')}
              accessibilityRole="button"
              accessibilityLabel="Manage shipping addresses"
            >
              <Ionicons
                name="settings-outline"
                size={16}
                color="#111111"
                style={styles.addressActionIcon}
              />
              <Text style={styles.addressActionText}>Manage addresses</Text>
            </TouchableOpacity>
          </View>
          {addressError ? (
            <Text style={styles.addressHelperError}>{addressError}</Text>
          ) : (
            <Text style={styles.addressHelperText}>
              {isLoadingAddresses
                ? 'Loading your saved addresses…'
                : savedAddresses.length > 0
                ? `You have ${savedAddresses.length} saved ${
                    savedAddresses.length === 1 ? 'address' : 'addresses'
                  }.`
                : 'Add a shipping address so you can reuse it for future rentals.'}
            </Text>
          )}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Rental Dates</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateColumn}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <DatePickerField
                value={startDate}
                minimumDate={minimumStartDate}
                onChange={handleStartDateChange}
              />
            </View>
            <View style={styles.dateColumn}>
              <Text style={styles.dateLabel}>End Date</Text>
              <DatePickerField value={endDate} minimumDate={minimumEndDate} onChange={handleEndDateChange} />
            </View>
          </View>
          {isRangeInvalid && (
            <Text style={styles.dateErrorText}>End date must be at least one day after the start date.</Text>
          )}
        </View>

        {submitError && (
          <View style={styles.submitErrorBanner}>
            <Text style={styles.submitErrorText}>{submitError}</Text>
          </View>
        )}
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={isAddressPickerVisible}
        onRequestClose={handleCloseAddressPicker}
      >
        <View style={styles.addressPickerBackdrop}>
          <View style={styles.addressPickerContainer}>
            <View style={styles.addressPickerHeader}>
              <Text style={styles.addressPickerTitle}>Saved addresses</Text>
              <TouchableOpacity
                style={styles.addressPickerCloseButton}
                onPress={handleCloseAddressPicker}
                accessibilityRole="button"
                accessibilityLabel="Close saved addresses"
              >
                <Ionicons name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            {isLoadingAddresses ? (
              <View style={styles.addressPickerLoading}>
                <ActivityIndicator size="small" color="#111111" />
                <Text style={styles.addressPickerLoadingText}>Loading addresses…</Text>
              </View>
            ) : savedAddresses.length > 0 ? (
              <ScrollView
                style={styles.addressPickerList}
                contentContainerStyle={styles.addressPickerListContent}
                showsVerticalScrollIndicator={false}
              >
                {savedAddresses.map((address) => {
                  const timestamp = formatAddressTimestamp(address.updatedAt ?? address.createdAt);

                  return (
                    <TouchableOpacity
                      key={address.shippingAddressId}
                      style={styles.addressPickerItem}
                      onPress={() => handleSelectSavedAddress(address)}
                      accessibilityRole="button"
                      accessibilityLabel="Use this shipping address"
                    >
                      <Text style={styles.addressPickerItemText}>{address.address}</Text>
                      {timestamp ? (
                        <Text style={styles.addressPickerItemMeta}>{`Updated ${timestamp}`}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.addressPickerEmpty}>
                <Ionicons name="home-outline" size={42} color="#6f6f6f" />
                <Text style={styles.addressPickerEmptyTitle}>No saved addresses</Text>
                <Text style={styles.addressPickerEmptySubtitle}>
                  Manage your addresses to add one before selecting it here.
                </Text>
              </View>
            )}

            <View style={styles.addressPickerFooter}>
              <TouchableOpacity
                style={[
                  styles.addressPickerRefreshButton,
                  isRefreshingAddresses && styles.addressPickerRefreshButtonDisabled,
                ]}
                onPress={() => void handleRefreshSavedAddresses()}
                disabled={isRefreshingAddresses}
                accessibilityRole="button"
                accessibilityLabel="Refresh saved addresses"
              >
                {isRefreshingAddresses ? (
                  <ActivityIndicator size="small" color="#111111" />
                ) : (
                  <>
                    <Ionicons
                      name="refresh"
                      size={18}
                      color="#111111"
                      style={styles.addressPickerRefreshIcon}
                    />
                    <Text style={styles.addressPickerRefreshText}>Refresh</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addressPickerManageButton}
                onPress={() => {
                  handleCloseAddressPicker();
                  router.push('/(app)/shipping-addresses');
                }}
                accessibilityRole="button"
                accessibilityLabel="Manage shipping addresses"
              >
                <Ionicons
                  name="settings-outline"
                  size={18}
                  color="#111111"
                  style={styles.addressPickerManageIcon}
                />
                <Text style={styles.addressPickerManageText}>Manage</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.footerActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.checkoutButton, (isCheckoutDisabled || isSubmitting) && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={isCheckoutDisabled || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.checkoutText}>Place Rental Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
